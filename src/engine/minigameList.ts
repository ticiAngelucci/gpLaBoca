export interface MinigameMeta {
  id: string;
  name: string;
  tagline: string;
  /** 'ffa' runs with every player, 'duel' only with two. */
  format: 'ffa' | 'duel';
  /** Stadium games only fire while the players are inside La Bombonera. */
  venue: 'street' | 'stadium' | 'pit';
  controls: string;
  /** Higher score wins unless this is set. */
  lowerIsBetter?: boolean;
  durationMs: number;
}

export const MINIGAMES: MinigameMeta[] = [
  {
    id: 'sprint_caminito',
    name: 'Sprint por Caminito',
    tagline: 'Carrera corta entre adoquines y turistas.',
    format: 'ffa',
    venue: 'street',
    controls: 'Acelerar / izquierda / derecha',
    durationMs: 32000,
  },
  {
    id: 'esquiva',
    name: 'Esquivá el caos',
    tagline: 'Conos, baches y carros de feria a toda velocidad.',
    format: 'ffa',
    venue: 'street',
    controls: 'Izquierda / derecha',
    durationMs: 30000,
  },
  {
    id: 'boxes',
    name: 'Parada en boxes',
    tagline: 'Cambio de neumáticos contra el reloj.',
    format: 'ffa',
    venue: 'pit',
    controls: 'Botón de acción en el momento justo',
    durationMs: 26000,
  },
  {
    id: 'reflejos',
    name: 'Semáforo de largada',
    tagline: 'Se apagan las luces… reaccioná.',
    format: 'ffa',
    venue: 'street',
    controls: 'Botón de acción',
    durationMs: 24000,
  },
  {
    id: 'penales',
    name: 'Tiro al arco',
    tagline: 'Penales en el corazón de La Bombonera.',
    format: 'ffa',
    venue: 'stadium',
    controls: 'Izquierda / derecha + acción',
    durationMs: 30000,
  },
  {
    id: 'cancha',
    name: 'Vuelta en la cancha',
    tagline: 'Recogé banderines sobre el césped.',
    format: 'ffa',
    venue: 'stadium',
    controls: 'Acelerar / girar',
    durationMs: 30000,
  },
  {
    id: 'duelo',
    name: 'Duelo de pilotos',
    tagline: 'Mano a mano, el primero que falla pierde.',
    format: 'duel',
    venue: 'street',
    controls: 'Botón de acción',
    durationMs: 24000,
  },
];

export const minigameById = (id: string): MinigameMeta =>
  MINIGAMES.find((m) => m.id === id) ?? MINIGAMES[0];
