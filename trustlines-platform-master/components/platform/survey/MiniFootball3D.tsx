"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createSoccerBallGroup } from "./soccerBall3d";

export function MiniFootball3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglReady, setWebglReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const size = 40;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 10);
    camera.position.set(0, 0, 1.25);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    } catch {
      setWebglReady(false);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(renderer.domElement);
    setWebglReady(true);

    const ballGroup = createSoccerBallGroup(0.28);
    ballGroup.rotation.set(-0.12, 0.4, -0.08);
    ballGroup.position.y = 0.045;
    scene.add(ballGroup);

    const contactShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.25, 24),
      new THREE.MeshBasicMaterial({ color: "#06110a", transparent: true, opacity: 0.28, depthWrite: false })
    );
    contactShadow.position.set(0, -0.27, -0.2);
    contactShadow.scale.set(1, 0.28, 1);
    scene.add(contactShadow);

    scene.add(new THREE.HemisphereLight("#ffffff", "#3a3a35", 1.0));
    const key = new THREE.DirectionalLight("#ffffff", 2.2);
    key.position.set(3, 4, 5);
    key.castShadow = true;
    scene.add(key);
    const fill = new THREE.DirectionalLight("#d0d0d0", 0.4);
    fill.position.set(-3, -2, 2);
    scene.add(fill);
    const rim = new THREE.PointLight("#ffffff", 0.8, 4);
    rim.position.set(-1.2, 0.6, -1.5);
    scene.add(rim);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visible = true;
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { rootMargin: "80px" });
    observer.observe(container);
    let raf = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      const delta = Math.min(clock.getDelta(), 0.05);
      if (visible) {
        if (!reducedMotion) ballGroup.rotation.y += delta * 0.42;
        renderer.render(scene, camera);
      }
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
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
      renderer.dispose();
      renderer.forceContextLoss();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`mini-football-3d${webglReady ? " is-ready" : ""}`}
      role="img"
      aria-label="Realistic football"
    >
      <span className="football-webgl-fallback" aria-hidden="true" />
    </div>
  );
}
