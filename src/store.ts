import { create } from 'zustand';
import { createGame, reduce } from './engine/engine';
import type { GameAction, GameState, ItemId } from './engine/types';

export type Screen = 'menu' | 'select' | 'game';

export interface PlayerSetup {
  name: string;
  driverId: string;
  control: 'human' | 'cpu';
}

interface Store {
  screen: Screen;
  mode: 'quick' | 'party';
  setup: PlayerSetup[];
  game: GameState | null;
  /** True while the board renderer is animating a car. */
  animating: boolean;
  cameraFocus: number | null;
  setScreen: (s: Screen) => void;
  setMode: (m: 'quick' | 'party') => void;
  setSetup: (s: PlayerSetup[]) => void;
  startGame: () => void;
  dispatch: (action: GameAction) => void;
  useItem: (item: ItemId, targetId?: number) => void;
  setAnimating: (v: boolean) => void;
  quit: () => void;
}

export const useStore = create<Store>((set, get) => ({
  screen: 'menu',
  mode: 'party',
  setup: [
    { name: 'Jugador 1', driverId: 'voss', control: 'human' },
    { name: 'CPU Kofi', driverId: 'mensah', control: 'cpu' },
    { name: 'CPU Luca', driverId: 'ferraro', control: 'cpu' },
    { name: 'CPU Nico', driverId: 'salgado', control: 'cpu' },
  ],
  game: null,
  animating: false,
  cameraFocus: null,
  setScreen: (screen) => set({ screen }),
  setMode: (mode) => set({ mode }),
  setSetup: (setup) => set({ setup }),
  startGame: () => {
    const { setup, mode } = get();
    set({ game: createGame({ mode, players: setup }), screen: 'game', animating: false });
  },
  dispatch: (action) => {
    const game = get().game;
    if (!game) return;
    set({ game: reduce(game, action) });
  },
  useItem: (item, targetId) => get().dispatch({ type: 'USE_ITEM', item, targetId }),
  setAnimating: (animating) => set({ animating }),
  quit: () => set({ screen: 'menu', game: null }),
}));
