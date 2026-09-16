import { useEffect, useRef } from 'react';
import type { TrackSample } from '../race/track';

interface Props {
  samples: TrackSample[];
  cars: { x: number; z: number; color: string; isPlayer: boolean }[];
}

const SIZE = 168;

export function Minimap({ samples, cars }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    samples.forEach((s) => {
      minX = Math.min(minX, s.pos.x);
      maxX = Math.max(maxX, s.pos.x);
      minZ = Math.min(minZ, s.pos.z);
      maxZ = Math.max(maxZ, s.pos.z);
    });
    const pad = 14;
    const scale = Math.min((SIZE - pad * 2) / (maxX - minX), (SIZE - pad * 2) / (maxZ - minZ));
    const px = (x: number) => pad + (x - minX) * scale;
    const pz = (z: number) => pad + (z - minZ) * scale;

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 4.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    samples.forEach((s, i) => {
      const x = px(s.pos.x);
      const y = pz(s.pos.z);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(20,24,34,0.9)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Start line marker.
    ctx.fillStyle = '#ffd400';
    ctx.fillRect(px(samples[0].pos.x) - 3, pz(samples[0].pos.z) - 3, 6, 6);

    cars.forEach((c) => {
      ctx.beginPath();
      ctx.arc(px(c.x), pz(c.z), c.isPlayer ? 5 : 3.4, 0, Math.PI * 2);
      ctx.fillStyle = c.color;
      ctx.fill();
      if (c.isPlayer) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }, [samples, cars]);

  return <canvas className="minimap" ref={ref} width={SIZE} height={SIZE} />;
}
