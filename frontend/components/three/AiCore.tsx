"use client";
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";

/** Points arranged on a fibonacci sphere with slight radial jitter. */
function sphere(count: number, radius: number, jitter: number): Float32Array {
  const arr = new Float32Array(count * 3);
  const golden = Math.PI * (1 + Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const rad = radius + (Math.random() - 0.5) * jitter;
    arr[i * 3] = Math.cos(theta) * r * rad;
    arr[i * 3 + 1] = y * rad;
    arr[i * 3 + 2] = Math.sin(theta) * r * rad;
  }
  return arr;
}

function Layer({ count, radius, jitter, color, size, speed }: {
  count: number; radius: number; jitter: number; color: string; size: number; speed: number;
}) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => sphere(count, radius, jitter), [count, radius, jitter]);

  useFrame((state, delta) => {
    const p = ref.current;
    if (!p) return;
    p.rotation.y += delta * speed;
    // gentle mouse-reactive tilt
    p.rotation.x = THREE.MathUtils.lerp(p.rotation.x, state.pointer.y * 0.35, 0.04);
    p.rotation.z = THREE.MathUtils.lerp(p.rotation.z, state.pointer.x * 0.12, 0.04);
  });

  return (
    <Points ref={ref} positions={positions} stride={3}>
      <PointMaterial
        transparent color={color} size={size} sizeAttenuation depthWrite={false}
        blending={THREE.AdditiveBlending} opacity={0.9}
      />
    </Points>
  );
}

/** The "Knowledge Brain" — glowing particle sphere. */
export function AiCore() {
  // Lenis transforms the scroll root, so R3F's initial measure can be stale.
  // Nudge a resize after mount so the canvas fills its container on first paint.
  useEffect(() => {
    const nudge = () => window.dispatchEvent(new Event("resize"));
    const raf = requestAnimationFrame(nudge);
    const t = setTimeout(nudge, 150);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, []);

  return (
    <Canvas camera={{ position: [0, 0, 4.6], fov: 50 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
      <Layer count={4200} radius={1.7} jitter={0.12} color="#38bdf8" size={0.02} speed={0.05} />
      <Layer count={2600} radius={1.72} jitter={0.35} color="#8b5cf6" size={0.016} speed={-0.03} />
      <Layer count={900} radius={2.15} jitter={0.5} color="#22d3ee" size={0.014} speed={0.02} />
    </Canvas>
  );
}
