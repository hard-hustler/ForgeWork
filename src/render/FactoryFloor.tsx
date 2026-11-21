import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { GRID_SIZE, MACHINES } from '../data/catalog';
import {
  liveEntitiesRef,
  liveMetricsRef,
  useFactoryStore,
} from '../state/useFactoryStore';
import { Direction, EntityPlacement } from '../types/factory';
import { getFactoryFloorTextures } from './textures';

const DIR_VEC: ReadonlyArray<{ dx: number; dz: number }> = [
  { dx: 0, dz: -1 },
  { dx: 1, dz: 0 },
  { dx: 0, dz: 1 },
  { dx: -1, dz: 0 },
];

const LAMP_POSITIONS: ReadonlyArray<readonly [number, number]> = [
  [18, 24],
  [32, 24],
  [44, 24],
  [18, 40],
  [32, 40],
  [44, 40],
];

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _bulbDay = new THREE.Color('#64748b');
const _bulbNight = new THREE.Color('#fef08a');
const _bulbEmissiveOff = new THREE.Color('#000000');
const _bulbEmissiveOn = new THREE.Color('#fde047');

export const FactoryFloor: React.FC = () => {
  const resources = useFactoryStore((s) => s.resources);
  const topologyEntities = useFactoryStore((s) => s.topologyEntities);
  const selectedTool = useFactoryStore((s) => s.selectedTool);
  const deleteMode = useFactoryStore((s) => s.deleteMode);
  const blueprintMode = useFactoryStore((s) => s.blueprintMode);
  const activeBlueprint = useFactoryStore((s) => s.activeBlueprint);
  const rotation = useFactoryStore((s) => s.rotation);
  const heatmapMode = useFactoryStore((s) => s.heatmapMode);
  const cameraMode = useFactoryStore((s) => s.cameraMode);

  const placeWithUndo = useFactoryStore((s) => s.placeWithUndo);
  const removeWithUndo = useFactoryStore((s) => s.removeWithUndo);
  const saveBlueprintRegion = useFactoryStore((s) => s.saveBlueprintRegion);
  const selectEntity = useFactoryStore((s) => s.selectEntity);

  const [hoverTile, setHoverTile] = useState<{ x: number; z: number } | null>(
    null
  );
  const [dragStart, setDragStart] = useState<{ x: number; z: number } | null>(
    null
  );
  const [isDragging, setIsDragging] = useState(false);

  const { gl } = useThree();
  const maxAniso = useMemo(
    () => Math.min(8, gl.capabilities.getMaxAnisotropy()),
    [gl]
  );
  const {
    map: floorMap,
    aoMap: floorAoMap,
    bumpMap: floorBumpMap,
  } = useMemo(() => getFactoryFloorTextures(maxAniso), [maxAniso]);

  // Live 64x64 RGBA heatmap DataTexture (updated cleanly inside useFrame when visible)
  const heatmapTex = useMemo(() => {
    const data = new Uint8Array(GRID_SIZE * GRID_SIZE * 4);
    const tex = new THREE.DataTexture(
      data,
      GRID_SIZE,
      GRID_SIZE,
      THREE.RGBAFormat
    );
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.flipY = false;
    tex.needsUpdate = true;
    return tex;
  }, []);

  const lastHeatmapStamp = useRef(-1);

  const occupiedMap = useMemo(() => {
    const set = new Set<string>();
    for (const e of topologyEntities) set.add(`${e.x},${e.z}`);
    return set;
  }, [topologyEntities]);

  const resourceMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of resources) map.set(`${r.x},${r.z}`, r.type);
    return map;
  }, [resources]);

  // Instanced resource patches + ore crystals (turns ~210 draw calls into 2 draw calls)
  const patchInstRef = useRef<THREE.InstancedMesh>(null);
  const crystalInstRef = useRef<THREE.InstancedMesh>(null);
  const rockInstRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const patches = patchInstRef.current;
    const crystals = crystalInstRef.current;
    if (!patches || !crystals) return;

    patches.count = resources.length;
    crystals.count = resources.length * 2;

    for (let i = 0; i < resources.length; i++) {
      const r = resources[i];
      const hex =
        r.type === 'iron'
          ? '#6082a6'
          : r.type === 'copper'
          ? '#cf733d'
          : '#2b323d';
      _color.set(hex);

      _dummy.position.set(r.x + 0.5, 0.018, r.z + 0.5);
      _dummy.rotation.set(-Math.PI / 2, 0, 0);
      _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix();
      patches.setMatrixAt(i, _dummy.matrix);
      patches.setColorAt(i, _color);

      // Two crystal nodules per vein tile
      _dummy.position.set(r.x + 0.3, 0.1, r.z + 0.36);
      _dummy.rotation.set(0.2, i * 0.7, 0.1);
      _dummy.scale.set(0.14, 0.14, 0.14);
      _dummy.updateMatrix();
      crystals.setMatrixAt(i * 2, _dummy.matrix);
      crystals.setColorAt(i * 2, _color);

      _dummy.position.set(r.x + 0.69, 0.12, r.z + 0.66);
      _dummy.rotation.set(-0.15, i * 1.1, 0.2);
      _dummy.scale.set(0.16, 0.16, 0.16);
      _dummy.updateMatrix();
      crystals.setMatrixAt(i * 2 + 1, _dummy.matrix);
      crystals.setColorAt(i * 2 + 1, _color);
    }

    patches.instanceMatrix.needsUpdate = true;
    if (patches.instanceColor) patches.instanceColor.needsUpdate = true;
    crystals.instanceMatrix.needsUpdate = true;
    if (crystals.instanceColor) crystals.instanceColor.needsUpdate = true;
  }, [resources]);

  // Instanced perimeter rock outcrops (turns 24 draw calls into 1 draw call)
  useLayoutEffect(() => {
    const rocks = rockInstRef.current;
    if (!rocks) return;
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const r = 46 + (i % 3) * 6;
      const sx = 3.5 + (i % 4) * 1.4;
      const sy = 1.4 + (i % 3) * 1.1;
      const sz = 3.2 + ((i + 2) % 4) * 1.2;
      _dummy.position.set(
        32 + Math.cos(angle) * r,
        sy * 0.35 - 0.3,
        32 + Math.sin(angle) * r
      );
      _dummy.rotation.set(0, i * 0.7, 0);
      _dummy.scale.set(sx, sy, sz);
      _dummy.updateMatrix();
      rocks.setMatrixAt(i, _dummy.matrix);
    }
    rocks.instanceMatrix.needsUpdate = true;
  }, []);

  const computeDragConveyorLine = (
    start: { x: number; z: number },
    end: { x: number; z: number }
  ): EntityPlacement[] => {
    if (!selectedTool) return [];
    const list: EntityPlacement[] = [];
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const horizFirst = Math.abs(dx) >= Math.abs(dz);

    const pushTile = (x: number, z: number, dir: Direction) => {
      if (!occupiedMap.has(`${x},${z}`)) {
        list.push({ x, z, type: selectedTool, rot: dir });
      }
    };

    if (horizFirst) {
      const sx = Math.sign(dx) || 1;
      const dirX: Direction = sx >= 0 ? 1 : 3;
      for (let x = start.x; ; x += sx) {
        pushTile(x, start.z, dx === 0 ? rotation : dirX);
        if (x === end.x) break;
      }
      if (dz !== 0) {
        const sz = Math.sign(dz);
        const dirZ: Direction = sz >= 0 ? 2 : 0;
        for (let z = start.z + sz; ; z += sz) {
          pushTile(end.x, z, dirZ);
          if (z === end.z) break;
        }
      }
    } else {
      const sz = Math.sign(dz) || 1;
      const dirZ: Direction = sz >= 0 ? 2 : 0;
      for (let z = start.z; ; z += sz) {
        pushTile(start.x, z, dirZ);
        if (z === end.z) break;
      }
      if (dx !== 0) {
        const sx = Math.sign(dx);
        const dirX: Direction = sx >= 0 ? 1 : 3;
        for (let x = start.x + sx; ; x += sx) {
          pushTile(x, end.z, dirX);
          if (x === end.x) break;
        }
      }
    }
    return list;
  };

  const ghostPreview = useMemo(() => {
    if (!hoverTile) return null;

    if (blueprintMode && dragStart) {
      const minX = Math.min(dragStart.x, hoverTile.x);
      const maxX = Math.max(dragStart.x, hoverTile.x);
      const minZ = Math.min(dragStart.z, hoverTile.z);
      const maxZ = Math.max(dragStart.z, hoverTile.z);
      return {
        kind: 'box' as const,
        x: (minX + maxX + 1) / 2,
        z: (minZ + maxZ + 1) / 2,
        w: maxX - minX + 1,
        h: maxZ - minZ + 1,
      };
    }

    if (activeBlueprint) {
      const tiles = activeBlueprint.items.map((item) => {
        const x = hoverTile.x + item.dx;
        const z = hoverTile.z + item.dz;
        const valid =
          x >= 0 &&
          x < GRID_SIZE &&
          z >= 0 &&
          z < GRID_SIZE &&
          !occupiedMap.has(`${x},${z}`) &&
          (item.type !== 'extractor' || resourceMap.has(`${x},${z}`));
        return { x, z, valid };
      });
      return { kind: 'tiles' as const, tiles };
    }

    if (deleteMode) {
      return {
        kind: 'tiles' as const,
        tiles: [{ x: hoverTile.x, z: hoverTile.z, valid: false }],
      };
    }

    if (!selectedTool) return null;

    if (isDragging && dragStart && MACHINES[selectedTool].isConveyor) {
      const line = computeDragConveyorLine(dragStart, hoverTile);
      return {
        kind: 'tiles' as const,
        tiles: line.map((l) => ({ x: l.x, z: l.z, valid: true })),
      };
    }

    const valid =
      !occupiedMap.has(`${hoverTile.x},${hoverTile.z}`) &&
      (selectedTool !== 'extractor' ||
        resourceMap.has(`${hoverTile.x},${hoverTile.z}`)) &&
      liveMetricsRef.current.money >= MACHINES[selectedTool].cost;

    return {
      kind: 'tiles' as const,
      tiles: [{ x: hoverTile.x, z: hoverTile.z, valid }],
    };
  }, [
    hoverTile,
    blueprintMode,
    dragStart,
    activeBlueprint,
    deleteMode,
    selectedTool,
    isDragging,
    occupiedMap,
    resourceMap,
    rotation,
  ]);

  const toTile = (point: THREE.Vector3): { x: number; z: number } | null => {
    const x = Math.floor(point.x);
    const z = Math.floor(point.z);
    if (x < 0 || x >= GRID_SIZE || z < 0 || z >= GRID_SIZE) return null;
    return { x, z };
  };

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0 || cameraMode === 'fps') return;
    const tile = toTile(e.point);
    if (!tile) return;

    if (blueprintMode) {
      e.stopPropagation();
      setDragStart(tile);
      setIsDragging(true);
      return;
    }

    if (activeBlueprint) {
      e.stopPropagation();
      const placements: EntityPlacement[] = [];
      for (const item of activeBlueprint.items) {
        const x = tile.x + item.dx;
        const z = tile.z + item.dz;
        if (
          x >= 0 &&
          x < GRID_SIZE &&
          z >= 0 &&
          z < GRID_SIZE &&
          !occupiedMap.has(`${x},${z}`)
        ) {
          placements.push({
            x,
            z,
            type: item.type,
            rot: item.rot,
            cornerFlip: item.cornerFlip,
            recipeId: item.recipeId,
          });
        }
      }
      placeWithUndo(placements);
      return;
    }

    if (deleteMode) {
      e.stopPropagation();
      removeWithUndo([tile]);
      return;
    }

    if (selectedTool) {
      e.stopPropagation();
      if (MACHINES[selectedTool].isConveyor) {
        setDragStart(tile);
        setIsDragging(true);
      } else {
        placeWithUndo([
          { x: tile.x, z: tile.z, type: selectedTool, rot: rotation },
        ]);
      }
      return;
    }

    // Clicking a tile selects any machine or conveyor on that tile, or clears selection
    const clickedEntity = liveEntitiesRef.list.find(
      (ent) => ent.x === tile.x && ent.z === tile.z
    );
    selectEntity(clickedEntity ? clickedEntity.id : null);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    const tile = toTile(e.point);
    if (!tile) {
      if (hoverTile !== null) setHoverTile(null);
      return;
    }
    if (!hoverTile || hoverTile.x !== tile.x || hoverTile.z !== tile.z) {
      setHoverTile(tile);
    }
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging || !dragStart) return;
    const tile = toTile(e.point) ?? hoverTile ?? dragStart;

    if (blueprintMode) {
      const name = `Sector (${dragStart.x},${dragStart.z})-${tile.x},${tile.z}`;
      saveBlueprintRegion(name, dragStart.x, dragStart.z, tile.x, tile.z);
    } else if (selectedTool && MACHINES[selectedTool].isConveyor) {
      const placements = computeDragConveyorLine(dragStart, tile);
      placeWithUndo(placements);
    }

    setIsDragging(false);
    setDragStart(null);
  };

  // Night lamp automatic activation + brownout flicker + heatmap DataTexture refresh inside useFrame
  const lampLightsRef = useRef<Array<THREE.PointLight | null>>([]);
  const lampBulbMatsRef = useRef<Array<THREE.MeshStandardMaterial | null>>([]);

  useEffect(() => {
    lastHeatmapStamp.current = -1;
  }, [heatmapMode]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const metrics = liveMetricsRef.current;
    const sunElevation = Math.sin(metrics.dayTime * Math.PI * 2 - Math.PI / 2);
    const isNight = sunElevation < 0.16;
    const brownout = metrics.powerSatisfaction < 0.92;

    for (let i = 0; i < LAMP_POSITIONS.length; i++) {
      const mat = lampBulbMatsRef.current[i];
      if (mat) {
        if (isNight) {
          const flick = brownout
            ? 0.4 + Math.abs(Math.sin(t * 21 + i * 2.3)) * 0.8
            : 1;
          mat.color.copy(_bulbNight);
          mat.emissive.copy(_bulbEmissiveOn);
          mat.emissiveIntensity = 2.4 * flick;
        } else {
          mat.color.copy(_bulbDay);
          mat.emissive.copy(_bulbEmissiveOff);
          mat.emissiveIntensity = 0;
        }
      }
      const light = lampLightsRef.current[i];
      if (light) {
        if (!isNight) {
          light.intensity = 0;
        } else if (brownout) {
          const flick = 0.35 + Math.abs(Math.sin(t * 21 + i * 2.3)) * 0.8;
          light.intensity = 22 * flick;
        } else {
          light.intensity = 28;
        }
      }
    }

    if (heatmapMode !== 'none' && lastHeatmapStamp.current !== metrics.tick) {
      lastHeatmapStamp.current = metrics.tick;
      const state = useFactoryStore.getState();
      const src =
        heatmapMode === 'congestion' ? state.congestionMap : state.powerMap;
      const dst = heatmapTex.image.data as Uint8Array;
      for (let idx = 0; idx < GRID_SIZE * GRID_SIZE; idx++) {
        const val = src[idx] ?? 0;
        const p = idx * 4;
        if (val === 0) {
          dst[p] = 0;
          dst[p + 1] = 0;
          dst[p + 2] = 0;
          dst[p + 3] = 0;
        } else if (heatmapMode === 'congestion') {
          dst[p] = 245;
          dst[p + 1] = Math.max(25, 225 - val);
          dst[p + 2] = 35;
          dst[p + 3] = Math.min(205, 75 + val * 0.55);
        } else {
          dst[p] = 168;
          dst[p + 1] = 85;
          dst[p + 2] = 247;
          dst[p + 3] = Math.min(205, 75 + val * 0.55);
        }
      }
      heatmapTex.needsUpdate = true;
    }
  });

  const dirVec = DIR_VEC[rotation];

  return (
    <group>
      {/* Extended Outdoor Industrial Yard Surround */}
      <mesh
        position={[GRID_SIZE / 2, -0.32, GRID_SIZE / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[280, 280]} />
        <meshStandardMaterial color="#121821" roughness={0.95} metalness={0.05} />
      </mesh>

      {/* Instanced Perimeter Natural Rock Ridges */}
      <instancedMesh ref={rockInstRef} args={[undefined, undefined, 24]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#1c2430" roughness={0.92} metalness={0.08} />
      </instancedMesh>

      {/* Concrete Slab Bevel Plinth */}
      <mesh position={[GRID_SIZE / 2, -0.16, GRID_SIZE / 2]} receiveShadow>
        <boxGeometry args={[GRID_SIZE + 1.4, 0.32, GRID_SIZE + 1.4]} />
        <meshStandardMaterial color="#273140" roughness={0.85} metalness={0.2} />
      </mesh>

      {/* Main 64x64 Factory Concrete Floor */}
      <mesh
        position={[GRID_SIZE / 2, 0, GRID_SIZE / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
        <meshStandardMaterial
          color="#ffffff"
          map={floorMap}
          aoMap={floorAoMap}
          aoMapIntensity={0.35}
          bumpMap={floorBumpMap}
          bumpScale={0.008}
          roughness={0.86}
          metalness={0.1}
        />
      </mesh>

      {/* Live Heatmap Overlay (Offset Y = 0.025 to prevent Z-fighting) */}
      {heatmapMode !== 'none' && (
        <mesh
          position={[GRID_SIZE / 2, 0.025, GRID_SIZE / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
          <meshBasicMaterial
            map={heatmapTex}
            transparent
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
      )}

      {/* Instanced Ore & Coal Resource Veins (2 draw calls total) */}
      <instancedMesh
        ref={patchInstRef}
        args={[undefined, undefined, 256]}
        frustumCulled={false}
      >
        <planeGeometry args={[0.92, 0.92]} />
        <meshStandardMaterial roughness={0.9} metalness={0.15} />
      </instancedMesh>
      <instancedMesh
        ref={crystalInstRef}
        args={[undefined, undefined, 512]}
        castShadow
        frustumCulled={false}
      >
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={0.42} metalness={0.45} />
      </instancedMesh>

      {/* Placement Ghost / Blueprint Selection Box */}
      {ghostPreview?.kind === 'box' && (
        <mesh position={[ghostPreview.x, 0.18, ghostPreview.z]}>
          <boxGeometry args={[ghostPreview.w, 0.36, ghostPreview.h]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.32} />
        </mesh>
      )}

      {ghostPreview?.kind === 'tiles' &&
        ghostPreview.tiles.map((t, idx) => (
          <group key={idx} position={[t.x + 0.5, 0.25, t.z + 0.5]}>
            <mesh>
              <boxGeometry args={[0.9, 0.44, 0.9]} />
              <meshBasicMaterial
                color={deleteMode ? '#ef4444' : t.valid ? '#10b981' : '#ef4444'}
                transparent
                opacity={0.45}
              />
            </mesh>
            {!deleteMode && !activeBlueprint && (
              <mesh position={[dirVec.dx * 0.36, 0.26, dirVec.dz * 0.36]}>
                <boxGeometry args={[0.22, 0.1, 0.22]} />
                <meshBasicMaterial color="#fbbf24" />
              </mesh>
            )}
          </group>
        ))}

      {/* Permanent Factory Floodlamp Towers (auto night lights + brownout flicker) */}
      {LAMP_POSITIONS.map(([lx, lz], i) => (
        <group key={i} position={[lx, 0, lz]}>
          <mesh position={[0, 0.14, 0]} castShadow>
            <boxGeometry args={[0.42, 0.28, 0.42]} />
            <meshStandardMaterial
              color="#334155"
              roughness={0.75}
              metalness={0.3}
            />
          </mesh>
          <mesh position={[0, 2.3, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.1, 4.4, 8]} />
            <meshStandardMaterial
              color="#475569"
              metalness={0.75}
              roughness={0.35}
            />
          </mesh>
          <mesh position={[0, 4.5, 0]}>
            <boxGeometry args={[0.56, 0.16, 0.28]} />
            <meshStandardMaterial
              color="#1e293b"
              metalness={0.6}
              roughness={0.4}
            />
          </mesh>
          <mesh position={[0, 4.38, 0]}>
            <boxGeometry args={[0.46, 0.08, 0.2]} />
            <meshStandardMaterial
              ref={(el) => {
                lampBulbMatsRef.current[i] = el;
              }}
              color="#64748b"
              emissive="#000000"
              emissiveIntensity={0}
            />
          </mesh>
          {i < 4 && (
            <pointLight
              ref={(el) => {
                lampLightsRef.current[i] = el;
              }}
              position={[0, 4.2, 0]}
              color="#fde68a"
              intensity={0}
              distance={28}
              decay={1.45}
            />
          )}
        </group>
      ))}
    </group>
  );
};
