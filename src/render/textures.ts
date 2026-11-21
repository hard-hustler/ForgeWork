import * as THREE from 'three';

let cachedFloorTex: THREE.CanvasTexture | null = null;
let cachedAoTex: THREE.CanvasTexture | null = null;
let cachedBumpTex: THREE.CanvasTexture | null = null;
let cachedBeltTex: THREE.CanvasTexture | null = null;
let cachedIsSoftwareGl: boolean | null = null;

export function detectSoftwareGl(): boolean {
  if (cachedIsSoftwareGl !== null) return cachedIsSoftwareGl;
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      cachedIsSoftwareGl = true;
      return true;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    cachedIsSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(
      gpu
    );
  } catch {
    cachedIsSoftwareGl = false;
  }
  return cachedIsSoftwareGl;
}

export function getFactoryFloorTextures(maxAnisotropy = 8): {
  map: THREE.CanvasTexture;
  aoMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  if (cachedFloorTex && cachedAoTex && cachedBumpTex) {
    return { map: cachedFloorTex, aoMap: cachedAoTex, bumpMap: cachedBumpTex };
  }

  const size = 256;
  // 1. Concrete albedo 2x2m industrial floor bay (eliminates high-frequency moire)
  const c1 = document.createElement('canvas');
  c1.width = size;
  c1.height = size;
  const ctx = c1.getContext('2d')!;
  ctx.fillStyle = '#242d3a';
  ctx.fillRect(0, 0, size, size);

  // Subtle concrete aggregate noise
  for (let i = 0; i < 1400; i++) {
    const x = (i * 97 + (i % 7) * 13) % size;
    const y = (i * 151 + (i % 5) * 19) % size;
    ctx.fillStyle =
      i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(x, y, 2, 2);
  }

  // Soft 1-meter interior tile score lines
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.moveTo(0, size / 2);
  ctx.lineTo(size, size / 2);
  ctx.stroke();

  // Outer 2-meter expansion joint seam + subtle corner anchor bolts
  ctx.strokeStyle = '#364457';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(1.25, 1.25, size - 2.5, size - 2.5);
  ctx.fillStyle = '#47576e';
  const bolts: Array<[number, number]> = [
    [8, 8],
    [size - 12, 8],
    [8, size - 12],
    [size - 12, size - 12],
    [size / 2 - 2, size / 2 - 2],
  ];
  for (const [bx, by] of bolts) {
    ctx.fillRect(bx, by, 4, 4);
  }

  const map = new THREE.CanvasTexture(c1);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(32, 32);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  // 2. Subtle tile ambient occlusion vignette
  const c2 = document.createElement('canvas');
  c2.width = size;
  c2.height = size;
  const aoCtx = c2.getContext('2d')!;
  const grad = aoCtx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.18,
    size / 2,
    size / 2,
    size * 0.72
  );
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#bcc7d6');
  aoCtx.fillStyle = grad;
  aoCtx.fillRect(0, 0, size, size);

  const aoMap = new THREE.CanvasTexture(c2);
  aoMap.wrapS = THREE.RepeatWrapping;
  aoMap.wrapT = THREE.RepeatWrapping;
  aoMap.repeat.set(32, 32);
  aoMap.anisotropy = maxAnisotropy;

  // 3. Soft linear concrete micro-bump map
  const c3 = document.createElement('canvas');
  c3.width = size;
  c3.height = size;
  const bCtx = c3.getContext('2d')!;
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);
  for (let i = 0; i < 800; i++) {
    const x = (i * 67) % size;
    const y = (i * 113) % size;
    bCtx.fillStyle = i % 2 === 0 ? '#8c8c8c' : '#747474';
    bCtx.fillRect(x, y, 2, 2);
  }
  bCtx.strokeStyle = '#626262';
  bCtx.lineWidth = 2;
  bCtx.strokeRect(1, 1, size - 2, size - 2);

  const bumpMap = new THREE.CanvasTexture(c3);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(32, 32);
  bumpMap.anisotropy = maxAnisotropy;

  cachedFloorTex = map;
  cachedAoTex = aoMap;
  cachedBumpTex = bumpMap;
  return { map, aoMap, bumpMap };
}

export function getConveyorBeltTexture(maxAnisotropy = 8): THREE.CanvasTexture {
  if (cachedBeltTex) return cachedBeltTex;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1f2630';
  ctx.fillRect(0, 0, size, size);

  // Ribbed tread lines
  ctx.fillStyle = '#293240';
  ctx.fillRect(4, 6, size - 8, 4);
  ctx.fillRect(4, 38, size - 8, 4);

  // Amber directional chevron
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(14, 46);
  ctx.lineTo(32, 20);
  ctx.lineTo(50, 46);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  cachedBeltTex = tex;
  return tex;
}
