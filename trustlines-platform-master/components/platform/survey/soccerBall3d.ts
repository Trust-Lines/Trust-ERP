import * as THREE from "three";

export function createSoccerBallGroup(radius = 0.28): THREE.Group {
  const group = new THREE.Group();

  const sphereGeo = new THREE.SphereGeometry(radius, 36, 36);
  const sphereMat = new THREE.MeshPhysicalMaterial({
    color: "#f7f7f2",
    roughness: 0.38,
    metalness: 0.02,
    clearcoat: 0.45,
    clearcoatRoughness: 0.25,
  });
  const baseSphere = new THREE.Mesh(sphereGeo, sphereMat);
  baseSphere.castShadow = true;
  baseSphere.receiveShadow = true;
  group.add(baseSphere);

  const phi = (1 + Math.sqrt(5)) / 2;
  const rawVerts: [number, number, number][] = [
    [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
    [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
    [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
  ];
  const vertices = rawVerts.map((v) => new THREE.Vector3(...v).normalize());

  const pentagonPositions: number[] = [];
  const pentagonNormals: number[] = [];
  const seamPositions: number[] = [];

  const spotRadius = radius + 0.0012;
  const seamRadius = radius + 0.0006;

  for (let i = 0; i < vertices.length; i++) {
    const V_i = vertices[i];

    const neighbors = vertices
      .filter((_, idx) => idx !== i)
      .map((v) => ({ v, dot: V_i.dot(v) }))
      .sort((a, b) => b.dot - a.dot)
      .slice(0, 5)
      .map((item) => item.v);

    const up = Math.abs(V_i.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const U = new THREE.Vector3().crossVectors(up, V_i).normalize();
    const W = new THREE.Vector3().crossVectors(V_i, U).normalize();

    neighbors.sort((a, b) => {
      const diffA = a.clone().sub(V_i);
      const diffB = b.clone().sub(V_i);
      return Math.atan2(diffA.dot(W), diffA.dot(U)) - Math.atan2(diffB.dot(W), diffB.dot(U));
    });

    const corners = neighbors.map((N_k) => {
      return V_i.clone().multiplyScalar(2 / 3).add(N_k.clone().multiplyScalar(1 / 3)).normalize();
    });

    const C = V_i.clone().multiplyScalar(spotRadius);

    for (let k = 0; k < 5; k++) {
      const C1 = corners[k].clone().multiplyScalar(spotRadius);
      const C2 = corners[(k + 1) % 5].clone().multiplyScalar(spotRadius);

      const seamP1 = corners[k].clone().multiplyScalar(seamRadius);
      const seamP2 = corners[(k + 1) % 5].clone().multiplyScalar(seamRadius);
      seamPositions.push(seamP1.x, seamP1.y, seamP1.z, seamP2.x, seamP2.y, seamP2.z);

      const M01 = V_i.clone().add(corners[k]).normalize().multiplyScalar(spotRadius);
      const M12 = corners[k].clone().add(corners[(k + 1) % 5]).normalize().multiplyScalar(spotRadius);
      const M20 = corners[(k + 1) % 5].clone().add(V_i).normalize().multiplyScalar(spotRadius);

      const subTriangles = [
        [C, M01, M20],
        [M01, C1, M12],
        [M20, M12, C2],
        [M01, M12, M20],
      ];

      for (const [pA, pB, pC] of subTriangles) {
        pentagonPositions.push(
          pA.x, pA.y, pA.z,
          pB.x, pB.y, pB.z,
          pC.x, pC.y, pC.z
        );
        const nA = pA.clone().normalize();
        const nB = pB.clone().normalize();
        const nC = pC.clone().normalize();
        pentagonNormals.push(
          nA.x, nA.y, nA.z,
          nB.x, nB.y, nB.z,
          nC.x, nC.y, nC.z
        );
      }
    }
  }

  const pentagonsGeo = new THREE.BufferGeometry();
  pentagonsGeo.setAttribute("position", new THREE.Float32BufferAttribute(pentagonPositions, 3));
  pentagonsGeo.setAttribute("normal", new THREE.Float32BufferAttribute(pentagonNormals, 3));

  const pentagonsMat = new THREE.MeshStandardMaterial({
    color: "#181818",
    roughness: 0.5,
    metalness: 0.05,
  });
  const pentagonsMesh = new THREE.Mesh(pentagonsGeo, pentagonsMat);
  pentagonsMesh.castShadow = true;
  pentagonsMesh.receiveShadow = true;
  group.add(pentagonsMesh);

  const seamGeo = new THREE.BufferGeometry();
  seamGeo.setAttribute("position", new THREE.Float32BufferAttribute(seamPositions, 3));
  const seamMat = new THREE.LineBasicMaterial({
    color: "#2a2a2a",
    linewidth: 1,
    transparent: true,
    opacity: 0.65,
  });
  const seamLines = new THREE.LineSegments(seamGeo, seamMat);
  group.add(seamLines);

  return group;
}
