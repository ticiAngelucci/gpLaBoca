import * as THREE from 'three';

function canvas(size = 512): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return [c, c.getContext('2d') as CanvasRenderingContext2D];
}

/** Hand drawn cobblestone, the signature floor of La Boca. */
export function cobbleTexture(): THREE.Texture {
  const [c, ctx] = canvas(512);
  ctx.fillStyle = '#6b6259';
  ctx.fillRect(0, 0, 512, 512);
  const rows = 16;
  const cols = 16;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const offset = y % 2 ? 16 : 0;
      const px = x * 32 + offset;
      const py = y * 32;
      const shade = 90 + Math.random() * 55;
      ctx.fillStyle = `rgb(${shade}, ${shade - 8}, ${shade - 20})`;
      ctx.beginPath();
      ctx.roundRect(px + 2, py + 2, 28, 28, 7);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(28, 28);
  tex.anisotropy = 8;
  return tex;
}

/** Corrugated, brightly painted sheet metal facades. */
export function facadeTexture(color: string): THREE.Texture {
  const [c, ctx] = canvas(256);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 12) {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(i, 0, 4, 256);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(i + 5, 0, 3, 256);
  }
  // windows and balconies
  for (let y = 40; y < 220; y += 80) {
    for (let x = 30; x < 220; x += 80) {
      ctx.fillStyle = 'rgba(25,30,45,0.85)';
      ctx.fillRect(x, y, 40, 52);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, 40, 52);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x + 4, y + 4, 14, 20);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function grassTexture(): THREE.Texture {
  const [c, ctx] = canvas(512);
  ctx.fillStyle = '#1f7a35';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 512; i += 64) {
    ctx.fillStyle = i % 128 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, i, 512, 64);
  }
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Blue and yellow stand made of thousands of tiny seats. */
export function standTexture(): THREE.Texture {
  const [c, ctx] = canvas(512);
  ctx.fillStyle = '#0b2e6f';
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 8) {
    for (let x = 0; x < 512; x += 8) {
      const band = Math.floor(y / 64) % 3 === 1;
      const base = band ? '#f2c500' : '#123f8f';
      ctx.fillStyle = Math.random() > 0.9 ? 'rgba(255,255,255,0.5)' : base;
      ctx.fillRect(x + 1, y + 1, 6, 6);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function skyGradient(top: string, bottom: string): THREE.Texture {
  const [c, ctx] = canvas(256);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}
