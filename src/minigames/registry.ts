import type { MinigameFactory } from './framework';
import { duelo, esquiva, reflejos, sprintCaminito } from './streetGames';
import { boxes, cancha, penales } from './stadiumGames';

export const MINIGAME_FACTORIES: Record<string, MinigameFactory> = {
  sprint_caminito: sprintCaminito,
  esquiva,
  reflejos,
  duelo,
  boxes,
  penales,
  cancha,
};
