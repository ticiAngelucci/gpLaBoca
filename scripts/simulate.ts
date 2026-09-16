/**
 * Headless play-through of the turn engine. Drives the same actions the UI
 * dispatches, so a deadlock in the state machine fails here instead of in a
 * player's face. Run with: npm run simulate
 */
import { createGame, ranking, reduce } from '../src/engine/engine';
import type { GameAction, GameState } from '../src/engine/types';

function play(seed: number, mode: 'quick' | 'party'): GameState {
  let state = createGame({
    seed,
    mode,
    players: [
      { name: 'P1', driverId: 'voss', control: 'human' },
      { name: 'P2', driverId: 'mensah', control: 'cpu' },
      { name: 'P3', driverId: 'ferraro', control: 'cpu' },
      { name: 'P4', driverId: 'salgado', control: 'cpu' },
    ],
  });

  const send = (action: GameAction) => {
    state = reduce(state, action);
  };

  for (let i = 0; i < 20000 && state.phase !== 'game_over'; i++) {
    switch (state.phase) {
      case 'turn_start':
        send({ type: 'START_TURN' });
        break;
      case 'awaiting_roll': {
        const player = state.players[state.current];
        if (player.items.length && i % 3 === 0) {
          const item = player.items[0];
          const rival = state.players.find((p) => p.id !== player.id);
          send({ type: 'USE_ITEM', item, targetId: rival?.id });
        }
        send({ type: 'ROLL' });
        break;
      }
      case 'moving':
        send({ type: 'STEP_DONE' });
        break;
      case 'junction':
        send({ type: 'CHOOSE_PATH', tile: state.junctionOptions[i % state.junctionOptions.length] });
        break;
      case 'resolving':
      case 'round_end':
      case 'bombonera_cutscene':
        send({ type: 'CONTINUE' });
        break;
      case 'minigame_intro':
        send({ type: 'START_MINIGAME' });
        break;
      case 'minigame':
        send({
          type: 'FINISH_MINIGAME',
          scores: state.players.map((p) => ({ playerId: p.id, score: (p.id * 7 + i) % 23 })),
        });
        break;
      case 'minigame_results':
        send({ type: 'CLOSE_RESULTS' });
        break;
      default:
        throw new Error(`fase inesperada: ${state.phase}`);
    }
  }
  return state;
}

let failures = 0;
for (const mode of ['quick', 'party'] as const) {
  for (let seed = 1; seed <= 12; seed++) {
    const state = play(seed * 7919, mode);
    const ok = state.phase === 'game_over' && state.winnerId !== null;
    const top = ranking(state)[0];
    if (!ok) failures += 1;
    console.log(
      `${ok ? 'OK ' : 'FAIL'} ${mode} seed=${seed * 7919} rondas=${state.round - 1} ` +
        `ganador=${top.name} estrellas=${top.stars} monedas=${top.coins} ` +
        `visitas a la cancha=${state.bomboneraVisits}`,
    );
  }
}

if (failures) {
  console.error(`${failures} partidas no terminaron`);
  process.exit(1);
}
console.log('Todas las partidas simuladas terminaron correctamente.');
