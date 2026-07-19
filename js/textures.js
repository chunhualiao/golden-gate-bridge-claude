// Procedural canvas textures + deterministic value noise (no external assets).
import * as THREE from 'three';

// --- deterministic value noise -------------------------------------------
const PERM = new Uint8Array(512);
{
  const p = new Uint8Array(256);
  let seed = 1337;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}
const fade = (t) => t * t * (3 - 2 * t);

function latticeHash(x, y, period) {
  if (period) {
    x = ((x % period) + period) % period;
    y = ((y % period) + period) % period;
  }
  return PERM[(PERM[x & 255] + y) & 255] / 255;
}

export function valueNoise(x, y, period) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = latticeHash(xi, yi, period), b = latticeHash(xi + 1, yi, period);
  const c = latticeHash(xi, yi + 1, period), d = latticeHash(xi + 1, yi + 1, period);
  const u = fade(xf), v = fade(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Fractal noise in [0,1]. Pass `period` (in lattice cells) to make it tile.
export function fbm(x, y, octaves = 4, period) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x * freq, y * freq, period ? period * freq : undefined) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

// --- canvas helpers -------------------------------------------------------
function makeCanvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}

function canvasTexture(canvas, { srgb = true, repeat = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Tiling tangent-space normal map for the ocean shader.
export function waterNormalsTexture() {
  const size = 256, cells = 8;
  const hgt = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      hgt[y * size + x] = fbm((x / size) * cells, (y / size) * cells, 4, cells);

  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const k = 6;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const xp = (x + 1) % size, xm = (x + size - 1) % size;
      const yp = (y + 1) % size, ym = (y + size - 1) % size;
      const dx = (hgt[y * size + xp] - hgt[y * size + xm]) * k;
      const dy = (hgt[yp * size + x] - hgt[ym * size + x]) * k;
      const inv = 1 / Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = (-dx * inv * 0.5 + 0.5) * 255;
      img.data[i + 1] = (-dy * inv * 0.5 + 0.5) * 255;
      img.data[i + 2] = (inv * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Road surface: 6 lanes across v (22 m), one 12 m dash cycle along u.
export function roadTexture() {
  const c = makeCanvas(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#26272b';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      const g = 30 + Math.random() * 42;
      ctx.fillStyle = `rgba(${g},${g},${g + 4},${0.25 * Math.random()})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    }
    const zToY = (z) => ((z + 11) / 22) * h;
    // wheel-wear bands
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    for (const z of [-8.85, -5.35, -1.85, 1.85, 5.35, 8.85]) {
      for (const off of [-0.9, 0.9]) ctx.fillRect(0, zToY(z + off) - 6, w, 12);
    }
    // solid edge lines
    ctx.fillStyle = 'rgba(235,235,235,0.92)';
    ctx.fillRect(0, zToY(-10.6) - 2, w, 4);
    ctx.fillRect(0, zToY(10.6) - 2, w, 4);
    // dashed lane lines (3 m dash per 12 m tile)
    for (const z of [-7, -3.5, 3.5, 7]) ctx.fillRect(0, zToY(z) - 1.5, w * 0.25, 3);
    // double yellow center
    ctx.fillStyle = 'rgba(230,178,58,0.95)';
    ctx.fillRect(0, zToY(-0.35) - 1.5, w, 3);
    ctx.fillRect(0, zToY(0.35) - 1.5, w, 3);
  });
  const tex = canvasTexture(c);
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function concreteTexture() {
  const c = makeCanvas(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#a39f93';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) {
      const g = 130 + Math.random() * 60;
      ctx.fillStyle = `rgba(${g},${g - 4},${g - 12},${0.3 * Math.random()})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    ctx.fillStyle = 'rgba(60,58,52,0.08)';
    for (let y = 0; y < h; y += 48) ctx.fillRect(0, y, w, 2);
  });
  return canvasTexture(c);
}

// Lit windows grid — used as an emissive map on the distant skyline.
export function windowsTexture() {
  const c = makeCanvas(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    for (let y = 6; y < h - 6; y += 11) {
      for (let x = 4; x < w - 4; x += 9) {
        if (Math.random() < 0.38) {
          const warm = Math.random() < 0.75;
          ctx.fillStyle = warm
            ? `rgba(255,${190 + Math.random() * 40 | 0},130,${0.5 + Math.random() * 0.5})`
            : `rgba(170,200,255,${0.4 + Math.random() * 0.5})`;
          ctx.fillRect(x, y, 4, 6);
        }
      }
    }
  });
  return canvasTexture(c);
}

// Soft radial dot for light glows (street lamps, beacons).
export function glowTexture() {
  const c = makeCanvas(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  return canvasTexture(c, { repeat: false });
}

// Wispy blob sheet for drifting fog banks.
export function fogBankTexture() {
  const c = makeCanvas(256, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) {
      const x = w * (0.15 + Math.random() * 0.7);
      const y = h * (0.3 + Math.random() * 0.45);
      const r = 20 + Math.random() * 55;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.28)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    // fade the sheet edges so sprites blend
    const mask = ctx.createRadialGradient(w / 2, h / 2, h * 0.1, w / 2, h / 2, w * 0.52);
    mask.addColorStop(0, 'rgba(255,255,255,1)');
    mask.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = mask;
    ctx.fillRect(0, 0, w, h);
  });
  return canvasTexture(c, { repeat: false });
}
