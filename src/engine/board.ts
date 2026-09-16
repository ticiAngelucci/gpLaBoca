import type { Tile, TileKind } from './types';

type V3 = [number, number, number];

/** Catmull-Rom sampling so the street keeps soft, drivable curves. */
function sampleLoop(points: V3[], count: number, closed: boolean): V3[] {
  const out: V3[] = [];
  const n = points.length;
  const at = (i: number): V3 => {
    if (closed) return points[((i % n) + n) % n];
    return points[Math.min(n - 1, Math.max(0, i))];
  };
  const segments = closed ? n : n - 1;
  for (let s = 0; s < count; s++) {
    const t = (s / count) * segments;
    const i = Math.floor(t);
    const f = t - i;
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const axis = (a: number) =>
      0.5 *
      (2 * p1[a] +
        (-p0[a] + p2[a]) * f +
        (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * f * f +
        (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * f * f * f);
    out.push([axis(0), axis(1), axis(2)]);
  }
  return out;
}

const MAIN_WAYPOINTS: V3[] = [
  [-74, 0, 34], // Caminito - largada
  [-40, 0, 46],
  [-6, 0, 52], // Vuelta de Rocha
  [30, 0, 48], // Puente Transbordador
  [60, 0, 30], // Fundación Proa
  [70, 0, -4], // Av. Pedro de Mendoza
  [54, 0, -38], // Av. Almirante Brown
  [22, 0, -52], // Portón de La Bombonera
  [-14, 0, -54], // Brandsen y Del Valle Iberlucea
  [-48, 0, -44], // Usina del Arte
  [-74, 0, -14], // Murales del barrio
];

const MAIN_COUNT = 56;

const LANDMARKS: Record<number, string> = {
  0: 'Largada · Caminito',
  5: 'Feria de Caminito',
  10: 'Vuelta de Rocha',
  16: 'Puente Transbordador',
  21: 'Fundación Proa',
  27: 'Av. Pedro de Mendoza',
  33: 'Av. Almirante Brown',
  38: 'Portón de La Bombonera',
  44: 'Brandsen y Del Valle Iberlucea',
  48: 'Usina del Arte',
  52: 'Murales del barrio',
};

/** Fixed rhythm of tile types around the main loop. */
const PATTERN: TileKind[] = [
  'coin',
  'normal',
  'item',
  'coin',
  'event',
  'normal',
  'hazard',
  'coin',
  'boost',
  'normal',
  'event',
  'pit',
  'coin',
  'duel',
];

function kindFor(index: number): TileKind {
  if (index === 0) return 'start';
  if (index === 38) return 'gate';
  return PATTERN[index % PATTERN.length];
}

function buildBoard(): { tiles: Tile[]; gateTile: number; startTile: number } {
  const tiles: Tile[] = [];
  const main = sampleLoop(MAIN_WAYPOINTS, MAIN_COUNT, true);

  main.forEach((pos, i) => {
    tiles.push({
      id: i,
      kind: kindFor(i),
      pos,
      next: [(i + 1) % MAIN_COUNT],
      label: LANDMARKS[i],
      coins: 0,
    });
  });

  // Shortcut across the docks: leaves the feria and rejoins past Proa.
  const shortcutFrom = 7;
  const shortcutTo = 24;
  const shortcutPath = sampleLoop(
    [tiles[shortcutFrom].pos, [10, 0, 16], [34, 0, 6], tiles[shortcutTo].pos],
    7,
    false,
  );
  const shortcutIds: number[] = [];
  shortcutPath.slice(1).forEach((pos, i) => {
    const id = tiles.length;
    shortcutIds.push(id);
    tiles.push({
      id,
      kind: i === 2 ? 'hazard' : i === 4 ? 'coin' : 'normal',
      pos,
      next: [],
      label: i === 0 ? 'Atajo del puerto' : undefined,
    });
  });
  shortcutIds.forEach((id, i) => {
    tiles[id].next = [i === shortcutIds.length - 1 ? shortcutTo : shortcutIds[i + 1]];
  });
  tiles[shortcutFrom].next = [shortcutFrom + 1, shortcutIds[0]];
  tiles[shortcutFrom].kind = 'junction';

  // Scenic detour along Del Valle Iberlucea, slower but full of coins.
  const detourFrom = 42;
  const detourTo = 48;
  const detourPath = sampleLoop(
    [tiles[detourFrom].pos, [4, 0, -74], [-24, 0, -76], tiles[detourTo].pos],
    8,
    false,
  );
  const detourIds: number[] = [];
  detourPath.slice(1).forEach((pos, i) => {
    const id = tiles.length;
    detourIds.push(id);
    tiles.push({
      id,
      kind: i % 3 === 0 ? 'coin' : i === 4 ? 'item' : 'normal',
      pos,
      next: [],
      label: i === 0 ? 'Calle de los murales' : undefined,
    });
  });
  detourIds.forEach((id, i) => {
    tiles[id].next = [i === detourIds.length - 1 ? detourTo : detourIds[i + 1]];
  });
  tiles[detourFrom].next = [detourFrom + 1, detourIds[0]];
  tiles[detourFrom].kind = 'junction';

  // --- La Bombonera ------------------------------------------------------
  // The gate tile gains a second exit that only opens on stadium rounds.
  const gateTile = 38;
  const tunnel = sampleLoop(
    [tiles[gateTile].pos, [16, 0, -64], [2, -1.5, -72], [-6, -2.5, -84]],
    4,
    false,
  );
  const insideIds: number[] = [];
  const pushInside = (pos: V3, kind: TileKind, label?: string) => {
    const id = tiles.length;
    insideIds.push(id);
    tiles.push({ id, kind, pos, next: [], label, inside: true });
    return id;
  };

  tunnel.slice(1).forEach((pos, i) =>
    pushInside(pos, 'normal', i === 0 ? 'Túnel de vestuarios' : undefined),
  );

  // Pitch loop: the camera opens up here and the board wraps the field.
  const pitch = sampleLoop(
    [
      [-22, -3, -86],
      [-22, -3, -104],
      [0, -3, -112],
      [22, -3, -104],
      [22, -3, -86],
      [0, -3, -78],
    ],
    10,
    true,
  );
  pitch.forEach((pos, i) => {
    const kind: TileKind = i === 0 ? 'stadium' : i === 5 ? 'stadium' : i % 2 === 0 ? 'coin' : 'event';
    pushInside(pos, kind, i === 0 ? 'Salida a la cancha' : i === 5 ? 'Círculo central' : undefined);
  });

  const tunnelIds = insideIds.slice(0, 3);
  const pitchIds = insideIds.slice(3);
  tunnelIds.forEach((id, i) => {
    tiles[id].next = [i === tunnelIds.length - 1 ? pitchIds[0] : tunnelIds[i + 1]];
  });
  pitchIds.forEach((id, i) => {
    tiles[id].next = [pitchIds[(i + 1) % pitchIds.length]];
  });
  // Exit ramp back to the streets, taken automatically when leaving the pitch.
  const exitPath = sampleLoop([[20, -2, -74], [30, -1, -62], tiles[41].pos], 3, false);
  const exitIds: number[] = [];
  exitPath.slice(0, 2).forEach((pos, i) => {
    const id = tiles.length;
    exitIds.push(id);
    tiles.push({ id, kind: 'normal', pos, next: [], inside: i === 0, label: i === 0 ? 'Rampa de salida' : undefined });
  });
  exitIds.forEach((id, i) => {
    tiles[id].next = [i === exitIds.length - 1 ? 41 : exitIds[i + 1]];
  });
  // Leaving the pitch: the tile that closes the pitch loop also points outside.
  tiles[pitchIds[pitchIds.length - 1]].next = [pitchIds[0], exitIds[0]];
  tiles[gateTile].next = [gateTile + 1, tunnelIds[0]];

  return { tiles, gateTile, startTile: 0 };
}

const built = buildBoard();

export const BOARD: Tile[] = built.tiles;
export const GATE_TILE = built.gateTile;
export const START_TILE = built.startTile;
export const MAIN_LOOP_LENGTH = MAIN_COUNT;
/** Candidate tiles where the trophy can appear (never inside the tunnel). */
export const TROPHY_SPOTS = BOARD.filter(
  (t) => !t.inside && t.kind !== 'start' && t.kind !== 'gate' && t.kind !== 'junction',
).map((t) => t.id);

export const tile = (id: number): Tile => BOARD[id];
