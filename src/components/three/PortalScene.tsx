"use client";

import { Sparkles } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { mulberry32 } from "./random";

export type PortalStatus = "idle" | "busy" | "SUCCESS" | "DUPLICATE" | "INVALID" | "WRONG_EVENT";

const COLORS: Record<PortalStatus, [string, string]> = {
  idle: ["#7c5cff", "#22d3ee"],
  busy: ["#a78bfa", "#67e8f9"],
  SUCCESS: ["#34d399", "#a3e635"],
  DUPLICATE: ["#fb7185", "#f43f5e"],
  INVALID: ["#fbbf24", "#f59e0b"],
  WRONG_EVENT: ["#fb923c", "#f97316"],
};

/** Particles orbiting inside the gate — a swirling "event horizon". */
function Vortex({ colorRef, speedRef }: { colorRef: RefObject<THREE.Color>; speedRef: RefObject<number> }) {
  const points = useRef<THREE.Points>(null);
  const material = useRef<THREE.PointsMaterial>(null);
  // The simulation arrays live on geometry.userData so the frame loop can
  // advance them without mutating render-time values.
  const geometry = useMemo(() => {
    const rand = mulberry32(7);
    const count = 900;
    const positions = new Float32Array(count * 3);
    const radii = new Float32Array(count);
    const angles = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      radii[i] = 0.15 + Math.pow(rand(), 0.7) * 1.45;
      angles[i] = rand() * Math.PI * 2;
      positions[i * 3 + 2] = (rand() - 0.5) * 0.25;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.userData = { radii, angles };
    return geometry;
  }, []);

  useFrame((_, delta) => {
    const p = points.current;
    if (!p) return;
    const pos = p.geometry.attributes.position as THREE.BufferAttribute;
    const { radii, angles } = p.geometry.userData as { radii: Float32Array; angles: Float32Array };
    const speed = speedRef.current ?? 1;
    for (let i = 0; i < radii.length; i++) {
      angles[i] += (delta * speed * 0.9) / (radii[i] + 0.3);
      pos.setXY(i, Math.cos(angles[i]) * radii[i], Math.sin(angles[i]) * radii[i]);
    }
    pos.needsUpdate = true;
    if (material.current && colorRef.current) material.current.color.copy(colorRef.current);
  });

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial
        ref={material}
        size={0.035}
        transparent
        opacity={0.85}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

function Gate({ status, pulse }: { status: PortalStatus; pulse: number }) {
  const group = useRef<THREE.Group>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  const ringC = useRef<THREE.Mesh>(null);
  const wave = useRef<THREE.Mesh>(null);
  const colorA = useRef(new THREE.Color(COLORS.idle[0]));
  const colorB = useRef(new THREE.Color(COLORS.idle[1]));
  const speed = useRef(1);
  const pulseState = useRef({ seen: pulse, t: 1 });
  const shake = useRef(0);
  const targetA = useMemo(() => new THREE.Color(), []);
  const targetB = useMemo(() => new THREE.Color(), []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    targetA.set(COLORS[status][0]);
    targetB.set(COLORS[status][1]);
    colorA.current.lerp(targetA, 1 - Math.exp(-6 * dt));
    colorB.current.lerp(targetB, 1 - Math.exp(-6 * dt));

    // New result → trigger a shockwave (and a shake for rejections)
    if (pulseState.current.seen !== pulse) {
      pulseState.current = { seen: pulse, t: 0 };
      if (status !== "SUCCESS") shake.current = 1;
    }
    pulseState.current.t = Math.min(pulseState.current.t + dt / 1.1, 1);
    const p = pulseState.current.t;

    const targetSpeed = status === "busy" ? 4 : status === "SUCCESS" ? 2.6 : status === "idle" ? 1 : 0.4;
    speed.current = THREE.MathUtils.damp(speed.current, targetSpeed, 3, dt);
    shake.current = THREE.MathUtils.damp(shake.current, 0, 5, dt);

    if (group.current) {
      group.current.position.x = Math.sin(t * 60) * 0.08 * shake.current;
      group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, state.pointer.y * -0.25, 3, dt);
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, state.pointer.x * 0.35, 3, dt);
    }
    if (ringA.current) {
      ringA.current.rotation.z += dt * 0.6 * speed.current;
      (ringA.current.material as THREE.MeshBasicMaterial).color.copy(colorA.current);
      ringA.current.scale.setScalar(1 + Math.sin(p * Math.PI) * 0.08);
    }
    if (ringB.current) {
      ringB.current.rotation.z -= dt * 0.9 * speed.current;
      ringB.current.rotation.x = 0.3 + Math.sin(t * 0.7) * 0.15;
      (ringB.current.material as THREE.MeshBasicMaterial).color.copy(colorB.current);
    }
    if (ringC.current) {
      ringC.current.rotation.z += dt * 1.4 * speed.current;
      ringC.current.rotation.y = Math.sin(t * 0.5) * 0.4;
      (ringC.current.material as THREE.MeshBasicMaterial).color.copy(colorA.current);
    }
    if (wave.current) {
      const m = wave.current.material as THREE.MeshBasicMaterial;
      wave.current.scale.setScalar(1 + p * 0.36);
      m.opacity = Math.pow(1 - p, 1.5) * 0.95;
      m.color.copy(colorA.current);
    }
  });

  return (
    <group ref={group}>
      <mesh ref={ringA}>
        <torusGeometry args={[1.7, 0.05, 24, 160]} />
        <meshBasicMaterial toneMapped={false} />
      </mesh>
      <mesh ref={ringB}>
        <torusGeometry args={[1.95, 0.012, 16, 160]} />
        <meshBasicMaterial toneMapped={false} transparent opacity={0.8} />
      </mesh>
      <mesh ref={ringC} rotation={[0.9, 0, 0]}>
        <torusGeometry args={[2.2, 0.008, 16, 160, Math.PI * 1.4]} />
        <meshBasicMaterial toneMapped={false} transparent opacity={0.6} />
      </mesh>
      <mesh ref={wave}>
        <ringGeometry args={[1.66, 1.78, 96]} />
        <meshBasicMaterial
          toneMapped={false}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <Vortex colorRef={colorB} speedRef={speed} />
    </group>
  );
}

export default function PortalScene({ status, pulse }: { status: PortalStatus; pulse: number }) {
  return (
    <Canvas
      dpr={[1, 1.8]}
      camera={{ position: [0, 0, 6], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
      fallback={
        <div className="h-full w-full rounded-full bg-[radial-gradient(circle,rgba(124,92,255,0.35),transparent_65%)]" />
      }
    >
      <Gate status={status} pulse={pulse} />
      <Sparkles count={40} scale={[6, 6, 3]} size={2} speed={0.4} opacity={0.6} color="#c4b5fd" />
    </Canvas>
  );
}
