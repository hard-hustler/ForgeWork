import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { STATUS_COLORS } from '../data/catalog';
import { liveEntitiesRef, useFactoryStore } from '../state/useFactoryStore';
import { MachineEntity } from '../types/factory';
import { getConveyorBeltTexture } from './textures';

const MAX_BELTS = 2048;
const MAX_ENTITIES = 4096;

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

// Shared module-level materials so hero machines reuse compiled WebGL programs
const MAT_STEEL_DARK = new THREE.MeshStandardMaterial({
  color: '#334155',
  metalness: 0.6,
  roughness: 0.45,
});
const MAT_STEEL_MID = new THREE.MeshStandardMaterial({
  color: '#475569',
  metalness: 0.72,
  roughness: 0.32,
});
const MAT_STEEL_BRIGHT = new THREE.MeshStandardMaterial({
  color: '#cbd5e1',
  metalness: 0.85,
  roughness: 0.2,
});
const MAT_SLATE_BODY = new THREE.MeshStandardMaterial({
  color: '#1e293b',
  metalness: 0.55,
  roughness: 0.55,
});
const MAT_AMBER = new THREE.MeshStandardMaterial({
  color: '#f59e0b',
  metalness: 0.35,
  roughness: 0.4,
});
const MAT_GOLD = new THREE.MeshStandardMaterial({
  color: '#fbbf24',
  metalness: 0.65,
  roughness: 0.25,
});
const MAT_EXTRACTOR_BASE = new THREE.MeshStandardMaterial({
  color: '#1e3a8a',
  metalness: 0.55,
  roughness: 0.45,
});
const MAT_SMELTER_BASE = new THREE.MeshStandardMaterial({
  color: '#27272a',
  metalness: 0.5,
  roughness: 0.7,
});
const MAT_SMELTER_BODY = new THREE.MeshStandardMaterial({
  color: '#3f3f46',
  metalness: 0.55,
  roughness: 0.48,
});
const MAT_SMELTER_CAP = new THREE.MeshStandardMaterial({
  color: '#52525b',
  metalness: 0.7,
  roughness: 0.3,
});
const MAT_SMELTER_STACK = new THREE.MeshStandardMaterial({
  color: '#18181b',
  metalness: 0.75,
  roughness: 0.35,
});
const MAT_ASSEMBLER = new THREE.MeshStandardMaterial({
  color: '#1d4ed8',
  metalness: 0.45,
  roughness: 0.52,
});
const MAT_SPLITTER = new THREE.MeshStandardMaterial({
  color: '#0284c7',
  metalness: 0.55,
  roughness: 0.32,
});
const MAT_MERGER = new THREE.MeshStandardMaterial({
  color: '#0891b2',
  metalness: 0.55,
  roughness: 0.32,
});
const MAT_STORAGE = new THREE.MeshStandardMaterial({
  color: '#57534e',
  metalness: 0.35,
  roughness: 0.72,
});
const MAT_STORAGE_LID = new THREE.MeshStandardMaterial({
  color: '#44403c',
  metalness: 0.6,
  roughness: 0.4,
});
const MAT_GENERATOR = new THREE.MeshStandardMaterial({
  color: '#713f12',
  metalness: 0.45,
  roughness: 0.55,
});
const MAT_POLE_MAST = new THREE.MeshStandardMaterial({
  color: '#64748b',
  metalness: 0.78,
  roughness: 0.28,
});
const MAT_POLE_BAR = new THREE.MeshStandardMaterial({
  color: '#94a3b8',
  metalness: 0.72,
  roughness: 0.28,
});
const MAT_INSPECTOR_ARCH = new THREE.MeshStandardMaterial({
  color: '#0f766e',
  metalness: 0.5,
  roughness: 0.4,
});
const MAT_INSPECTOR_TOP = new THREE.MeshStandardMaterial({
  color: '#14b8a6',
  metalness: 0.55,
  roughness: 0.3,
});
const MAT_DOCK_BASE = new THREE.MeshStandardMaterial({
  color: '#065f46',
  metalness: 0.42,
  roughness: 0.58,
});
const MAT_DOCK_TOP = new THREE.MeshStandardMaterial({
  color: '#10b981',
  metalness: 0.35,
  roughness: 0.35,
});
const MAT_DOCK_BEACON = new THREE.MeshStandardMaterial({
  color: '#34d399',
  emissive: '#10b981',
  emissiveIntensity: 1.5,
});
const MAT_LASER = new THREE.MeshBasicMaterial({ color: '#2dd4bf' });
const MAT_POLE_WIRE = new THREE.MeshBasicMaterial({ color: '#c084fc' });
const MAT_POLE_INSULATOR_ON = new THREE.MeshStandardMaterial({
  color: '#c084fc',
  emissive: '#a855f7',
  emissiveIntensity: 1.8,
});
const MAT_GEN_COIL_ON = new THREE.MeshStandardMaterial({
  color: '#38bdf8',
  emissive: '#0284c7',
  emissiveIntensity: 1.5,
});
const MAT_STORAGE_BAR = new THREE.MeshStandardMaterial({
  color: '#10b981',
  emissive: '#059669',
  emissiveIntensity: 0.65,
});
const MAT_SPLITTER_ARROW = new THREE.MeshStandardMaterial({
  color: '#fbbf24',
  emissive: '#d97706',
  emissiveIntensity: 0.45,
});

const HeroMachineItem: React.FC<{
  entity: MachineEntity;
  onSelect: (id: number) => void;
  beltTex: THREE.CanvasTexture;
}> = React.memo(({ entity, onSelect, beltTex }) => {
  const drillRef = useRef<THREE.Mesh>(null);
  const gear1Ref = useRef<THREE.Group>(null);
  const gear2Ref = useRef<THREE.Group>(null);
  const pistonRef = useRef<THREE.Mesh>(null);
  const furnaceCoreRef = useRef<THREE.Mesh>(null);
  const armBaseRef = useRef<THREE.Group>(null);
  const flywheelRef = useRef<THREE.Mesh>(null);
  const laserRef = useRef<THREE.Mesh>(null);
  const beaconRef = useRef<THREE.Mesh>(null);
  const storageBarRef = useRef<THREE.Mesh>(null);

  const rotY = -entity.rot * (Math.PI / 2);

  useFrame(({ clock }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const t = clock.getElapsedTime();
    const live = liveEntitiesRef.byId.get(entity.id) ?? entity;
    const activeSpeed =
      live.status === 'working' ? Math.max(0.25, live.powerSatisfaction) : 0;

    if (drillRef.current && entity.type === 'extractor') {
      drillRef.current.rotation.y += delta * 6.5 * activeSpeed;
      drillRef.current.position.y = 0.44 + Math.sin(t * 7 * activeSpeed) * 0.07;
    }

    if (gear1Ref.current && gear2Ref.current && entity.type === 'assembler') {
      gear1Ref.current.rotation.y += delta * 3.0 * activeSpeed;
      gear2Ref.current.rotation.y -= delta * 3.0 * activeSpeed;
    }

    if (pistonRef.current && entity.type === 'assembler') {
      pistonRef.current.position.y =
        0.8 + Math.sin(t * 5.5 * activeSpeed) * 0.13;
    }

    if (furnaceCoreRef.current && entity.type === 'smelter') {
      const mat = furnaceCoreRef.current.material as THREE.MeshStandardMaterial;
      const flicker =
        live.powerSatisfaction < 0.92
          ? 0.35 + Math.abs(Math.sin(t * 22 + entity.id)) * 1.2
          : 1.6 + Math.sin(t * 4.5 + entity.id) * 0.35;
      mat.emissiveIntensity = live.status === 'working' ? flicker : 0.15;
    }

    if (armBaseRef.current && entity.type === 'inserter') {
      const swing = (live.inserterHolding ? live.inserterProgress : 0) * Math.PI;
      armBaseRef.current.rotation.y = Math.PI - swing;
    }

    if (flywheelRef.current && entity.type === 'generator') {
      flywheelRef.current.rotation.x += delta * 4.8 * (live.fuel > 0 ? 1 : 0);
    }

    if (laserRef.current && entity.type === 'inspector') {
      laserRef.current.position.z = Math.sin(t * 4.5) * 0.24;
    }

    if (beaconRef.current && entity.type === 'shipping_dock') {
      beaconRef.current.rotation.y += delta * 3.8;
    }

    if (storageBarRef.current && entity.type === 'storage') {
      let fill = 0;
      for (const v of Object.values(live.outputBuffer)) fill += v ?? 0;
      const ratio = Math.max(0.12, Math.min(1, fill / 40));
      storageBarRef.current.scale.y = ratio;
      storageBarRef.current.position.y = 0.12 + ratio * 0.24;
    }
  });

  return (
    <group
      position={[entity.x + 0.5, 0, entity.z + 0.5]}
      rotation={[0, rotY, 0]}
      onClick={(ev) => {
        ev.stopPropagation();
        onSelect(entity.id);
      }}
    >
      {(entity.type === 'conveyor_splitter' ||
        entity.type === 'conveyor_merger') && (
        <group>
          <mesh
            position={[0, 0.14, 0]}
            castShadow
            receiveShadow
            material={MAT_SLATE_BODY}
          >
            <boxGeometry args={[0.92, 0.22, 0.92]} />
          </mesh>
          <mesh
            position={[0, 0.32, 0]}
            castShadow
            receiveShadow
            material={
              entity.type === 'conveyor_splitter' ? MAT_SPLITTER : MAT_MERGER
            }
          >
            <boxGeometry args={[0.82, 0.22, 0.82]} />
          </mesh>
          <mesh position={[0, 0.45, -0.18]} material={MAT_SPLITTER_ARROW}>
            <boxGeometry args={[0.38, 0.06, 0.28]} />
          </mesh>
          <mesh position={[0, 0.45, 0.22]} material={MAT_STEEL_BRIGHT}>
            <boxGeometry args={[0.56, 0.05, 0.12]} />
          </mesh>
        </group>
      )}

      {entity.type === 'extractor' && (
        <group>
          <mesh
            position={[0, 0.15, 0]}
            castShadow
            receiveShadow
            material={MAT_EXTRACTOR_BASE}
          >
            <boxGeometry args={[0.88, 0.28, 0.88]} />
          </mesh>
          <mesh
            position={[-0.33, 0.56, -0.32]}
            castShadow
            material={MAT_STEEL_MID}
          >
            <boxGeometry args={[0.12, 0.82, 0.12]} />
          </mesh>
          <mesh
            position={[0.33, 0.56, -0.32]}
            castShadow
            material={MAT_STEEL_MID}
          >
            <boxGeometry args={[0.12, 0.82, 0.12]} />
          </mesh>
          <mesh
            position={[0, 0.94, -0.12]}
            castShadow
            material={MAT_AMBER}
          >
            <boxGeometry args={[0.78, 0.16, 0.54]} />
          </mesh>
          <mesh position={[0, 0.2, 0.42]} material={MAT_STEEL_DARK}>
            <boxGeometry args={[0.42, 0.18, 0.12]} />
          </mesh>
          <mesh
            ref={drillRef}
            position={[0, 0.45, 0]}
            castShadow
            material={MAT_STEEL_BRIGHT}
          >
            <coneGeometry args={[0.23, 0.58, 6]} />
          </mesh>
        </group>
      )}

      {entity.type === 'smelter' && (
        <group>
          <mesh
            position={[0, 0.12, 0]}
            castShadow
            receiveShadow
            material={MAT_SMELTER_BASE}
          >
            <boxGeometry args={[0.92, 0.24, 0.92]} />
          </mesh>
          <mesh
            position={[0, 0.48, 0]}
            castShadow
            receiveShadow
            material={MAT_SMELTER_BODY}
          >
            <boxGeometry args={[0.84, 0.54, 0.84]} />
          </mesh>
          <mesh position={[0, 0.78, 0]} castShadow material={MAT_SMELTER_CAP}>
            <boxGeometry args={[0.72, 0.12, 0.72]} />
          </mesh>
          <mesh
            position={[0.22, 1.04, -0.2]}
            castShadow
            material={MAT_SMELTER_STACK}
          >
            <cylinderGeometry args={[0.13, 0.18, 0.54, 10]} />
          </mesh>
          <mesh ref={furnaceCoreRef} position={[0, 0.44, 0.39]}>
            <boxGeometry args={[0.5, 0.34, 0.12]} />
            <meshStandardMaterial
              color="#fb923c"
              emissive="#ea580c"
              emissiveIntensity={1.6}
              roughness={0.2}
            />
          </mesh>
        </group>
      )}

      {entity.type === 'assembler' && (
        <group>
          <mesh
            position={[0, 0.28, 0]}
            castShadow
            receiveShadow
            material={MAT_ASSEMBLER}
          >
            <boxGeometry args={[0.9, 0.54, 0.9]} />
          </mesh>
          <mesh position={[0, 0.57, 0]} material={MAT_SLATE_BODY}>
            <boxGeometry args={[0.78, 0.06, 0.78]} />
          </mesh>
          <group ref={gear1Ref} position={[-0.19, 0.65, -0.06]}>
            <mesh castShadow material={MAT_STEEL_BRIGHT}>
              <cylinderGeometry args={[0.18, 0.18, 0.09, 8]} />
            </mesh>
            <mesh material={MAT_STEEL_BRIGHT}>
              <boxGeometry args={[0.42, 0.07, 0.07]} />
            </mesh>
          </group>
          <group ref={gear2Ref} position={[0.19, 0.65, -0.06]}>
            <mesh castShadow material={MAT_AMBER}>
              <cylinderGeometry args={[0.17, 0.17, 0.09, 8]} />
            </mesh>
            <mesh material={MAT_AMBER}>
              <boxGeometry args={[0.38, 0.07, 0.07]} />
            </mesh>
          </group>
          <mesh
            ref={pistonRef}
            position={[0, 0.8, 0.24]}
            castShadow
            material={MAT_POLE_BAR}
          >
            <cylinderGeometry args={[0.09, 0.09, 0.38, 10]} />
          </mesh>
        </group>
      )}

      {entity.type === 'inserter' && (
        <group>
          <mesh
            position={[0, 0.07, 0]}
            castShadow
            receiveShadow
            material={MAT_STEEL_DARK}
          >
            <boxGeometry args={[0.62, 0.12, 0.62]} />
          </mesh>
          <mesh position={[0, 0.2, 0]} castShadow material={MAT_STEEL_MID}>
            <cylinderGeometry args={[0.22, 0.28, 0.18, 10]} />
          </mesh>
          <group ref={armBaseRef} position={[0, 0.31, 0]}>
            <mesh
              position={[0, 0.18, -0.17]}
              rotation={[0.45, 0, 0]}
              castShadow
              material={MAT_AMBER}
            >
              <boxGeometry args={[0.11, 0.42, 0.11]} />
            </mesh>
            <mesh
              position={[0, 0.34, -0.35]}
              rotation={[1.2, 0, 0]}
              castShadow
              material={MAT_GOLD}
            >
              <boxGeometry args={[0.08, 0.36, 0.08]} />
            </mesh>
            <mesh position={[0, 0.35, -0.48]} material={MAT_STEEL_BRIGHT}>
              <boxGeometry args={[0.18, 0.06, 0.1]} />
            </mesh>
          </group>
        </group>
      )}

      {entity.type === 'storage' && (
        <group>
          <mesh
            position={[0, 0.34, 0]}
            castShadow
            receiveShadow
            material={MAT_STORAGE}
          >
            <boxGeometry args={[0.86, 0.66, 0.86]} />
          </mesh>
          <mesh position={[0, 0.69, 0]} material={MAT_STORAGE_LID}>
            <boxGeometry args={[0.9, 0.07, 0.9]} />
          </mesh>
          <mesh
            ref={storageBarRef}
            position={[0, 0.28, 0.45]}
            material={MAT_STORAGE_BAR}
          >
            <boxGeometry args={[0.58, 0.48, 0.04]} />
          </mesh>
        </group>
      )}

      {entity.type === 'generator' && (
        <group>
          <mesh
            position={[0, 0.32, 0]}
            castShadow
            receiveShadow
            material={MAT_GENERATOR}
          >
            <boxGeometry args={[0.9, 0.62, 0.9]} />
          </mesh>
          <mesh
            ref={flywheelRef}
            position={[0, 0.68, 0]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
            material={MAT_GOLD}
          >
            <cylinderGeometry args={[0.29, 0.29, 0.28, 12]} />
          </mesh>
          <mesh position={[0.29, 0.72, -0.28]} material={MAT_GEN_COIL_ON}>
            <cylinderGeometry args={[0.08, 0.08, 0.36, 8]} />
          </mesh>
          <mesh
            position={[-0.29, 0.74, -0.28]}
            castShadow
            material={MAT_SMELTER_BASE}
          >
            <cylinderGeometry args={[0.09, 0.11, 0.42, 8]} />
          </mesh>
        </group>
      )}

      {entity.type === 'power_pole' && (
        <group>
          <mesh position={[0, 0.1, 0]} castShadow material={MAT_STEEL_DARK}>
            <boxGeometry args={[0.38, 0.2, 0.38]} />
          </mesh>
          <mesh position={[0, 0.98, 0]} castShadow material={MAT_POLE_MAST}>
            <cylinderGeometry args={[0.06, 0.1, 1.76, 6]} />
          </mesh>
          <mesh position={[0, 1.72, 0]} castShadow material={MAT_POLE_BAR}>
            <boxGeometry args={[0.7, 0.08, 0.1]} />
          </mesh>
          <mesh position={[-0.28, 1.8, 0]} material={MAT_POLE_INSULATOR_ON}>
            <sphereGeometry args={[0.07, 8, 8]} />
          </mesh>
          <mesh position={[0.28, 1.8, 0]} material={MAT_POLE_INSULATOR_ON}>
            <sphereGeometry args={[0.07, 8, 8]} />
          </mesh>
        </group>
      )}

      {entity.type === 'inspector' && (
        <group>
          <mesh
            position={[0, 0.11, 0]}
            receiveShadow
            castShadow
            material={MAT_SLATE_BODY}
          >
            <boxGeometry args={[0.88, 0.16, 0.98]} />
          </mesh>
          <mesh position={[0, 0.205, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.7, 0.98]} />
            <meshStandardMaterial
              color="#ffffff"
              map={beltTex}
              roughness={0.75}
            />
          </mesh>
          <mesh
            position={[-0.36, 0.52, 0]}
            castShadow
            material={MAT_INSPECTOR_ARCH}
          >
            <boxGeometry args={[0.12, 0.74, 0.34]} />
          </mesh>
          <mesh
            position={[0.36, 0.52, 0]}
            castShadow
            material={MAT_INSPECTOR_ARCH}
          >
            <boxGeometry args={[0.12, 0.74, 0.34]} />
          </mesh>
          <mesh
            position={[0, 0.87, 0]}
            castShadow
            material={MAT_INSPECTOR_TOP}
          >
            <boxGeometry args={[0.86, 0.14, 0.36]} />
          </mesh>
          <mesh ref={laserRef} position={[0, 0.5, 0]} material={MAT_LASER}>
            <boxGeometry args={[0.62, 0.04, 0.04]} />
          </mesh>
        </group>
      )}

      {entity.type === 'shipping_dock' && (
        <group>
          <mesh
            position={[0, 0.24, 0]}
            castShadow
            receiveShadow
            material={MAT_DOCK_BASE}
          >
            <boxGeometry args={[0.94, 0.46, 0.94]} />
          </mesh>
          <mesh
            position={[0, 0.55, 0.22]}
            castShadow
            material={MAT_DOCK_TOP}
          >
            <boxGeometry args={[0.78, 0.16, 0.38]} />
          </mesh>
          <mesh position={[0, 0.52, -0.22]} material={MAT_AMBER}>
            <boxGeometry args={[0.64, 0.08, 0.28]} />
          </mesh>
          <mesh
            ref={beaconRef}
            position={[0.32, 0.68, -0.32]}
            material={MAT_DOCK_BEACON}
          >
            <boxGeometry args={[0.14, 0.22, 0.14]} />
          </mesh>
        </group>
      )}
    </group>
  );
});

export const MachineMeshes: React.FC = () => {
  const topologyEntities = useFactoryStore((s) => s.topologyEntities);
  const selectedEntityId = useFactoryStore((s) => s.selectedEntityId);
  const bottleneckId = useFactoryStore((s) => s.metrics.bottleneckMachineId);
  const selectEntity = useFactoryStore((s) => s.selectEntity);
  const speed = useFactoryStore((s) => s.speed);

  const { gl } = useThree();
  const maxAniso = useMemo(
    () => Math.min(8, gl.capabilities.getMaxAnisotropy()),
    [gl]
  );
  const beltTex = useMemo(() => getConveyorBeltTexture(maxAniso), [maxAniso]);

  // Partition conveyors (instanced) vs animated hero machines
  const { straightBelts, cornerBelts, heroMachines } = useMemo(() => {
    const straight: MachineEntity[] = [];
    const corner: MachineEntity[] = [];
    const heroes: MachineEntity[] = [];
    for (const e of topologyEntities) {
      if (e.type === 'conveyor_straight') straight.push(e);
      else if (e.type === 'conveyor_corner') corner.push(e);
      else heroes.push(e);
    }
    return { straightBelts: straight, cornerBelts: corner, heroMachines: heroes };
  }, [topologyEntities]);

  const straightBodyRef = useRef<THREE.InstancedMesh>(null);
  const straightRailLRef = useRef<THREE.InstancedMesh>(null);
  const straightRailRRef = useRef<THREE.InstancedMesh>(null);
  const straightTopRef = useRef<THREE.InstancedMesh>(null);

  const cornerBaseRef = useRef<THREE.InstancedMesh>(null);
  const cornerGuardRef = useRef<THREE.InstancedMesh>(null);
  const cornerTopRef = useRef<THREE.InstancedMesh>(null);

  const shadowInstRef = useRef<THREE.InstancedMesh>(null);
  const orbInstRef = useRef<THREE.InstancedMesh>(null);
  const bottleneckRingRef = useRef<THREE.Mesh>(null);

  // Update instanced conveyors & contact shadows ONLY when topology changes
  useLayoutEffect(() => {
    const sBody = straightBodyRef.current;
    const sRailL = straightRailLRef.current;
    const sRailR = straightRailRRef.current;
    const sTop = straightTopRef.current;
    if (sBody && sRailL && sRailR && sTop) {
      const n = Math.min(MAX_BELTS, straightBelts.length);
      sBody.count = n;
      sRailL.count = n;
      sRailR.count = n;
      sTop.count = n;
      for (let i = 0; i < n; i++) {
        const b = straightBelts[i];
        const rotY = -b.rot * (Math.PI / 2);
        const cx = b.x + 0.5;
        const cz = b.z + 0.5;
        const cosR = Math.cos(rotY);
        const sinR = Math.sin(rotY);

        _dummy.position.set(cx, 0.11, cz);
        _dummy.rotation.set(0, rotY, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        sBody.setMatrixAt(i, _dummy.matrix);

        _dummy.position.set(cx - 0.41 * cosR, 0.21, cz + 0.41 * sinR);
        _dummy.rotation.set(0, rotY, 0);
        _dummy.updateMatrix();
        sRailL.setMatrixAt(i, _dummy.matrix);

        _dummy.position.set(cx + 0.41 * cosR, 0.21, cz - 0.41 * sinR);
        _dummy.rotation.set(0, rotY, 0);
        _dummy.updateMatrix();
        sRailR.setMatrixAt(i, _dummy.matrix);

        _dummy.position.set(cx, 0.205, cz);
        _dummy.rotation.set(-Math.PI / 2, 0, rotY);
        _dummy.updateMatrix();
        sTop.setMatrixAt(i, _dummy.matrix);
      }
      sBody.instanceMatrix.needsUpdate = true;
      sRailL.instanceMatrix.needsUpdate = true;
      sRailR.instanceMatrix.needsUpdate = true;
      sTop.instanceMatrix.needsUpdate = true;
    }

    const cBase = cornerBaseRef.current;
    const cGuard = cornerGuardRef.current;
    const cTop = cornerTopRef.current;
    if (cBase && cGuard && cTop) {
      const n = Math.min(MAX_BELTS, cornerBelts.length);
      cBase.count = n;
      cGuard.count = n;
      cTop.count = n;
      for (let i = 0; i < n; i++) {
        const b = cornerBelts[i];
        const rotY = -b.rot * (Math.PI / 2);
        const cx = b.x + 0.5;
        const cz = b.z + 0.5;
        const flip = b.cornerFlip ? -1 : 1;

        _dummy.position.set(cx, 0.11, cz);
        _dummy.rotation.set(0, rotY, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        cBase.setMatrixAt(i, _dummy.matrix);

        const gx = -0.36 * flip;
        const cosR = Math.cos(rotY);
        const sinR = Math.sin(rotY);
        _dummy.position.set(cx + gx * cosR, 0.22, cz - gx * sinR);
        _dummy.rotation.set(0, rotY, 0);
        _dummy.updateMatrix();
        cGuard.setMatrixAt(i, _dummy.matrix);

        _dummy.position.set(cx, 0.205, cz);
        _dummy.rotation.set(-Math.PI / 2, 0, rotY - (Math.PI / 2) * flip);
        _dummy.updateMatrix();
        cTop.setMatrixAt(i, _dummy.matrix);
      }
      cBase.instanceMatrix.needsUpdate = true;
      cGuard.instanceMatrix.needsUpdate = true;
      cTop.instanceMatrix.needsUpdate = true;
    }

    const shadows = shadowInstRef.current;
    if (shadows) {
      const n = Math.min(MAX_ENTITIES, topologyEntities.length);
      shadows.count = n;
      for (let i = 0; i < n; i++) {
        const e = topologyEntities[i];
        _dummy.position.set(e.x + 0.5, 0.014, e.z + 0.5);
        _dummy.rotation.set(-Math.PI / 2, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        shadows.setMatrixAt(i, _dummy.matrix);
      }
      shadows.instanceMatrix.needsUpdate = true;
    }
  }, [straightBelts, cornerBelts, topologyEntities]);

  // Animate belt chevron texture, instanced status indicator orbs, and pulsing bottleneck ring
  useFrame(({ clock }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const t = clock.getElapsedTime();

    if (speed > 0) {
      beltTex.offset.y -= delta * Math.min(4, 1.45 * Math.sqrt(speed));
    }

    const orbs = orbInstRef.current;
    if (orbs) {
      const list = liveEntitiesRef.list;
      let count = 0;
      for (let i = 0; i < list.length && count < MAX_ENTITIES; i++) {
        const e = list[i];
        // Show floating status orbs above active machines (keep straight/corner belts sleek)
        if (e.type === 'conveyor_straight' || e.type === 'conveyor_corner') {
          continue;
        }
        const y = e.type === 'power_pole' ? 2.06 : 1.18;
        const pulse = e.status === 'broken' ? 1.15 + Math.sin(t * 10) * 0.25 : 1;
        _dummy.position.set(e.x + 0.5, y, e.z + 0.5);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(pulse, pulse, pulse);
        _dummy.updateMatrix();
        orbs.setMatrixAt(count, _dummy.matrix);
        _color.set(STATUS_COLORS[e.status]);
        orbs.setColorAt(count, _color);
        count++;
      }
      orbs.count = count;
      orbs.instanceMatrix.needsUpdate = true;
      if (orbs.instanceColor) orbs.instanceColor.needsUpdate = true;
    }

    if (bottleneckRingRef.current) {
      const s = 1 + Math.sin(t * 6) * 0.12;
      bottleneckRingRef.current.scale.set(s, s, 1);
    }
  });

  // Overhead power grid cables between connected poles and generators
  const poleEdges = useMemo(() => {
    const poles = topologyEntities.filter((e) => e.type === 'power_pole');
    const gens = topologyEntities.filter((e) => e.type === 'generator');
    const edges: Array<{
      key: string;
      mid: [number, number, number];
      len: number;
      rotY: number;
    }> = [];

    const connect = (
      a: { x: number; z: number; id: number },
      b: { x: number; z: number; id: number },
      ay: number,
      by: number
    ) => {
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      const mid: [number, number, number] = [
        (a.x + b.x) / 2 + 0.5,
        (ay + by) / 2,
        (a.z + b.z) / 2 + 0.5,
      ];
      const rotY = Math.atan2(dx, dz);
      edges.push({ key: `${a.id}-${b.id}`, mid, len, rotY });
    };

    for (let i = 0; i < poles.length; i++) {
      for (let j = i + 1; j < poles.length; j++) {
        if (
          Math.hypot(poles[i].x - poles[j].x, poles[i].z - poles[j].z) <= 7.5
        ) {
          connect(poles[i], poles[j], 1.76, 1.76);
        }
      }
      for (const g of gens) {
        if (Math.hypot(poles[i].x - g.x, poles[i].z - g.z) <= 6.5) {
          connect(poles[i], g, 1.76, 0.88);
        }
      }
    }
    return edges;
  }, [topologyEntities]);

  const selectedEntity = useMemo(
    () => topologyEntities.find((e) => e.id === selectedEntityId) ?? null,
    [topologyEntities, selectedEntityId]
  );

  const bottleneckEntity = useMemo(
    () => topologyEntities.find((e) => e.id === bottleneckId) ?? null,
    [topologyEntities, bottleneckId]
  );

  return (
    <group>
      {/* Instanced Contact Shadows for all entities (1 draw call) */}
      <instancedMesh
        ref={shadowInstRef}
        args={[undefined, undefined, MAX_ENTITIES]}
        frustumCulled={false}
      >
        <circleGeometry args={[0.52, 12]} />
        <meshBasicMaterial
          color="#000000"
          transparent
          opacity={0.34}
          depthWrite={false}
        />
      </instancedMesh>

      {/* Instanced Straight Conveyors (4 draw calls for up to 2,048 belts) */}
      <instancedMesh
        ref={straightBodyRef}
        args={[undefined, undefined, MAX_BELTS]}
        castShadow
        receiveShadow
        frustumCulled={false}
        material={MAT_STEEL_DARK}
      >
        <boxGeometry args={[0.88, 0.16, 0.98]} />
      </instancedMesh>
      <instancedMesh
        ref={straightRailLRef}
        args={[undefined, undefined, MAX_BELTS]}
        frustumCulled={false}
        material={MAT_STEEL_MID}
      >
        <boxGeometry args={[0.06, 0.07, 0.98]} />
      </instancedMesh>
      <instancedMesh
        ref={straightRailRRef}
        args={[undefined, undefined, MAX_BELTS]}
        frustumCulled={false}
        material={MAT_STEEL_MID}
      >
        <boxGeometry args={[0.06, 0.07, 0.98]} />
      </instancedMesh>
      <instancedMesh
        ref={straightTopRef}
        args={[undefined, undefined, MAX_BELTS]}
        receiveShadow
        frustumCulled={false}
      >
        <planeGeometry args={[0.72, 0.98]} />
        <meshStandardMaterial
          color="#ffffff"
          map={beltTex}
          roughness={0.78}
          metalness={0.08}
        />
      </instancedMesh>

      {/* Instanced Corner Conveyors (3 draw calls for up to 2,048 corners) */}
      <instancedMesh
        ref={cornerBaseRef}
        args={[undefined, undefined, MAX_BELTS]}
        castShadow
        receiveShadow
        frustumCulled={false}
        material={MAT_STEEL_DARK}
      >
        <boxGeometry args={[0.88, 0.16, 0.88]} />
      </instancedMesh>
      <instancedMesh
        ref={cornerGuardRef}
        args={[undefined, undefined, MAX_BELTS]}
        frustumCulled={false}
        material={MAT_AMBER}
      >
        <boxGeometry args={[0.07, 0.08, 0.78]} />
      </instancedMesh>
      <instancedMesh
        ref={cornerTopRef}
        args={[undefined, undefined, MAX_BELTS]}
        frustumCulled={false}
      >
        <planeGeometry args={[0.68, 0.68]} />
        <meshStandardMaterial color="#ffffff" map={beltTex} roughness={0.78} />
      </instancedMesh>

      {/* Instanced Machine State Color Indicator Orbs (1 draw call) */}
      <instancedMesh
        ref={orbInstRef}
        args={[undefined, undefined, MAX_ENTITIES]}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* Composite Animated Hero Machines */}
      {heroMachines.map((e) => (
        <HeroMachineItem
          key={e.id}
          entity={e}
          onSelect={selectEntity}
          beltTex={beltTex}
        />
      ))}

      {/* Overhead Power Cables */}
      {poleEdges.map((edge) => (
        <mesh
          key={edge.key}
          position={edge.mid}
          rotation={[Math.PI / 2, 0, -edge.rotY]}
          material={MAT_POLE_WIRE}
        >
          <cylinderGeometry args={[0.016, 0.016, edge.len, 4]} />
        </mesh>
      ))}

      {/* Selected Machine Ring */}
      {selectedEntity && (
        <mesh
          position={[selectedEntity.x + 0.5, 0.05, selectedEntity.z + 0.5]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.52, 0.64, 24]} />
          <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Bottleneck Red Highlight Ring */}
      {bottleneckEntity && (
        <mesh
          ref={bottleneckRingRef}
          position={[bottleneckEntity.x + 0.5, 0.07, bottleneckEntity.z + 0.5]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.56, 0.72, 24]} />
          <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
};
