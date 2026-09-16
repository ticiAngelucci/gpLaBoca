import { DRIVERS } from '../src/race/drivers';
import { NO_INPUT, createRace, stepRace, type RaceState } from '../src/race/raceEngine';

/**
 * Headless race: every car is driven by the AI (the player kart included, by
 * feeding it no input) so the track, the lap counter and the AI line can be
 * validated without a browser.
 */
function race(seed: number, laps: number, grid: number): RaceState {
  const state = createRace(
    { laps, gridSize: grid, playerDriverId: DRIVERS[0].id, difficulty: 'pro', seed },
    DRIVERS.map((d) => d.id),
  );
  // The human kart is left stationary on purpose: it must not break the race.
  const maxSteps = 60 * 60 * 8;
  let steps = 0;
  const done = () => state.karts.every((k) => k.isPlayer || k.finished);
  while (!done() && steps < maxSteps) {
    stepRace(state, NO_INPUT, 1 / 60);
    steps += 1;
  }
  return state;
}

let failures = 0;
for (const seed of [11, 202, 3003, 40404, 55555]) {
  for (const [laps, grid] of [
    [2, 6],
    [3, 8],
  ] as const) {
    const state = race(seed, laps, grid);
    const ai = state.karts.filter((k) => !k.isPlayer);
    const finishedAI = ai.filter((k) => k.finished);
    const best = ai
      .map((k) => k.bestLap)
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b)[0];
    const ok = finishedAI.length === ai.length && best !== undefined && best > 15 && best < 130;
    if (!ok) failures += 1;
    console.log(
      `${ok ? 'OK ' : 'MAL'} seed=${seed} vueltas=${laps} grilla=${grid} ` +
        `terminaron=${finishedAI.length}/${ai.length} ` +
        `mejor vuelta=${best ? best.toFixed(2) : '—'}s ` +
        `ganador=${state.karts.find((k) => k.position === 1)?.driver.name}`,
    );
  }
}

if (failures > 0) {
  console.error(`${failures} simulaciones fallaron.`);
  process.exit(1);
}
console.log('Todas las carreras simuladas terminaron correctamente.');
