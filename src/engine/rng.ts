/**
 * Deterministic PRNG. The cursor lives inside the game state so every client in
 * a future online match replays the exact same sequence from the same actions.
 */
export function rngAt(seed: number, cursor: number): number {
  let t = (seed + cursor * 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export interface RngHost {
  seed: number;
  rngCursor: number;
}

export function nextFloat(host: RngHost): number {
  const value = rngAt(host.seed, host.rngCursor);
  host.rngCursor += 1;
  return value;
}

export function nextInt(host: RngHost, maxExclusive: number): number {
  return Math.floor(nextFloat(host) * maxExclusive);
}

export function pick<T>(host: RngHost, arr: readonly T[]): T {
  return arr[nextInt(host, arr.length)];
}
