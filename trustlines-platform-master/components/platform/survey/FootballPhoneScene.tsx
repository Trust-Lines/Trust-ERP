"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, RoundedBox } from "@react-three/drei";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { createSoccerBallGroup } from "./soccerBall3d";

type SceneProps = { shoot: boolean; scored?: boolean; reducedMotion: boolean; onGoal?: () => void };

function Net() {
  const lines = [];
  for (let x = -.84; x <= .85; x += .17) lines.push(<mesh key={`back-v${x}`} position={[x, .51, -.54]}><boxGeometry args={[.008, 1.02, .008]} /><meshStandardMaterial color="#eef1ed" transparent opacity={.72} roughness={.8} /></mesh>);
  for (let y = .08; y <= 1.02; y += .13) lines.push(<mesh key={`back-h${y}`} position={[0, y, -.54]}><boxGeometry args={[1.72, .008, .008]} /><meshStandardMaterial color="#eef1ed" transparent opacity={.72} roughness={.8} /></mesh>);
  for (let z = -.48; z <= -.05; z += .11) lines.push(<mesh key={`top${z}`} position={[0, 1.02, z]} rotation={[Math.PI / 2, 0, 0]}><boxGeometry args={[1.72, .008, .008]} /><meshStandardMaterial color="#eef1ed" transparent opacity={.66} /></mesh>);
  for (let x = -.84; x <= .85; x += .17) lines.push(<mesh key={`top-v${x}`} position={[x, 1.02, -.27]}><boxGeometry args={[.008, .008, .54]} /><meshStandardMaterial color="#eef1ed" transparent opacity={.66} /></mesh>);
  for (const side of [-.86, .86]) {
    for (let y = .12; y <= .94; y += .14) lines.push(<mesh key={`side-${side}-${y}`} position={[side, y, -.27]}><boxGeometry args={[.008, .008, .54]} /><meshStandardMaterial color="#eef1ed" transparent opacity={.62} /></mesh>);
  }
  return <group>{lines}</group>;
}

function Goal({ netRef }: { netRef: RefObject<THREE.Group | null> }) {
  const PostMaterial = () => <meshPhysicalMaterial color="#e9ece7" roughness={.46} metalness={.04} clearcoat={.22} clearcoatRoughness={.4} />;
  return <group position={[0, .056, -2.56]}>
    <mesh position={[-.9, .51, 0]} castShadow><cylinderGeometry args={[.038, .038, 1.04, 18]} /><PostMaterial /></mesh>
    <mesh position={[.9, .51, 0]} castShadow><cylinderGeometry args={[.038, .038, 1.04, 18]} /><PostMaterial /></mesh>
    <mesh position={[0, 1.03, 0]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[.038, .038, 1.84, 18]} /><PostMaterial /></mesh>
    <mesh position={[-.9, .04, -.28]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[.027, .027, .58, 14]} /><PostMaterial /></mesh>
    <mesh position={[.9, .04, -.28]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[.027, .027, .58, 14]} /><PostMaterial /></mesh>
    <group ref={netRef}><Net /></group>
  </group>;
}

function PitchSurface() {
  const grass = useMemo(() => {
    const width = 96, height = 192;
    const data = new Uint8Array(width * height * 4);
    let seed = 17;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      seed = (seed * 16807) % 2147483647;
      const noise = (seed / 2147483647 - .5) * 14;
      const stripe = Math.floor(y / 24) % 2 === 0 ? 0 : 8;
      const i = (y * width + x) * 4;
      data[i] = 43 + stripe + noise;
      data[i + 1] = 104 + stripe + noise;
      data[i + 2] = 67 + stripe * .6 + noise;
      data[i + 3] = 255;
    }
    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    texture.needsUpdate = true;
    return texture;
  }, []);
  useEffect(() => () => grass.dispose(), [grass]);
  return <mesh position={[0, .056, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
    <planeGeometry args={[3.05, 5.7]} />
    <meshStandardMaterial map={grass} roughness={.96} metalness={0} />
  </mesh>;
}

function PitchMarkings() {
  const line = "#dce4da";
  return <group position={[0, .073, 0]}>
    <mesh><boxGeometry args={[3.02, .012, .025]} /><meshStandardMaterial color={line} roughness={.8} /></mesh>
    <mesh><boxGeometry args={[.025, .012, 5.64]} /><meshStandardMaterial color={line} roughness={.8} /></mesh>
    <mesh position={[0, 0, 2.8]}><boxGeometry args={[3.02, .012, .025]} /><meshStandardMaterial color={line} /></mesh>
    <mesh position={[0, 0, -2.8]}><boxGeometry args={[3.02, .012, .025]} /><meshStandardMaterial color={line} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.48, .495, 64]} /><meshStandardMaterial color={line} side={THREE.DoubleSide} /></mesh>
    <mesh position={[0, .012, 0]}><cylinderGeometry args={[.035, .035, .012, 24]} /><meshStandardMaterial color={line} /></mesh>
    <group position={[0, 0, -2.25]}>
      <mesh position={[0, 0, -.55]}><boxGeometry args={[2.12, .012, .025]} /><meshStandardMaterial color={line} /></mesh>
      <mesh position={[-1.05, 0, -.27]}><boxGeometry args={[.025, .012, .56]} /><meshStandardMaterial color={line} /></mesh>
      <mesh position={[1.05, 0, -.27]}><boxGeometry args={[.025, .012, .56]} /><meshStandardMaterial color={line} /></mesh>
      <mesh position={[0, 0, -.75]}><boxGeometry args={[1.12, .012, .025]} /><meshStandardMaterial color={line} /></mesh>
      <mesh position={[-.55, 0, -.65]}><boxGeometry args={[.025, .012, .2]} /><meshStandardMaterial color={line} /></mesh>
      <mesh position={[.55, 0, -.65]}><boxGeometry args={[.025, .012, .2]} /><meshStandardMaterial color={line} /></mesh>
    </group>
  </group>;
}

function Ball() {
  const ballGroup = useMemo(() => createSoccerBallGroup(0.28), []);
  useEffect(() => {
    return () => {
      ballGroup.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh || (obj as THREE.LineSegments).isLineSegments) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material?.dispose();
          }
        }
      });
    };
  }, [ballGroup]);

  return <primitive object={ballGroup} />;
}

function PhoneScene({ shoot, scored, reducedMotion, onGoal }: SceneProps) {
  const phone = useRef<THREE.Group>(null);
  const pitch = useRef<THREE.Group>(null);
  const goal = useRef<THREE.Group>(null);
  const net = useRef<THREE.Group>(null);
  const ball = useRef<THREE.Group>(null);
  const ballShadow = useRef<THREE.Mesh>(null);
  const ballShadowMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const start = useRef<number | null>(null);
  const notified = useRef(false);

  useEffect(() => { if (shoot) { start.current = null; notified.current = false; } }, [shoot]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    if (!phone.current || !pitch.current || !goal.current || !ball.current || !net.current) return;
    const instant = reducedMotion ? 20 : 1;
    const phoneP = THREE.MathUtils.clamp(t / (.7 / instant), 0, 1);
    phone.current.position.y = THREE.MathUtils.lerp(-1.1, 0, 1 - Math.pow(1 - phoneP, 3));
    phone.current.rotation.z = THREE.MathUtils.lerp(-.075, -.01, phoneP);
    const pitchP = THREE.MathUtils.clamp((t - .42 / instant) / (.6 / instant), 0, 1);
    pitch.current.scale.set(1, THREE.MathUtils.smoothstep(pitchP, 0, 1), 1);
    const goalP = THREE.MathUtils.clamp((t - .82 / instant) / (.5 / instant), 0, 1);
    goal.current.scale.set(1, THREE.MathUtils.smoothstep(goalP, 0, 1), 1);

    if (!shoot && !scored) {
      const dropP = THREE.MathUtils.clamp((t - 1.08 / instant) / (.65 / instant), 0, 1);
      ball.current.position.set(0, THREE.MathUtils.lerp(1.6, .34, dropP) + (reducedMotion ? 0 : Math.sin(dropP * Math.PI * 2) * .13 * (1 - dropP)), 2.05);
      if (!reducedMotion) ball.current.rotation.y += delta * .34;
    }
    if (scored && !shoot) {
      ball.current.position.set(0, .34, -2.8);
      if (!reducedMotion) ball.current.rotation.y += delta * .18;
    }
    if (shoot) {
      if (start.current === null) start.current = t;
      const p = reducedMotion ? 1 : THREE.MathUtils.clamp((t - start.current) / .9, 0, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      ball.current.position.z = THREE.MathUtils.lerp(2.05, -2.8, eased);
      ball.current.position.y = .34 + Math.sin(p * Math.PI) * .76 + p * .04;
      ball.current.rotation.x += delta * 13;
      ball.current.rotation.z += delta * 5;
      if (p > .72) net.current.scale.z = 1 + Math.sin((p - .72) * Math.PI * 5) * .34 * (1 - p);
      if (p >= 1 && !notified.current) { notified.current = true; onGoal?.(); }
    }
    if (ballShadow.current && ballShadowMaterial.current) {
      ballShadow.current.position.z = ball.current.position.z;
      const lift = Math.max(0, ball.current.position.y - .34);
      const shadowScale = THREE.MathUtils.clamp(1 - lift * .24, .62, 1);
      ballShadow.current.scale.set(shadowScale, shadowScale, shadowScale);
      ballShadowMaterial.current.opacity = THREE.MathUtils.clamp(.24 - lift * .13, .055, .24);
    }
  });

  return <group ref={phone} rotation={[-.02, -.18, -.01]}>
    <RoundedBox args={[3.34,.055,6.02]} radius={.08} smoothness={4} castShadow receiveShadow><meshPhysicalMaterial color="#5a5e5c" metalness={.58} roughness={.38} clearcoat={.18} clearcoatRoughness={.45} /></RoundedBox>
    <RoundedBox args={[3.24,.018,5.92]} radius={.055} smoothness={4} position={[0,.036,0]}><meshStandardMaterial color="#284a35" metalness={0} roughness={.9} /></RoundedBox>
    <group ref={pitch} position={[0,.062,0]} scale={[1,0,1]}>
      <mesh receiveShadow><boxGeometry args={[3.18,.035,5.86]} /><meshStandardMaterial color="#285c3a" roughness={.98} /></mesh>
      <PitchSurface />
      <PitchMarkings />
      <group ref={goal} scale={[1,0,1]}><Goal netRef={net} /></group>
      <mesh ref={ballShadow} position={[0, .065, 2.05]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <circleGeometry args={[.24, 32]} />
        <meshBasicMaterial ref={ballShadowMaterial} color="#102117" transparent opacity={.24} depthWrite={false} />
      </mesh>
      <group ref={ball}><Ball /></group>
    </group>
  </group>;
}

export function FootballPhoneScene(props: SceneProps) {
  return <div className="football-scene" role="img" aria-label={props.scored ? "Football resting inside the goal on a phone-sized pitch" : "Three-dimensional phone football pitch ready for the final shot"}>
    <Canvas shadows dpr={[1,1.5]} camera={{ position:[4.5,5.8,7.8], fov:30 }} gl={{ alpha:true, antialias:true, powerPreference:"high-performance", toneMapping:THREE.ACESFilmicToneMapping, toneMappingExposure:1 }}>
      <hemisphereLight args={["#ffffff", "#758078", .82]} />
      <directionalLight position={[4.5,8,5.5]} intensity={2.05} castShadow shadow-mapSize={[1024,1024]} shadow-bias={-.0002} />
      <directionalLight position={[-4,3,1]} intensity={.32} color="#e4e9e5" />
      <PhoneScene {...props} />
      <ContactShadows position={[0,-.05,0]} opacity={.2} scale={7.5} blur={2.8} far={2.5} color="#26352b" />
    </Canvas>
  </div>;
}
