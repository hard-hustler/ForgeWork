import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PointerLockControls, Sky } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  cameraFocusRef,
  liveMetricsRef,
  useFactoryStore,
} from '../state/useFactoryStore';
import { FactoryFloor } from './FactoryFloor';
import { InstancedItems } from './InstancedItems';
import { MachineMeshes } from './MachineMeshes';
import { MaintenanceDrones } from './MaintenanceDrones';
import { detectSoftwareGl } from './textures';

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _camGoal = new THREE.Vector3();
const _dayColor = new THREE.Color('#1a2738');
const _duskColor = new THREE.Color('#1a1b2b');
const _nightColor = new THREE.Color('#090d16');
const _bgScratch = new THREE.Color();
const _sunDayColor = new THREE.Color('#fffbeb');
const _sunDuskColor = new THREE.Color('#fb923c');
const _ambDayColor = new THREE.Color('#dbeafe');
const _ambNightColor = new THREE.Color('#334155');
const _hemiDaySky = new THREE.Color('#bae6fd');
const _hemiNightSky = new THREE.Color('#1e293b');

const EnvironmentAndSoftwarePacer: React.FC<{ isSoftwareGl: boolean }> = ({
  isSoftwareGl,
}) => {
  const { gl, scene, invalidate } = useThree();

  // Procedural studio environment map for crisp metallic reflections
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    return () => {
      scene.environment = null;
      envRT.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  // Software-WebGL afterDraw pacer so headless Chromium / SwiftShader never starves UI
  useEffect(() => {
    if (!isSoftwareGl) return;
    let alive = true;
    let timerId = 0;

    const scheduleNext = () => {
      if (!alive) return;
      const ctx = gl.getContext() as WebGL2RenderingContext;
      if (ctx && typeof ctx.fenceSync === 'function') {
        const sync = ctx.fenceSync(ctx.SYNC_GPU_COMMANDS_COMPLETE, 0);
        ctx.flush();
        const poll = () => {
          if (!alive) {
            if (sync) ctx.deleteSync(sync);
            return;
          }
          const state = sync
            ? ctx.getSyncParameter(sync, ctx.SYNC_STATUS)
            : ctx.SIGNALED;
          if (state === ctx.UNSIGNALED) {
            timerId = window.setTimeout(poll, 12);
          } else {
            if (sync) ctx.deleteSync(sync);
            timerId = window.setTimeout(() => {
              if (!alive) return;
              invalidate();
              scheduleNext();
            }, 130);
          }
        };
        timerId = window.setTimeout(poll, 12);
      } else {
        timerId = window.setTimeout(() => {
          if (!alive) return;
          invalidate();
          scheduleNext();
        }, 160);
      }
    };

    invalidate();
    scheduleNext();

    return () => {
      alive = false;
      window.clearTimeout(timerId);
    };
  }, [isSoftwareGl, gl, invalidate]);

  return null;
};

const CameraAndPerfRig: React.FC<{ isSoftwareGl: boolean }> = ({
  isSoftwareGl,
}) => {
  const cameraMode = useFactoryStore((s) => s.cameraMode);
  const setCameraMode = useFactoryStore((s) => s.setCameraMode);
  const setPerfStats = useFactoryStore((s) => s.setPerfStats);

  const orbitRef = useRef<OrbitControlsImpl>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const fpsCounter = useRef({ frames: 0, lastTime: performance.now() });
  const { camera, gl } = useThree();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (cameraMode === 'fps') {
      camera.position.set(
        cameraFocusRef.x,
        1.78,
        Math.min(60, cameraFocusRef.z + 5)
      );
      camera.lookAt(cameraFocusRef.x, 1.5, cameraFocusRef.z);
    }
  }, [cameraMode, camera]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    // Smooth exponential damping for click-to-focus targets
    if (
      cameraFocusRef.pendingTarget &&
      orbitRef.current &&
      cameraMode === 'orbit'
    ) {
      const { x, z } = cameraFocusRef.pendingTarget;
      _targetPos.set(x, 0.4, z);
      _camGoal.set(x + 11, 13, z + 13);
      const alpha = 1 - Math.exp(-7 * delta);
      orbitRef.current.target.lerp(_targetPos, alpha);
      camera.position.lerp(_camGoal, alpha);
      orbitRef.current.update();
      if (orbitRef.current.target.distanceTo(_targetPos) < 0.08) {
        cameraFocusRef.pendingTarget = null;
      }
    }

    if (cameraMode === 'orbit' && orbitRef.current) {
      cameraFocusRef.x = orbitRef.current.target.x;
      cameraFocusRef.z = orbitRef.current.target.z;
    }

    // First-Person "Walk the Floor" WASD movement
    if (cameraMode === 'fps') {
      const moveSpeed = (keysRef.current['ShiftLeft'] ? 12 : 6.5) * delta;
      camera.getWorldDirection(_forward);
      _forward.y = 0;
      if (_forward.lengthSq() > 0.0001) _forward.normalize();
      _right.crossVectors(_forward, camera.up).normalize();

      if (keysRef.current['KeyW'] || keysRef.current['ArrowUp']) {
        camera.position.addScaledVector(_forward, moveSpeed);
      }
      if (keysRef.current['KeyS'] || keysRef.current['ArrowDown']) {
        camera.position.addScaledVector(_forward, -moveSpeed);
      }
      if (keysRef.current['KeyD'] || keysRef.current['ArrowRight']) {
        camera.position.addScaledVector(_right, moveSpeed);
      }
      if (keysRef.current['KeyA'] || keysRef.current['ArrowLeft']) {
        camera.position.addScaledVector(_right, -moveSpeed);
      }

      camera.position.x = THREE.MathUtils.clamp(camera.position.x, 1, 63);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, 1, 63);
      camera.position.y = 1.78;
      cameraFocusRef.x = camera.position.x;
      cameraFocusRef.z = camera.position.z;
    }

    // Update FPS / Draw Call metrics at 1-2 Hz without churn
    fpsCounter.current.frames++;
    const now = performance.now();
    const interval = isSoftwareGl ? 1000 : 500;
    if (now - fpsCounter.current.lastTime >= interval) {
      const elapsed = (now - fpsCounter.current.lastTime) / 1000;
      const fps = Math.round(fpsCounter.current.frames / elapsed);
      fpsCounter.current.frames = 0;
      fpsCounter.current.lastTime = now;
      setPerfStats({
        fps,
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
      });
    }
  });

  return cameraMode === 'orbit' ? (
    <OrbitControls
      ref={orbitRef}
      target={[31, 0.4, 33]}
      maxPolarAngle={Math.PI / 2 - 0.06}
      minDistance={5}
      maxDistance={85}
      enableDamping={!isSoftwareGl}
      dampingFactor={0.08}
      onStart={() => {
        cameraFocusRef.pendingTarget = null;
      }}
    />
  ) : (
    <PointerLockControls onUnlock={() => setCameraMode('orbit')} />
  );
};

const DayNightLighting: React.FC<{ isSoftwareGl: boolean }> = ({
  isSoftwareGl,
}) => {
  const { scene } = useThree();
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const ambLightRef = useRef<THREE.AmbientLight>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight>(null);
  const fogRef = useRef<THREE.Fog>(null);

  useFrame(() => {
    const dayTime = liveMetricsRef.current.dayTime;
    const angle = dayTime * Math.PI * 2 - Math.PI / 2;
    const sunY = Math.sin(angle) * 48;
    const sunX = Math.cos(angle) * 48;
    const daylight = THREE.MathUtils.clamp(
      (Math.sin(angle) + 0.18) / 1.18,
      0,
      1
    );

    if (daylight > 0.4) {
      _bgScratch.lerpColors(_duskColor, _dayColor, (daylight - 0.4) / 0.6);
    } else {
      _bgScratch.lerpColors(_nightColor, _duskColor, daylight / 0.4);
    }

    if (scene.background instanceof THREE.Color) {
      scene.background.copy(_bgScratch);
    }
    scene.environmentIntensity = 0.22 + daylight * 0.82;
    if (fogRef.current) {
      fogRef.current.color.copy(_bgScratch);
    }

    if (ambLightRef.current) {
      ambLightRef.current.intensity = 0.24 + daylight * 0.3;
      ambLightRef.current.color.lerpColors(_ambNightColor, _ambDayColor, daylight);
    }
    if (hemiLightRef.current) {
      hemiLightRef.current.intensity = 0.42 + daylight * 0.44;
      hemiLightRef.current.color.lerpColors(_hemiNightSky, _hemiDaySky, daylight);
    }
    if (dirLightRef.current) {
      dirLightRef.current.position.set(32 + sunX, Math.max(10, sunY), 26);
      dirLightRef.current.intensity = 0.28 + daylight * 1.95;
      dirLightRef.current.color.lerpColors(
        _sunDuskColor,
        _sunDayColor,
        Math.min(1, daylight * 1.4)
      );
    }
  });

  return (
    <>
      <color attach="background" args={['#182334']} />
      <fog ref={fogRef} attach="fog" args={['#182334', 72, 165]} />
      {!isSoftwareGl && (
        <Sky
          sunPosition={[52, 28, 22]}
          turbidity={8}
          rayleigh={1.2}
          mieCoefficient={0.005}
        />
      )}
      <ambientLight ref={ambLightRef} intensity={0.45} color="#dbeafe" />
      <hemisphereLight
        ref={hemiLightRef}
        args={['#bae6fd', '#111827', 0.72]}
      />
      <directionalLight
        ref={dirLightRef}
        position={[52, 34, 26]}
        intensity={1.9}
        color="#fffbeb"
        castShadow={!isSoftwareGl}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-32}
        shadow-camera-right={32}
        shadow-camera-top={32}
        shadow-camera-bottom={-32}
        shadow-camera-near={5}
        shadow-camera-far={120}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      />
    </>
  );
};

export const SceneCanvas: React.FC = () => {
  const isSoftwareGl = useMemo(() => detectSoftwareGl(), []);
  const [contextLost, setContextLost] = useState(false);

  return (
    <div
      className="absolute inset-0 w-full h-full"
      data-testid="factory-canvas-container"
    >
      {contextLost ? (
        <div className="w-full h-full flex items-center justify-center bg-[#0c1016] text-slate-300 text-sm">
          WebGL rendering context interrupted. Restoring factory viewport...
        </div>
      ) : (
        <Canvas
          shadows={!isSoftwareGl}
          frameloop={isSoftwareGl ? 'demand' : 'always'}
          dpr={isSoftwareGl ? 1 : [1, 2]}
          camera={{ position: [45, 22, 48], fov: 46, near: 0.2, far: 260 }}
          gl={{
            antialias: !isSoftwareGl,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.08,
          }}
          onCreated={({ gl }) => {
            const canvas = gl.domElement;
            canvas.addEventListener('webglcontextlost', (ev) => {
              ev.preventDefault();
              setContextLost(true);
            });
            canvas.addEventListener('webglcontextrestored', () => {
              setContextLost(false);
            });
          }}
        >
          <EnvironmentAndSoftwarePacer isSoftwareGl={isSoftwareGl} />
          <DayNightLighting isSoftwareGl={isSoftwareGl} />
          <CameraAndPerfRig isSoftwareGl={isSoftwareGl} />
          <FactoryFloor />
          <MachineMeshes />
          <InstancedItems />
          <MaintenanceDrones />
        </Canvas>
      )}
    </div>
  );
};
