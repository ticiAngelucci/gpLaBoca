import { useEffect, useRef, useState } from 'react';
import { ITEMS } from '../race/items';
import { SAMPLES_LIST } from '../race/track';
import { useStore } from '../store';
import { RaceScene, type HudSnapshot } from '../three/raceScene';
import { DRIVERS } from '../race/drivers';
import { Minimap } from './Minimap';

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

const ORDINAL = ['', '1º', '2º', '3º', '4º', '5º', '6º', '7º', '8º'];

export function RaceScreen() {
  const setup = useStore((s) => s.setup);
  const raceKey = useStore((s) => s.raceKey);
  const restart = useStore((s) => s.restart);
  const quit = useStore((s) => s.quit);
  const mount = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<HudSnapshot | null>(null);

  useEffect(() => {
    if (!mount.current) return;
    const scene = new RaceScene(
      mount.current,
      {
        laps: setup.laps,
        gridSize: setup.gridSize,
        playerDriverId: setup.driverId,
        difficulty: setup.difficulty,
        seed: Date.now() % 100000,
        autopilot: new URLSearchParams(location.search).has('auto'),
      },
      DRIVERS.map((d) => d.id),
    );
    scene.setHudListener(setHud);
    scene.start();
    return () => scene.dispose();
  }, [raceKey, setup.laps, setup.gridSize, setup.driverId, setup.difficulty]);

  const item = hud?.item ? ITEMS[hud.item] : null;
  const finished = hud?.phase === 'finished';

  return (
    <div className="race-root">
      <div className="viewport" ref={mount} />

      {hud && (
        <div className={`hud ${hud.mud > 0 ? 'mud' : ''}`}>
          <div className="hud-left">
            <div className="hud-pos">
              <b>{ORDINAL[hud.position]}</b>
              <span>/ {hud.gridSize}</span>
            </div>
            <div className="hud-lap">
              Vuelta <b>{hud.lap}</b> / {hud.totalLaps}
            </div>
            <div className="hud-time">{fmt(hud.time)}</div>
            {hud.bestLap !== null && <div className="hud-best">Mejor vuelta {fmt(hud.bestLap)}</div>}
          </div>

          <div className="hud-standings">
            {hud.standings.map((s) => (
              <div key={s.id} className={`row ${s.isPlayer ? 'me' : ''}`}>
                <span className="pos">{s.position}</span>
                <i className="dot" style={{ background: s.color }} />
                <span className="name">{s.name}</span>
                <span className="lap">{s.finished ? '🏁' : `V${s.lap}`}</span>
              </div>
            ))}
          </div>

          <div className="hud-item">
            <div className={`item-slot ${item ? 'full' : ''}`}>
              <span>{item ? item.icon : '—'}</span>
            </div>
            <small>{item ? item.name : 'Sin objeto'}</small>
            {hud.shield > 0 && <small className="tag shield">Escudo {hud.shield.toFixed(0)}s</small>}
            {hud.boost > 0 && <small className="tag boost">Turbo</small>}
            {hud.rain && <small className="tag rain">Lluvia</small>}
          </div>

          <div className="hud-speed">
            <div className="dial">
              <b>{Math.round(hud.speed * 7.2)}</b>
              <small>km/h</small>
            </div>
            <div className="drift-bar">
              <i style={{ width: `${Math.min(100, (hud.driftCharge / 2.4) * 100)}%` }} />
            </div>
            {hud.offRoad && <div className="warn">¡Fuera de pista!</div>}
          </div>

          <Minimap samples={SAMPLES_LIST} cars={hud.minimap} />

          <div className="hud-events">
            {hud.events.slice(0, 3).map((e, i) => (
              <div key={`${e.at}-${i}`} className={`ev ${e.tone}`}>
                {e.text}
              </div>
            ))}
          </div>

          {hud.stadium && (
            <div className="stadium-banner">
              <b>LA BOMBONERA</b>
              <span>Cruzá la cancha y salí por el túnel</span>
            </div>
          )}

          {hud.phase === 'countdown' && (
            <div className="countdown">
              {hud.countdown > 2.6 ? '3' : hud.countdown > 1.6 ? '2' : hud.countdown > 0.6 ? '1' : '¡YA!'}
            </div>
          )}
        </div>
      )}

      {finished && hud && (
        <div className="overlay">
          <div className="panel card results">
            <h2>Bandera a cuadros</h2>
            <ol>
              {hud.standings.map((s) => (
                <li key={s.id} className={s.isPlayer ? 'me' : ''}>
                  <span>{s.position}º</span>
                  <i className="dot" style={{ background: s.color }} />
                  <b>{s.name}</b>
                  <em>{s.team}</em>
                  <span className="t">{s.finishTime !== null ? fmt(s.finishTime) : 'DNF'}</span>
                </li>
              ))}
            </ol>
            <div className="row">
              <button className="btn primary big" onClick={restart}>
                Revancha
              </button>
              <button className="btn big" onClick={quit}>
                Menú
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
