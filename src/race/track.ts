import * as THREE from 'three';

export interface TrackSample {
  /** Centre of the racing surface. */
  pos: THREE.Vector3;
  /** Unit tangent pointing in race direction. */
  dir: THREE.Vector3;
  /** Unit vector pointing to the right of the racing direction. */
  right: THREE.Vector3;
  /** Half width of the tarmac at this point. */
  half: number;
  /** Distance from the start line along the centre line. */
  dist: number;
}

export interface Ramp {
  pos: THREE.Vector3;
  yaw: number;
  width: number;
  length: number;
  /** Vertical speed given to a car crossing at full speed. */
  launch: number;
}

export interface ShortcutZone {
  /** Rectangle centre. */
  pos: THREE.Vector3;
  yaw: number;
  size: [number, number];
  /** Surface grip, 1 is clean tarmac. */
  grip: number;
  label: string;
}

/**
 * Control points of the closed circuit: [x, z, halfWidth]. The lap leaves the
 * start line on Caminito, runs the docks, comes back through the neighbourhood
 * and then dives straight down the middle of the stadium before the last turn.
 */
const CONTROL: [number, number, number][] = [
  [0, 0, 10],
  [86, 6, 9],
  [166, -12, 8.5],
  [218, -64, 8],
  [230, -140, 8],
  [200, -212, 8],
  [136, -248, 9],
  [62, -252, 8],
  [-2, -240, 9],
  [-72, -226, 9],
  [-140, -200, 9],
  [-140, -120, 14],
  [-140, -40, 10],
  [-80, -6, 9],
];

/** Centre of La Bombonera; the circuit crosses the pitch along its long axis. */
export const STADIUM_CENTER = new THREE.Vector3(-140, 0, -120);

const curve = new THREE.CatmullRomCurve3(
  CONTROL.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  true,
  'catmullrom',
  0.5,
);

const SAMPLES = 900;

function halfWidthAt(t: number): number {
  const n = CONTROL.length;
  const f = t * n;
  const i = Math.floor(f) % n;
  const j = (i + 1) % n;
  const k = f - Math.floor(f);
  return CONTROL[i][2] * (1 - k) + CONTROL[j][2] * k;
}

function buildSamples(): TrackSample[] {
  const out: TrackSample[] = [];
  let dist = 0;
  let prev: THREE.Vector3 | null = null;
  for (let i = 0; i < SAMPLES; i++) {
    const t = i / SAMPLES;
    const pos = curve.getPointAt(t);
    const dir = curve.getTangentAt(t).setY(0).normalize();
    const right = new THREE.Vector3(dir.z, 0, -dir.x);
    if (prev) dist += pos.distanceTo(prev);
    prev = pos;
    out.push({ pos, dir, right, half: halfWidthAt(t), dist });
  }
  return out;
}

export const SAMPLES_LIST: TrackSample[] = buildSamples();
export const TRACK_LENGTH: number =
  SAMPLES_LIST[SAMPLES_LIST.length - 1].dist +
  SAMPLES_LIST[SAMPLES_LIST.length - 1].pos.distanceTo(SAMPLES_LIST[0].pos);

/** Grid buckets so the per frame nearest sample lookup stays cheap. */
const CELL = 24;
const grid = new Map<string, number[]>();
const key = (x: number, z: number) => `${Math.floor(x / CELL)}:${Math.floor(z / CELL)}`;
SAMPLES_LIST.forEach((s, i) => {
  const k = key(s.pos.x, s.pos.z);
  const bucket = grid.get(k);
  if (bucket) bucket.push(i);
  else grid.set(k, [i]);
});

export function sampleAtIndex(i: number): TrackSample {
  return SAMPLES_LIST[((i % SAMPLES) + SAMPLES) % SAMPLES];
}

export function sampleAtDistance(d: number): TrackSample {
  const wrapped = ((d % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH;
  const i = Math.round((wrapped / TRACK_LENGTH) * SAMPLES);
  return sampleAtIndex(i);
}

/**
 * Nearest centre line sample. `hint` is the previous index, which keeps the
 * search local while a car is racing and avoids jumping across the lap line.
 */
export function nearestSample(pos: THREE.Vector3, hint?: number): number {
  let best = -1;
  let bestD = Infinity;
  const test = (i: number) => {
    const s = sampleAtIndex(i);
    const d = (s.pos.x - pos.x) ** 2 + (s.pos.z - pos.z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = ((i % SAMPLES) + SAMPLES) % SAMPLES;
    }
  };
  if (hint !== undefined) {
    for (let i = hint - 40; i <= hint + 60; i++) test(i);
    if (bestD < 900) return best;
  }
  for (let cx = -1; cx <= 1; cx++) {
    for (let cz = -1; cz <= 1; cz++) {
      const bucket = grid.get(key(pos.x + cx * CELL, pos.z + cz * CELL));
      if (bucket) bucket.forEach(test);
    }
  }
  if (best >= 0) return best;
  SAMPLES_LIST.forEach((_, i) => test(i));
  return best;
}

/** Places a feature on the racing line at a fraction of the lap. */
function atLap(fraction: number): TrackSample {
  return sampleAtDistance(fraction * TRACK_LENGTH);
}

function ramp(fraction: number, width: number, length: number, launch: number): Ramp {
  const s = atLap(fraction);
  return {
    pos: s.pos.clone(),
    yaw: Math.atan2(s.dir.x, s.dir.z),
    width,
    length,
    launch,
  };
}

export const RAMPS: Ramp[] = [
  ramp(0.2, 16, 10, 9.5),
  ramp(0.46, 15, 9, 8.5),
  ramp(0.66, 24, 9, 7.5),
];

function shortcut(
  fraction: number,
  offset: number,
  size: [number, number],
  grip: number,
  label: string,
): ShortcutZone {
  const s = atLap(fraction);
  return {
    pos: s.pos.clone().addScaledVector(s.right, offset),
    yaw: Math.atan2(s.dir.x, s.dir.z),
    size,
    grip,
    label,
  };
}

export const SHORTCUTS: ShortcutZone[] = [
  shortcut(0.12, 16, [20, 60], 0.88, 'Atajo del puerto'),
  shortcut(0.55, -16, [20, 56], 0.85, 'Pasillo de los conventillos'),
  shortcut(0.95, 15, [18, 48], 0.86, 'Plaza de Caminito'),
];

export interface ItemBoxSpot {
  pos: THREE.Vector3;
}

function itemRow(distance: number, offsets: number[]): ItemBoxSpot[] {
  const s = sampleAtDistance(distance);
  return offsets.map((o) => ({
    pos: s.pos.clone().addScaledVector(s.right, o * s.half * 0.75).setY(1.2),
  }));
}

export const ITEM_BOXES: ItemBoxSpot[] = [
  ...itemRow(TRACK_LENGTH * 0.08, [-0.8, -0.27, 0.27, 0.8]),
  ...itemRow(TRACK_LENGTH * 0.26, [-0.6, 0, 0.6]),
  ...itemRow(TRACK_LENGTH * 0.42, [-0.8, -0.27, 0.27, 0.8]),
  ...itemRow(TRACK_LENGTH * 0.6, [-0.6, 0, 0.6]),
  ...itemRow(TRACK_LENGTH * 0.75, [-0.8, -0.27, 0.27, 0.8]),
  ...itemRow(TRACK_LENGTH * 0.9, [-0.5, 0.5]),
];

/** Rectangle test in the local frame of a feature rotated `yaw` around Y. */
export function inRect(
  pos: THREE.Vector3,
  center: THREE.Vector3,
  yaw: number,
  sx: number,
  sz: number,
): boolean {
  const dx = pos.x - center.x;
  const dz = pos.z - center.z;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return Math.abs(dx * cos - dz * sin) <= sx / 2 && Math.abs(dx * sin + dz * cos) <= sz / 2;
}

/** The shortcut a car is standing on, if any. */
export function shortcutAt(pos: THREE.Vector3): ShortcutZone | null {
  for (const z of SHORTCUTS) {
    if (inRect(pos, z.pos, z.yaw, z.size[0], z.size[1])) return z;
  }
  return null;
}

export function surfaceAt(pos: THREE.Vector3, sampleIndex: number): number {
  const s = sampleAtIndex(sampleIndex);
  const lateral = Math.abs(pos.clone().sub(s.pos).dot(s.right));
  if (lateral <= s.half) return 1;
  const zone = shortcutAt(pos);
  if (zone) return zone.grip;
  return lateral < s.half + 4 ? 0.7 : 0.45;
}

/** Hard boundary that keeps cars out of the scenery. */
export function wallLimit(pos: THREE.Vector3, sampleIndex: number): number {
  if (shortcutAt(pos)) return 60;
  return sampleAtIndex(sampleIndex).half + 7;
}

export function startGrid(count: number): { pos: THREE.Vector3; yaw: number }[] {
  const out: { pos: THREE.Vector3; yaw: number }[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / 2);
    const side = i % 2 === 0 ? -1 : 1;
    const s = sampleAtDistance(TRACK_LENGTH - 14 - row * 9);
    out.push({
      pos: s.pos.clone().addScaledVector(s.right, side * s.half * 0.45).setY(0),
      yaw: Math.atan2(s.dir.x, s.dir.z),
    });
  }
  return out;
}
