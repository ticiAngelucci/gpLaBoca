import { useEffect, useMemo, useRef, useState } from 'react';
import { ranking } from '../engine/engine';
import { tile } from '../engine/board';
import { driverById } from '../engine/drivers';
import { ITEMS } from '../engine/items';
import { minigameById } from '../engine/minigameList';
import { useStore } from '../store';
import type { ItemId, Player } from '../engine/types';
import { BoardView } from './BoardView';
import { MinigameView } from './MinigameView';

const DICE_FACES = ['·', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

function PlayerCard({ p, active }: { p: Player; active: boolean }) {
  const d = driverById(p.driverId);
  return (
    <div className={`panel player-card ${active ? 'active' : ''}`}>
      <div className="bar" style={{ background: `linear-gradient(${d.colors[0]}, ${d.colors[1]})` }} />
      <div>
        <div className="name">{p.name}</div>
        <div className="sub">
          {d.name} · {d.team}
          {p.control === 'cpu' ? ' · CPU' : ''}
        </div>
        <div className="sub">{p.items.map((i) => ITEMS[i].icon).join(' ')}</div>
      </div>
      <div className="totals">
        <div style={{ color: 'var(--gold)' }}>⭐ {p.stars}</div>
        <div>🪙 {p.coins}</div>
      </div>
    </div>
  );
}

export function GameScreen() {
  const game = useStore((s) => s.game);
  const dispatch = useStore((s) => s.dispatch);
  const quit = useStore((s) => s.quit);
  const [diceRolling, setDiceRolling] = useState(false);
  const [itemTarget, setItemTarget] = useState<ItemId | null>(null);
  const timers = useRef<number[]>([]);

  const after = (ms: number, fn: () => void) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  };

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const phase = game?.phase;
  const current = game?.players[game.current];
  const isCpu = current?.control === 'cpu';

  // Turn automation: kicks the state machine forward and plays the CPU hands.
  useEffect(() => {
    if (!game) return;
    if (phase === 'turn_start') {
      after(250, () => dispatch({ type: 'START_TURN' }));
    } else if (phase === 'awaiting_roll' && isCpu) {
      after(700, () => {
        const cpu = game.players[game.current];
        const offensive = cpu.items.find((i) => ITEMS[i].target === 'rival');
        const rival = ranking(game).find((p) => p.id !== cpu.id);
        if (offensive && rival && Math.random() < 0.6) {
          dispatch({ type: 'USE_ITEM', item: offensive, targetId: rival.id });
        } else if (cpu.items.length && Math.random() < 0.5) {
          const self = cpu.items.find((i) => ITEMS[i].target === 'self');
          if (self) dispatch({ type: 'USE_ITEM', item: self });
        }
        after(450, () => {
          setDiceRolling(true);
          dispatch({ type: 'ROLL' });
        });
      });
    } else if (phase === 'junction' && isCpu) {
      after(900, () => {
        const opts = game.junctionOptions;
        const stadium = opts.find((o) => tile(o).inside);
        dispatch({ type: 'CHOOSE_PATH', tile: stadium ?? opts[Math.floor(Math.random() * opts.length)] });
      });
    } else if (phase === 'resolving') {
      after(1500, () => dispatch({ type: 'CONTINUE' }));
    } else if (phase === 'minigame_intro') {
      after(3200, () => dispatch({ type: 'START_MINIGAME' }));
    } else if (phase === 'round_end') {
      after(1800, () => dispatch({ type: 'CONTINUE' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, game?.current, game?.round]);

  useEffect(() => {
    if (game?.lastRoll != null) {
      setDiceRolling(true);
      const id = window.setTimeout(() => setDiceRolling(false), 650);
      return () => clearTimeout(id);
    }
  }, [game?.lastRoll]);

  const rank = useMemo(() => (game ? ranking(game) : []), [game]);
  if (!game || !current) return null;

  const standing = tile(current.tile);
  const canAct = phase === 'awaiting_roll' && !isCpu;

  return (
    <div className="game-root">
      <BoardView state={game} onPathComplete={() => dispatch({ type: 'STEP_DONE' })} />

      <div className="hud">
        <div className="player-cards">
          {game.players.map((p) => (
            <PlayerCard key={p.id} p={p} active={p.id === game.current} />
          ))}
          <button className="btn" style={{ marginTop: 8 }} onClick={quit}>
            Salir al menú
          </button>
        </div>

        <div className="panel topbar">
          <span className="display">Ronda {Math.min(game.round, game.settings.totalRounds)}</span>
          <span className="sep">/</span>
          <span>{game.settings.totalRounds}</span>
          <span className="sep">·</span>
          <span>Turno de {current.name}</span>
          <span className="sep">·</span>
          <span>📍 {standing.label ?? 'Calles de La Boca'}</span>
          {game.bomboneraOpen && <span style={{ color: 'var(--gold)' }}>· 🏟️ Bombonera abierta</span>}
        </div>

        <div className="panel feed">
          <h3 style={{ fontSize: 18, marginBottom: 8 }}>Ranking</h3>
          {rank.map((p, i) => (
            <div key={p.id} className="entry">
              {i + 1}º {p.name} · ⭐{p.stars} 🪙{p.coins} 🎮{p.minigameWins}
            </div>
          ))}
          <h3 style={{ fontSize: 18, margin: '12px 0 8px' }}>Eventos</h3>
          {game.log.slice(0, 7).map((l) => (
            <div key={l.id} className={`entry ${l.tone}`}>
              {l.text}
            </div>
          ))}
        </div>

        <div className="panel action-bar">
          <div className={`dice ${diceRolling ? 'rolling' : ''}`}>
            {diceRolling ? '🎲' : (game.lastRoll ?? 0) <= 6 ? DICE_FACES[game.lastRoll ?? 0] : game.lastRoll}
          </div>
          <div>
            <div className="display" style={{ fontSize: 22 }}>
              {phase === 'awaiting_roll'
                ? isCpu
                  ? `${current.name} está pensando…`
                  : '¡Tirá el dado!'
                : phase === 'junction'
                  ? 'Elegí camino'
                  : phase === 'moving'
                    ? 'Avanzando…'
                    : phase === 'resolving'
                      ? standing.label ?? 'Resolviendo casillero'
                      : 'Party en marcha'}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>
              {current.name}: ⭐{current.stars} · 🪙{current.coins} · trofeo a {game.settings.starPrice} monedas
            </div>
          </div>

          <div className="items">
            {current.items.map((item, idx) => (
              <button
                key={`${item}-${idx}`}
                className="item-btn"
                disabled={!canAct}
                title={`${ITEMS[item].name}: ${ITEMS[item].description}`}
                onClick={() => {
                  if (ITEMS[item].target === 'rival') setItemTarget(item);
                  else dispatch({ type: 'USE_ITEM', item });
                }}
              >
                {ITEMS[item].icon}
              </button>
            ))}
          </div>

          {phase === 'junction' && !isCpu ? (
            <div className="junction-buttons">
              {game.junctionOptions.map((opt) => (
                <button
                  key={opt}
                  className="btn primary"
                  onClick={() => dispatch({ type: 'CHOOSE_PATH', tile: opt })}
                >
                  {tile(opt).inside ? '🏟️ Entrar a La Bombonera' : (tile(opt).label ?? `Camino ${opt}`)}
                </button>
              ))}
            </div>
          ) : (
            <button className="btn primary big" disabled={!canAct} onClick={() => dispatch({ type: 'ROLL' })}>
              Tirar dado
            </button>
          )}
        </div>
      </div>

      {itemTarget && (
        <div className="overlay" onClick={() => setItemTarget(null)}>
          <div className="panel card" onClick={(e) => e.stopPropagation()}>
            <h2>{ITEMS[itemTarget].name}</h2>
            <p>{ITEMS[itemTarget].description}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              {game.players
                .filter((p) => p.id !== current.id)
                .map((p) => (
                  <button
                    key={p.id}
                    className="btn primary"
                    onClick={() => {
                      dispatch({ type: 'USE_ITEM', item: itemTarget, targetId: p.id });
                      setItemTarget(null);
                    }}
                  >
                    {p.name}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {phase === 'bombonera_cutscene' && (
        <div className="overlay bombonera-overlay">
          <div className="panel card">
            <h2>La Bombonera</h2>
            <p>
              Se abre el portón y el ruido de la tribuna tapa los motores. Los autos bajan por el túnel y
              salen al césped: acá las monedas valen doble y se juega un minijuego dentro de la cancha.
            </p>
            <button className="btn primary big" onClick={() => dispatch({ type: 'CONTINUE' })}>
              Entrar
            </button>
          </div>
        </div>
      )}

      {phase === 'minigame_intro' && game.pendingMinigame && (
        <div className="overlay">
          <div className="panel card">
            <div className="display" style={{ color: 'var(--gold)' }}>Minijuego</div>
            <h2>{minigameById(game.pendingMinigame).name}</h2>
            <p>{minigameById(game.pendingMinigame).tagline}</p>
            <div className="keys">
              <span className="key">P1: W A S D + Espacio</span>
              <span className="key">P2: Flechas + Enter</span>
              <span className="key">P3: I J K L + H</span>
              <span className="key">P4: Numpad 8456 + 0</span>
            </div>
            <div style={{ marginTop: 18 }}>
              <button className="btn primary big" onClick={() => dispatch({ type: 'START_MINIGAME' })}>
                ¡Jugar!
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'minigame' && game.pendingMinigame && (
        <MinigameView
          minigameId={game.pendingMinigame}
          players={game.players}
          seed={game.seed + game.round}
          onFinish={(scores) => dispatch({ type: 'FINISH_MINIGAME', scores })}
        />
      )}

      {phase === 'minigame_results' && game.lastMinigameResults && (
        <div className="overlay">
          <div className="panel card">
            <h2>Resultados</h2>
            <table className="results-table">
              <tbody>
                {game.lastMinigameResults.map((r) => {
                  const p = game.players.find((x) => x.id === r.playerId);
                  return (
                    <tr key={r.playerId}>
                      <td className="rank">{r.rank}º</td>
                      <td>{p?.name}</td>
                      <td>{r.score} pts</td>
                      <td style={{ color: 'var(--gold)' }}>+{r.coins} 🪙</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button className="btn primary big" onClick={() => dispatch({ type: 'CLOSE_RESULTS' })}>
              Seguir
            </button>
          </div>
        </div>
      )}

      {phase === 'round_end' && (
        <div className="overlay">
          <div className="panel card">
            <h2>Ronda {game.round}</h2>
            <p>{rank[0].name} lidera con {rank[0].stars} estrellas y {rank[0].coins} monedas.</p>
          </div>
        </div>
      )}

      {phase === 'game_over' && (
        <div className="overlay">
          <div className="panel card">
            <div className="display" style={{ color: 'var(--gold)' }}>Bandera a cuadros</div>
            <h2>{game.players.find((p) => p.id === game.winnerId)?.name} es campeón de La Boca</h2>
            <table className="results-table">
              <tbody>
                {rank.map((p, i) => (
                  <tr key={p.id}>
                    <td className="rank">{i + 1}º</td>
                    <td>{p.name}</td>
                    <td>⭐ {p.stars}</td>
                    <td>🪙 {p.coins}</td>
                    <td>🎮 {p.minigameWins}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn primary big" onClick={quit}>
              Volver al menú
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
