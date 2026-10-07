"use client";

import { Environment, Float, Lightformer, RoundedBox, Sparkles } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import QRCode from "qrcode";
import { useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import { clamp01, easeOutCubic, mulberry32, smoothstep } from "./random";

type ProgressRef = RefObject<number>;

const SPACING = 0.17;
const VOXEL = 0.148;
const STOPS = ["#7c5cff", "#22d3ee", "#f472b6"].map((c) => new THREE.Color(c));

function gradientAt(t: number, out: THREE.Color) {
  const scaled = clamp01(t) * (STOPS.length - 1);
  const i = Math.min(Math.floor(scaled), STOPS.length - 2);
  return out.copy(STOPS[i]).lerp(STOPS[i + 1], scaled - i);
}

/**
 * A real, scannable QR code built from ~200 instanced voxels. On load the
 * voxels warp in from deep space and lock into place; scrolling down bursts
 * them into a cloud and scrolling back up re-assembles the code.
 */
function VoxelQR({ scroll, reduced }: { scroll: ProgressRef; reduced: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const beam = useRef<THREE.Group>(null);
  const beamMat = useRef<THREE.MeshBasicMaterial>(null);
  const glowMat = useRef<THREE.MeshBasicMaterial>(null);
  const corners = useRef<THREE.Group>(null);
  const startedAt = useRef<number | null>(null);
  const smooth = useRef(0);

  const voxels = useMemo(() => {
    const qr = QRCode.create("EE-7K2M-Q9XD", { errorCorrectionLevel: "L" });
    const size = qr.modules.size;
    const half = (size - 1) / 2;
    const rand = mulberry32(42);
    const cells: Array<[number, number]> = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (qr.modules.get(y, x)) cells.push([x, y]);
      }
    }
    const count = cells.length;
    const target = new Float32Array(count * 3);
    const origin = new Float32Array(count * 3);
    const scatter = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    cells.forEach(([x, y], i) => {
      const tx = (x - half) * SPACING;
      const ty = (half - y) * SPACING;
      target.set([tx, ty, 0], i * 3);
      // Intro: start far behind the code, loosely spread out
      origin.set([tx * 2.6 + (rand() - 0.5) * 3, ty * 2.6 + (rand() - 0.5) * 3, -10 - rand() * 8], i * 3);
      // Scroll: burst outward from the code's own layout into a cloud that stays behind the text
      const angle = Math.atan2(ty, tx) + (rand() - 0.5) * 1.2;
      const radius = 1.6 + rand() * 2.6;
      const cx = Math.cos(angle) * radius * 1.25;
      // Voxels heading left (toward the headline) travel much less far.
      scatter.set([cx < 0 ? cx * 0.3 : cx, Math.sin(angle) * radius + 0.8, -1.5 - rand() * 3], i * 3);
      seed[i] = rand();
    });
    return { size, half: half * SPACING, count, target, origin, scatter, seed, cells };
  }, []);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const c = new THREE.Color();
    voxels.cells.forEach(([x, y], i) => {
      gradientAt((x + y) / (2 * (voxels.size - 1)), c);
      m.setColorAt(i, c);
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [voxels]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state, delta) => {
    const m = mesh.current;
    if (!m) return;
    const now = state.clock.elapsedTime;
    if (startedAt.current === null) startedAt.current = now;
    // Time-based intro so it finishes on schedule even on slow GPUs.
    const intro = reduced ? 1 : clamp01((now - startedAt.current - 0.15) / 2.2);
    smooth.current = THREE.MathUtils.damp(smooth.current, scroll.current ?? 0, 5, Math.min(delta, 0.05));
    const burst = smoothstep(0.02, 0.75, smooth.current);
    const t = reduced ? 0 : now;
    const { target, origin, scatter, seed, count } = voxels;

    for (let i = 0; i < count; i++) {
      const s = seed[i];
      const kIn = easeOutCubic(clamp01((intro - s * 0.45) / 0.55));
      const kOut = smoothstep(0, 1, clamp01(burst * 1.35 - s * 0.35));
      const i3 = i * 3;
      const tx = target[i3];
      const ty = target[i3 + 1];
      const wave = Math.sin(t * 1.6 + tx * 1.9 + ty * 1.3) * 0.08 * kIn * (1 - kOut);
      const bx = origin[i3] + (tx - origin[i3]) * kIn;
      const by = origin[i3 + 1] + (ty - origin[i3 + 1]) * kIn;
      const bz = origin[i3 + 2] + (0 - origin[i3 + 2]) * kIn + wave;
      dummy.position.set(
        bx + (scatter[i3] - bx) * kOut,
        by + (scatter[i3 + 1] - by) * kOut,
        bz + (scatter[i3 + 2] - bz) * kOut,
      );
      const spin = (1 - kIn) * s * 9 + kOut * (s * 6 + t * 0.8);
      dummy.rotation.set(spin, spin * 0.7, spin * 0.4);
      dummy.scale.setScalar((0.25 + 0.75 * kIn) * (1 - 0.3 * kOut));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;

    const assembled = smoothstep(0.7, 1, intro) * (1 - smoothstep(0, 0.25, burst));
    // Scanner beam sweeps the assembled code
    if (beam.current && beamMat.current && glowMat.current) {
      beam.current.position.y = Math.sin(t * 1.15) * (voxels.half + 0.15);
      beamMat.current.opacity = 0.95 * assembled;
      glowMat.current.opacity = 0.5 * assembled;
    }
    if (corners.current) {
      corners.current.scale.setScalar(0.85 + 0.15 * assembled + Math.sin(t * 2) * 0.01);
      corners.current.children.forEach((child) => {
        ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = assembled;
      });
    }
  });

  const glowTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, "rgba(34,211,238,0)");
    g.addColorStop(0.5, "rgba(34,211,238,1)");
    g.addColorStop(1, "rgba(34,211,238,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 128);
    return new THREE.CanvasTexture(canvas);
  }, []);

  const extent = voxels.half * 2 + 0.7;
  const arm = 0.55;
  // Viewfinder brackets around the code: two thin bars per corner.
  const cornerBars = [
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
  ].flatMap(([sx, sy]) => {
    const x = sx * (extent / 2);
    const y = sy * (extent / 2);
    return [
      { key: `${sx}${sy}h`, position: [x - (sx * arm) / 2, y, 0] as const, size: [arm, 0.035, 0.035] as const },
      { key: `${sx}${sy}v`, position: [x, y - (sy * arm) / 2, 0] as const, size: [0.035, arm, 0.035] as const },
    ];
  });

  return (
    <group>
      <instancedMesh ref={mesh} args={[undefined, undefined, voxels.count]} frustumCulled={false}>
        <boxGeometry args={[VOXEL, VOXEL, VOXEL]} />
        <meshPhysicalMaterial roughness={0.18} metalness={0.35} clearcoat={1} clearcoatRoughness={0.15} />
      </instancedMesh>

      <group ref={corners}>
        {cornerBars.map((bar) => (
          <mesh key={bar.key} position={[...bar.position]}>
            <boxGeometry args={[...bar.size]} />
            <meshBasicMaterial color="#9be8ff" transparent toneMapped={false} />
          </mesh>
        ))}
      </group>

      <group ref={beam} position={[0, 0, 0.14]}>
        <mesh>
          <planeGeometry args={[extent - 0.2, 0.022]} />
          <meshBasicMaterial
            ref={beamMat}
            color="#c8f6ff"
            transparent
            toneMapped={false}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <mesh>
          <planeGeometry args={[extent - 0.2, 0.7]} />
          <meshBasicMaterial
            ref={glowMat}
            map={glowTexture}
            transparent
            toneMapped={false}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}

function OrbitRings({ reduced }: { reduced: boolean }) {
  const a = useRef<THREE.Group>(null);
  const b = useRef<THREE.Group>(null);
  const c = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (reduced) return;
    const dt = Math.min(delta, 0.05);
    if (a.current) a.current.rotation.z += dt * 0.25;
    if (b.current) b.current.rotation.z -= dt * 0.18;
    if (c.current) c.current.rotation.z += dt * 0.4;
  });
  return (
    <group>
      <group rotation={[1.2, 0.3, 0]}>
        <group ref={a}>
          <mesh>
            <torusGeometry args={[2.75, 0.012, 16, 220]} />
            <meshBasicMaterial color="#a78bfa" toneMapped={false} transparent opacity={0.8} />
          </mesh>
          <mesh position={[2.75, 0, 0]}>
            <sphereGeometry args={[0.07, 24, 24]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        </group>
      </group>
      <group rotation={[-1.05, -0.5, 0.4]}>
        <group ref={b}>
          <mesh>
            <torusGeometry args={[3.05, 0.008, 16, 220]} />
            <meshBasicMaterial color="#22d3ee" toneMapped={false} transparent opacity={0.6} />
          </mesh>
          <mesh position={[-3.05, 0, 0]}>
            <sphereGeometry args={[0.055, 24, 24]} />
            <meshBasicMaterial color="#9be8ff" toneMapped={false} />
          </mesh>
        </group>
      </group>
      <group rotation={[0.2, 1.25, 0]}>
        <group ref={c}>
          <mesh>
            <torusGeometry args={[2.35, 0.006, 16, 200]} />
            <meshBasicMaterial color="#f472b6" toneMapped={false} transparent opacity={0.45} />
          </mesh>
          <mesh position={[0, 2.35, 0]}>
            <sphereGeometry args={[0.045, 24, 24]} />
            <meshBasicMaterial color="#ffd1ec" toneMapped={false} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** Iridescent mini tickets drifting around the code. */
function FloatingTicket({
  position,
  rotation,
  color,
  speed = 1.4,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  color: string;
  speed?: number;
}) {
  return (
    <Float speed={speed} rotationIntensity={1.2} floatIntensity={1.4}>
      <group position={position} rotation={rotation}>
        <RoundedBox args={[1.05, 0.58, 0.035]} radius={0.06} smoothness={4}>
          <meshPhysicalMaterial
            color={color}
            metalness={0.55}
            roughness={0.12}
            iridescence={1}
            iridescenceIOR={1.6}
            iridescenceThicknessRange={[150, 900]}
            clearcoat={1}
          />
        </RoundedBox>
        <mesh position={[0.24, 0, 0.02]}>
          <planeGeometry args={[0.012, 0.46]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
        </mesh>
      </group>
    </Float>
  );
}

function Rig({ scroll, reduced, children }: { scroll: ProgressRef; reduced: boolean; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const smooth = useRef(0);
  const { viewport, size } = useThree();
  const wide = size.width >= 1024;
  const baseX = wide ? Math.min(viewport.width * 0.26, 3.6) : 0;
  const baseY = 0;
  const baseScale = wide ? 0.84 : Math.min(0.9, viewport.width / 6.6);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(delta, 0.05);
    smooth.current = THREE.MathUtils.damp(smooth.current, scroll.current ?? 0, 5, dt);
    const s = smooth.current;
    const t = state.clock.elapsedTime;
    const idle = reduced ? 0 : Math.sin(t * 0.35) * 0.18;
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, state.pointer.x * 0.45 + idle + s * 1.4, 3, dt);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, -state.pointer.y * 0.3 + s * 0.5, 3, dt);
    g.position.x = THREE.MathUtils.damp(g.position.x, baseX + s * 0.6, 4, dt);
    g.position.y = THREE.MathUtils.damp(g.position.y, baseY + s * 1.6, 4, dt);
    const sc = baseScale * (1 + s * 0.25);
    g.scale.setScalar(THREE.MathUtils.damp(g.scale.x || sc, sc, 4, dt));
  });

  return <group ref={group}>{children}</group>;
}

export default function HeroScene({
  scroll,
  reduced,
  active,
}: {
  scroll: ProgressRef;
  reduced: boolean;
  active: boolean;
}) {
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.8]}
      camera={{ position: [0, 0, 8.5], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      fallback={
        <div className="h-full w-full bg-[radial-gradient(circle_at_70%_40%,rgba(124,92,255,0.35),transparent_60%)]" />
      }
    >
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 4, 6]} intensity={1.6} color="#ffffff" />
      <pointLight position={[-5, 2, 4]} intensity={60} color="#7c5cff" />
      <pointLight position={[5, -3, 3]} intensity={45} color="#22d3ee" />

      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3} color="#7c5cff" position={[-6, 3, -2]} scale={[10, 6, 1]} />
        <Lightformer form="rect" intensity={2.5} color="#22d3ee" position={[6, -2, -2]} scale={[10, 6, 1]} />
        <Lightformer form="ring" intensity={2} color="#f472b6" position={[0, 5, 4]} scale={4} />
        <Lightformer form="rect" intensity={1.2} color="#ffffff" position={[0, 0, 8]} scale={[6, 6, 1]} />
      </Environment>

      <Rig scroll={scroll} reduced={reduced}>
        <VoxelQR scroll={scroll} reduced={reduced} />
        <OrbitRings reduced={reduced} />
        <FloatingTicket position={[-2.2, -2.1, -1.2]} rotation={[0.3, 0.5, -0.4]} color="#3b2a8f" />
        <FloatingTicket position={[2.5, -1.6, 0.3]} rotation={[-0.4, -0.6, 0.3]} color="#0e5a6e" speed={1.1} />
        <FloatingTicket position={[1.9, 2.2, -1.4]} rotation={[0.2, -0.3, 0.6]} color="#6d1f55" speed={1.7} />
      </Rig>

      <Sparkles count={reduced ? 0 : 90} scale={[14, 9, 6]} size={2.2} speed={0.35} opacity={0.7} color="#c4b5fd" />
      <Sparkles count={reduced ? 0 : 50} scale={[12, 8, 5]} size={1.6} speed={0.25} opacity={0.6} color="#67e8f9" />
    </Canvas>
  );
}
