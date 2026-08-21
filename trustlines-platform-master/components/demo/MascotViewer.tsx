'use client';









import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Mood } from '@/lib/demo/moodEngine';





function CameraAim({ target }: { target: [number, number, number] }) {
  const camera = useThree(s => s.camera);
  useEffect(() => { camera.lookAt(...target); camera.updateProjectionMatrix(); }, [camera, target]);
  return null;
}

interface Props {
  glbPath: string | null;
  mood: Mood;
  bodyColor: string;
  bellyColor: string;
  accent: string;
  roam?: boolean;
  grounded?: boolean;
}


function motionFor(mood: Mood, t: number) {
  switch (mood) {
    case 'celebrating': return { y: Math.abs(Math.sin(t * 6)) * 0.5,  rotY: t * 3.0,            rotZ: Math.sin(t * 10) * 0.15, scale: 1.0 };
    case 'champion':    return { y: Math.abs(Math.sin(t * 3)) * 0.7,  rotY: t * 1.5,            rotZ: 0,                       scale: 1.08 + Math.sin(t * 3) * 0.04 };
    case 'working':     return { y: Math.sin(t * 2) * 0.12,           rotY: Math.sin(t * 1.2) * 0.5, rotZ: 0,                  scale: 1.0 };
    case 'worried':     return { y: 0,                                rotY: 0,                  rotZ: Math.sin(t * 18) * 0.06, scale: 0.96 };
    case 'thinking':    return { y: Math.sin(t * 0.8) * 0.06,         rotY: Math.sin(t * 0.5) * 0.3, rotZ: 0.18,               scale: 1.0 };
    case 'idle':
    default:            return { y: Math.sin(t * 1.1) * 0.08,         rotY: 0,                  rotZ: 0,                       scale: 1.0 };
  }
}

function useCharacterMotion(mood: Mood, roam: boolean, grounded = false) {
  const ref = useRef<THREE.Group>(null);
  useFrame(state => {
    const g = ref.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const m = motionFor(mood, t);
    if (grounded) {



      g.position.set(0, 0, 0);
      g.rotation.set(0, Math.sin(t * 0.4) * 0.06, 0);
      g.scale.setScalar(1);
      return;
    }
    if (roam) {


      g.position.x = Math.sin(t * 0.33) * 1.9 + Math.sin(t * 0.11) * 1.0;
      g.position.z = Math.sin(t * 0.19) * 0.9;
      g.position.y = m.y + Math.sin(t * 0.45) * 0.25 - 0.2;
      g.rotation.y = Math.cos(t * 0.33) * 0.7 + m.rotY * 0.3;
      g.rotation.z = m.rotZ;
    } else {
      g.position.set(0, m.y, 0);
      g.rotation.set(0, m.rotY, m.rotZ);
    }
    g.scale.setScalar(m.scale);
  });
  return ref;
}


function PlaceholderCharacter({ mood, body, belly, roam, grounded }: { mood: Mood; body: string; belly: string; roam: boolean; grounded?: boolean }) {
  const ref = useCharacterMotion(mood, roam, grounded);
  return (
    <group ref={ref}>

      <mesh position={[0, -0.2, 0]}>
        <capsuleGeometry args={[0.7, 0.9, 8, 16]} />
        <meshStandardMaterial color={body} roughness={0.6} />
      </mesh>

      <mesh position={[0, -0.25, 0.55]}>
        <sphereGeometry args={[0.45, 24, 24]} />
        <meshStandardMaterial color={belly} roughness={0.75} />
      </mesh>

      <mesh position={[0, 0.85, 0]}>
        <sphereGeometry args={[0.6, 32, 32]} />
        <meshStandardMaterial color={body} roughness={0.6} />
      </mesh>

      <mesh position={[-0.22, 0.95, 0.5]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial color="#141414" />
      </mesh>
      <mesh position={[0.22, 0.95, 0.5]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial color="#141414" />
      </mesh>

      <mesh position={[0, 1.34, 0]}>
        <cylinderGeometry args={[0.48, 0.56, 0.18, 24]} />
        <meshStandardMaterial color="#f2f2f2" roughness={0.4} />
      </mesh>
    </group>
  );
}


function GlbCharacter({ path, mood, roam, grounded }: { path: string; mood: Mood; roam: boolean; grounded?: boolean }) {
  const ref = useCharacterMotion(mood, roam, grounded);
  const { scene, animations } = useGLTF(path);
  const { actions, names } = useAnimations(animations, ref);



  const { scale, offset } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    return { scale: 2.4 / maxDim, offset: [-center.x, -center.y, -center.z] as [number, number, number] };
  }, [scene]);

  useEffect(() => {
    if (!names.length) return;


    const pick =
      names.find(n => /agree|gesture|idle|wave|talk/i.test(n)) ||
      names.find(n => !/walk|run|fall|shot/i.test(n)) ||
      names[0];
    const a = actions[pick];
    a?.reset().fadeIn(0.3).play();
    return () => { a?.fadeOut(0.3); };
  }, [actions, names, mood]);

  return (
    <group ref={ref}>
      <group scale={scale}>
        <primitive object={scene} position={offset} />
      </group>
    </group>
  );
}

export default function MascotViewer({ glbPath, mood, bodyColor, bellyColor, accent, roam = false, grounded = false }: Props) {

  const lightColor =
    mood === 'worried' ? '#ff5c5c' :
    mood === 'champion' ? '#ffd479' :
    mood === 'celebrating' ? '#6ee7a0' :
    accent;




  const cam: [number, number, number] = grounded ? [0, 0.5, 8.4] : [0, roam ? 0.3 : 0.6, roam ? 6.4 : 4.2];
  const fov = grounded ? 30 : roam ? 40 : 42;
  const aimAt: [number, number, number] = grounded ? [0, 0.15, 0] : [0, 0, 0];

  return (
    <Canvas
      camera={{ position: cam, fov }}
      dpr={[1, 2]}
      gl={{ alpha: true }}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
    >
      <CameraAim target={aimAt} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 5, 4]} intensity={1.15} />
      <pointLight position={[0, 1.2, 3]} intensity={2.4} color={lightColor} distance={14} />
      <Suspense fallback={null}>
        {glbPath
          ? <GlbCharacter path={glbPath} mood={mood} roam={roam} grounded={grounded} />
          : <PlaceholderCharacter mood={mood} body={bodyColor} belly={bellyColor} roam={roam} grounded={grounded} />}
      </Suspense>
    </Canvas>
  );
}
