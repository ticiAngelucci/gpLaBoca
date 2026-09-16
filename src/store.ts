import { create } from 'zustand';
import { DRIVERS } from './race/drivers';
import type { RaceConfig } from './race/raceEngine';

export type Screen = 'menu' | 'select' | 'race';
export type Difficulty = RaceConfig['difficulty'];

export interface RaceSetup {
  laps: number;
  gridSize: number;
  difficulty: Difficulty;
  driverId: string;
  label: string;
}

interface Store {
  screen: Screen;
  setup: RaceSetup;
  /** Bumping this remounts the race scene for a rematch. */
  raceKey: number;
  setScreen: (s: Screen) => void;
  patchSetup: (p: Partial<RaceSetup>) => void;
  startRace: () => void;
  restart: () => void;
  quit: () => void;
}

export const useStore = create<Store>((set, get) => ({
  screen: 'menu',
  setup: {
    laps: 3,
    gridSize: 8,
    difficulty: 'pro',
    driverId: DRIVERS[0].id,
    label: 'Copa Caminito',
  },
  raceKey: 0,
  setScreen: (screen) => set({ screen }),
  patchSetup: (p) => set({ setup: { ...get().setup, ...p } }),
  startRace: () => set({ screen: 'race', raceKey: get().raceKey + 1 }),
  restart: () => set({ raceKey: get().raceKey + 1 }),
  quit: () => set({ screen: 'menu' }),
}));
