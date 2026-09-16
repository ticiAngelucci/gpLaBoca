import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { driverById } from '../engine/drivers';
import { minigameById } from '../engine/minigameList';
import { rngAt } from '../engine/rng';
import type { Player } from '../engine/types';
import { InputState, baseScene, type MinigameInstance, type MinigamePlayer } from '../minigames/framework';
import { MINIGAME_FACTORIES } from '../minigames/registry';

interface Props {
  minigameId: string;
  players: Player[];
  seed: number;
  onFinish: (scores: { playerId: number; score: number }[]) => void;
}

export function MinigameView({ minigameId, players, seed, onFinish }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [countdown, setCountdown] = useState(3);
  const [status, setStatus] = useState('');
  const [labels, setLabels] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const meta = minigameById(minigameId);
    const factory = MINIGAME_FACTORIES[minigameId];

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    mount.appendChild(renderer.domElement);

    const scene = baseScene(meta.venue === 'stadium' ? 'pitch' : meta.venue === 'pit' ? 'pit' : 'street');
    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / mount.clientHeight, 0.3, 700);
    const input = new InputState();
    input.attach();

    let cursor = 0;
    const mgPlayers: MinigamePlayer[] = players.map((p, i) => ({
      id: p.id,
      slot: i,
      name: p.name,
      control: p.control,
      driver: driverById(p.driverId),
    }));

    const instance: MinigameInstance = factory({
      scene,
      camera,
      players: mgPlayers,
      input,
      rand: () => rngAt(seed + minigameId.length * 977, cursor++),
    });

    const clock = new THREE.Clock();
    let elapsed = 0;
    let lead = -3.2; // countdown before the action starts
    let raf = 0;

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', onResize);

    const finish = () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      onFinish(instance.scores());
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05);
      lead += dt;
      if (lead < 0) {
        setCountdown(Math.ceil(-lead));
        renderer.render(scene, camera);
        input.endFrame();
        return;
      }
      setCountdown(0);
      elapsed += dt;
      instance.update(dt, elapsed);
      input.endFrame();
      renderer.render(scene, camera);

      const limit = meta.durationMs / 1000;
      setTimeLeft(Math.max(0, limit - elapsed));
      setStatus(instance.hud?.() ?? '');
      const next: Record<number, string> = {};
      players.forEach((p) => (next[p.id] = instance.scoreLabel?.(p.id) ?? ''));
      setLabels(next);

      if (instance.finished() || elapsed >= limit) {
        cancelAnimationFrame(raf);
        setTimeout(finish, 900);
      }
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      input.detach();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minigameId]);

  const meta = minigameById(minigameId);

  return (
    <div className="minigame-root">
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />
      <div className="minigame-hud">
        <div>
          <h2 style={{ fontSize: 30 }}>{meta.name}</h2>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>{meta.controls}</div>
          <div className="mg-timer">{timeLeft.toFixed(1)}</div>
        </div>
        <div className="mg-scores">
          {players.map((p) => (
            <div key={p.id} className="mg-score">
              <div>{p.name}</div>
              <div style={{ color: 'var(--gold)' }}>{labels[p.id]}</div>
            </div>
          ))}
        </div>
      </div>
      {countdown > 0 && <div className="countdown">{countdown}</div>}
      <div className="mg-status">{status}</div>
    </div>
  );
}
