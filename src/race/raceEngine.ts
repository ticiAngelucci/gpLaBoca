import * as THREE from 'three';
import { driverById, type Driver } from './drivers';
import { drawItem, type ItemId } from './items';
import {
  ITEM_BOXES,
  RAMPS,
  SHORTCUTS,
  TRACK_LENGTH,
  inRect,
  nearestSample,
  sampleAtDistance,
  sampleAtIndex,
  startGrid,
  surfaceAt,
  wallLimit,
} from './track';

export interface KartInput {
  throttle: number;
  brake: number;
  steer: number;
  drift: boolean;
  use: boolean;
}

export const NO_INPUT: KartInput = { throttle: 0, brake: 0, steer: 0, drift: false, use: false };

export interface Kart {
  id: number;
  driver: Driver;
  isPlayer: boolean;
  pos: THREE.Vector3;
  yaw: number;
  speed: number;
  vy: number;
  airborne: boolean;
  /** Visual slip angle used by the renderer. */
  slip: number;
  driftDir: number;
  driftCharge: number;
  boost: number;
  spin: number;
  /** Seconds spent stranded off the racing line before a rescue. */
  stuck: number;
  mud: number;
  shield: number;
  offroadPass: number;
  item: ItemId | null;
  itemCooldown: number;
  sampleIndex: number;
  lapDist: number;
  lap: number;
  progress: number;
  position: number;
  finished: boolean;
  finishTime: number | null;
  lapStart: number;
  bestLap: number | null;
  offRoad: boolean;
  grip: number;
  aiLane: number;
  aiTimer: number;
}

export interface Projectile {
  id: number;
  pos: THREE.Vector3;
  yaw: number;
  speed: number;
  ownerId: number;
  targetId: number | null;
  ttl: number;
}

export interface Hazard {
  id: number;
  pos: THREE.Vector3;
  ttl: number;
  ownerId: number;
}

export interface RaceEvent {
  text: string;
  tone: 'good' | 'bad' | 'neutral';
  at: number;
}

export type RacePhase = 'countdown' | 'racing' | 'finished';

export interface RaceState {
  phase: RacePhase;
  time: number;
  countdown: number;
  totalLaps: number;
  karts: Kart[];
  projectiles: Projectile[];
  hazards: Hazard[];
  /** Seconds left of item box respawn, one per spot. */
  boxCooldown: number[];
  rain: number;
  events: RaceEvent[];
  rand: () => number;
  /** AI speed multiplier derived from the chosen difficulty. */
  skill: number;
  /** Demo mode: the AI also drives the player car. */
  autopilot: boolean;
}

export interface RaceConfig {
  laps: number;
  playerDriverId: string;
  gridSize: number;
  seed?: number;
  difficulty: 'tranqui' | 'pro' | 'leyenda';
  autopilot?: boolean;
}

let nextId = 1;

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AI_SKILL: Record<RaceConfig['difficulty'], number> = {
  tranqui: 0.9,
  pro: 0.97,
  leyenda: 1.03,
};

export function createRace(config: RaceConfig, roster: string[]): RaceState {
  const rand = mulberry(config.seed ?? 20240610);
  const grid = startGrid(config.gridSize);
  const ids = [config.playerDriverId, ...roster.filter((d) => d !== config.playerDriverId)].slice(
    0,
    config.gridSize,
  );
  const karts: Kart[] = ids.map((driverId, i) => {
    const slot = grid[config.gridSize - 1 - i];
    const idx = nearestSample(slot.pos);
    return {
      id: i,
      driver: driverById(driverId),
      isPlayer: i === 0,
      pos: slot.pos.clone(),
      yaw: slot.yaw,
      speed: 0,
      vy: 0,
      airborne: false,
      slip: 0,
      driftDir: 0,
      driftCharge: 0,
      boost: 0,
      spin: 0,
      stuck: 0,
      mud: 0,
      shield: 0,
      offroadPass: 0,
      item: null,
      itemCooldown: 0,
      sampleIndex: idx,
      lapDist: sampleAtIndex(idx).dist,
      lap: 0,
      progress: 0,
      position: i + 1,
      finished: false,
      finishTime: null,
      lapStart: 0,
      bestLap: null,
      offRoad: false,
      grip: 1,
      aiLane: (rand() - 0.5) * 1.1,
      aiTimer: rand() * 2,
    };
  });
  // Cars start just behind the line, so the first crossing must count as lap 1.
  karts.forEach((k) => {
    k.progress = k.lapDist - TRACK_LENGTH;
  });
  return {
    phase: 'countdown',
    time: 0,
    countdown: 3.6,
    totalLaps: config.laps,
    karts,
    projectiles: [],
    hazards: [],
    boxCooldown: ITEM_BOXES.map(() => 0),
    rain: 0,
    events: [],
    rand,
    skill: AI_SKILL[config.difficulty],
    autopilot: config.autopilot ?? false,
  };
}

function log(state: RaceState, text: string, tone: RaceEvent['tone']) {
  state.events.unshift({ text, tone, at: state.time });
  if (state.events.length > 6) state.events.pop();
}

const MAX_BASE = 30;

function topSpeed(k: Kart, state: RaceState): number {
  let v = MAX_BASE + k.driver.stats.speed * 2.2;
  if (k.offRoad) v *= k.grip;
  if (k.mud > 0) v *= 0.72;
  if (state.rain > 0) v *= 0.93;
  return v;
}

function applyHit(state: RaceState, k: Kart, source: string) {
  if (k.shield > 0) {
    k.shield = 0;
    log(state, `${k.driver.name} aguanta el golpe con el escudo.`, 'neutral');
    return;
  }
  k.spin = Math.max(k.spin, 1.7 - k.driver.stats.stamina * 0.08);
  k.speed *= 0.35;
  k.boost = 0;
  k.driftCharge = 0;
  log(state, `${source} contra ${k.driver.name}.`, k.isPlayer ? 'bad' : 'neutral');
}

function playItem(state: RaceState, k: Kart) {
  const item = k.item;
  if (!item) return;
  k.item = null;
  switch (item) {
    case 'turbo':
      k.boost = Math.max(k.boost, 3);
      break;
    case 'escudo':
      k.shield = 8;
      break;
    case 'atajo':
      k.offroadPass = 5;
      k.boost = Math.max(k.boost, 0.8);
      break;
    case 'aceite':
      state.hazards.push({
        id: nextId++,
        pos: k.pos.clone().addScaledVector(forward(k), -5),
        ttl: 22,
        ownerId: k.id,
      });
      break;
    case 'bengala': {
      const ahead = state.karts
        .filter((o) => o.id !== k.id && o.progress > k.progress)
        .sort((a, b) => a.progress - b.progress)[0];
      state.projectiles.push({
        id: nextId++,
        pos: k.pos.clone().addScaledVector(forward(k), 4).setY(1),
        yaw: k.yaw,
        speed: 52,
        ownerId: k.id,
        targetId: ahead ? ahead.id : null,
        ttl: 7,
      });
      log(state, `${k.driver.name} tira una bengala.`, 'neutral');
      break;
    }
    case 'barro': {
      const ahead = state.karts.filter((o) => o.progress > k.progress);
      ahead.forEach((o) => {
        if (o.shield > 0) {
          o.shield = 0;
          return;
        }
        o.mud = 3;
        o.speed *= 0.85;
      });
      log(state, `Bomba de barro: ${ahead.length} autos salpicados.`, 'neutral');
      break;
    }
    case 'tormenta':
      state.rain = 18;
      log(state, '🌧️ Se larga la tormenta sobre La Boca.', 'neutral');
      break;
  }
}

function forward(k: Kart): THREE.Vector3 {
  return new THREE.Vector3(Math.sin(k.yaw), 0, Math.cos(k.yaw));
}

/** Curvature of the track a few metres ahead, used by the AI and by the HUD. */
function curvatureAhead(lapDist: number, look: number): number {
  const a = sampleAtDistance(lapDist + 6).dir;
  const b = sampleAtDistance(lapDist + 6 + look).dir;
  return a.angleTo(b);
}

function aiInput(state: RaceState, k: Kart, skill: number): KartInput {
  const look = 9 + k.speed * 0.5;
  const target = sampleAtDistance(k.lapDist + look);
  const aim = target.pos.clone().addScaledVector(target.right, k.aiLane * target.half * 0.65);

  // Swerve around oil patches sitting on the line.
  for (const h of state.hazards) {
    const toH = h.pos.clone().sub(k.pos);
    const dist = toH.length();
    if (dist < 18 && toH.dot(forward(k)) > 0) {
      const side = toH.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
      aim.addScaledVector(side, 8);
    }
  }

  const to = aim.sub(k.pos).setY(0);
  const desired = Math.atan2(to.x, to.z);
  let diff = desired - k.yaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.4));

  const curve = curvatureAhead(k.lapDist, 26);
  const limit = topSpeed(k, state) * (1 - Math.min(0.45, curve * 0.5)) * skill;
  const throttle = k.speed < limit ? 1 : 0.15;
  const brake = k.speed > limit * 1.14 ? 1 : 0;

  k.aiTimer -= 1 / 60;
  const use = k.item !== null && k.aiTimer <= 0;
  if (use) k.aiTimer = 1 + state.rand() * 2.5;

  return {
    throttle,
    brake,
    steer,
    drift: Math.abs(steer) > 0.5 && k.speed > 16 && !k.airborne,
    use,
  };
}

function updateKart(state: RaceState, k: Kart, input: KartInput, dt: number, skill: number) {
  const stats = k.driver.stats;
  const racing = state.phase === 'racing' && !k.finished;

  k.spin = Math.max(0, k.spin - dt);
  k.mud = Math.max(0, k.mud - dt);
  k.shield = Math.max(0, k.shield - dt);
  k.boost = Math.max(0, k.boost - dt);
  k.offroadPass = Math.max(0, k.offroadPass - dt);
  k.itemCooldown = Math.max(0, k.itemCooldown - dt);

  if (input.use && k.item && racing) playItem(state, k);

  const top = topSpeed(k, state) * (k.isPlayer ? 1 : skill) + (k.boost > 0 ? 13 : 0);
  const accel = (11 + stats.accel * 1.6) * (k.boost > 0 ? 1.8 : 1);

  if (k.spin > 0) {
    k.yaw += dt * 9;
    k.speed *= 1 - dt * 1.6;
  } else if (racing) {
    if (input.throttle > 0) k.speed += accel * input.throttle * dt;
    if (input.brake > 0) k.speed -= 26 * input.brake * dt;
    if (input.throttle === 0 && input.brake === 0) k.speed -= 6 * dt;
  } else {
    k.speed -= 10 * dt;
  }
  k.speed = Math.max(0, Math.min(k.speed, top));

  // Steering and drifting.
  const speedFactor = Math.min(1, k.speed / 9) * (1 - Math.min(0.4, k.speed / (top * 2.6)));
  const turn = (1.7 + stats.handling * 0.11) * speedFactor;
  const drifting = input.drift && k.speed > 12 && Math.abs(input.steer) > 0.15 && !k.airborne;
  if (drifting) {
    if (k.driftDir === 0) k.driftDir = Math.sign(input.steer);
    k.driftCharge += dt * (0.7 + stats.drift * 0.16);
    k.yaw += input.steer * turn * 1.45 * dt;
    k.slip += (-k.driftDir * 0.42 - k.slip) * Math.min(1, dt * 6);
    k.speed -= 2.5 * dt;
  } else {
    if (k.driftDir !== 0) {
      const tier = k.driftCharge >= 2.4 ? 3 : k.driftCharge >= 1.4 ? 2 : k.driftCharge >= 0.7 ? 1 : 0;
      if (tier > 0) {
        k.boost = Math.max(k.boost, 0.55 * tier);
        if (k.isPlayer) log(state, `Mini turbo nivel ${tier}.`, 'good');
      }
      k.driftDir = 0;
      k.driftCharge = 0;
    }
    k.yaw += input.steer * turn * dt;
    k.slip += (0 - k.slip) * Math.min(1, dt * 7);
  }

  // Integrate along the slipped heading.
  const heading = k.yaw + k.slip;
  k.pos.x += Math.sin(heading) * k.speed * dt;
  k.pos.z += Math.cos(heading) * k.speed * dt;

  // Jumps.
  if (k.airborne) {
    k.vy -= 26 * dt;
    k.pos.y += k.vy * dt;
    if (k.pos.y <= 0) {
      k.pos.y = 0;
      k.vy = 0;
      k.airborne = false;
      k.boost = Math.max(k.boost, 0.5);
    }
  } else {
    for (const r of RAMPS) {
      if (k.speed > 12 && inRect(k.pos, r.pos, r.yaw, r.width, r.length)) {
        k.airborne = true;
        k.vy = r.launch * Math.min(1, k.speed / 26);
        break;
      }
    }
  }

  // Surface and walls.
  k.sampleIndex = nearestSample(k.pos, k.sampleIndex);
  const s = sampleAtIndex(k.sampleIndex);
  const lateral = k.pos.clone().sub(s.pos).dot(s.right);
  const surface = k.airborne ? 1 : surfaceAt(k.pos, k.sampleIndex);
  k.grip = k.offroadPass > 0 ? 1 : surface;
  k.offRoad = k.grip < 1;
  if (k.offRoad) k.speed -= (1 - k.grip) * 22 * dt;

  const limit = wallLimit(k.pos, k.sampleIndex);
  if (Math.abs(lateral) > limit) {
    const push = (Math.abs(lateral) - limit) * Math.sign(lateral);
    k.pos.addScaledVector(s.right, -push);
    k.speed *= 0.82;
  }

  if (racing && (k.offRoad || Math.abs(lateral) > s.half) && k.speed < 7) k.stuck += dt;
  else k.stuck = 0;
  if (k.stuck > 2.2) {
    k.stuck = 0;
    k.pos.copy(s.pos).setY(0);
    k.yaw = Math.atan2(s.dir.x, s.dir.z);
    k.vy = 0;
    k.airborne = false;
    k.speed = 12;
    k.slip = 0;
    k.driftDir = 0;
    k.driftCharge = 0;
    log(state, `${k.driver.name} vuelve a la pista.`, k.isPlayer ? 'bad' : 'neutral');
  }

  // Lap bookkeeping.
  const prevDist = k.lapDist;
  k.lapDist = s.dist;
  if (racing) {
    if (prevDist > TRACK_LENGTH * 0.75 && k.lapDist < TRACK_LENGTH * 0.25) {
      k.lap += 1;
      const lapTime = state.time - k.lapStart;
      if (k.lap > 1 && (k.bestLap === null || lapTime < k.bestLap)) k.bestLap = lapTime;
      k.lapStart = state.time;
      if (k.lap > state.totalLaps) {
        k.finished = true;
        k.finishTime = state.time;
        log(state, `${k.driver.name} cruza la meta.`, k.isPlayer ? 'good' : 'neutral');
      }
    } else if (prevDist < TRACK_LENGTH * 0.25 && k.lapDist > TRACK_LENGTH * 0.75) {
      k.lap -= 1;
    }
  }
  k.progress = k.lap * TRACK_LENGTH + k.lapDist;
}

function pickups(state: RaceState, dt: number) {
  state.boxCooldown = state.boxCooldown.map((c) => Math.max(0, c - dt));
  state.karts.forEach((k) => {
    if (k.item || k.finished) return;
    ITEM_BOXES.forEach((box, i) => {
      if (state.boxCooldown[i] > 0) return;
      if (box.pos.distanceTo(k.pos) < 3.6) {
        k.item = drawItem(k.position, state.karts.length, state.rand);
        state.boxCooldown[i] = 5;
      }
    });
  });
}

function projectiles(state: RaceState, dt: number) {
  state.projectiles = state.projectiles.filter((p) => {
    p.ttl -= dt;
    if (p.ttl <= 0) return false;
    const target = p.targetId !== null ? state.karts[p.targetId] : null;
    if (target) {
      const to = target.pos.clone().sub(p.pos).setY(0);
      const desired = Math.atan2(to.x, to.z);
      let diff = desired - p.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      p.yaw += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
    } else {
      const s = sampleAtDistance(
        sampleAtIndex(nearestSample(p.pos)).dist + 12,
      );
      const to = s.pos.clone().sub(p.pos).setY(0);
      p.yaw = Math.atan2(to.x, to.z);
    }
    p.pos.x += Math.sin(p.yaw) * p.speed * dt;
    p.pos.z += Math.cos(p.yaw) * p.speed * dt;
    for (const k of state.karts) {
      if (k.id === p.ownerId) continue;
      if (k.pos.distanceTo(p.pos) < 3.4) {
        applyHit(state, k, 'Bengala');
        return false;
      }
    }
    return true;
  });

  state.hazards = state.hazards.filter((h) => {
    h.ttl -= dt;
    if (h.ttl <= 0) return false;
    for (const k of state.karts) {
      if (k.spin > 0) continue;
      if (k.pos.distanceTo(h.pos) < 3) {
        applyHit(state, k, 'Mancha de aceite');
        return false;
      }
    }
    return true;
  });
}

function collisions(state: RaceState) {
  const list = state.karts;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const d = a.pos.distanceTo(b.pos);
      if (d > 3.4 || d === 0) continue;
      const push = a.pos.clone().sub(b.pos).setY(0).normalize().multiplyScalar((3.4 - d) / 2);
      a.pos.add(push);
      b.pos.sub(push);
      const faster = a.speed > b.speed ? a : b;
      const slower = faster === a ? b : a;
      slower.speed *= 0.9;
      faster.speed *= 0.97;
    }
  }
}

export function stepRace(
  state: RaceState,
  playerInput: KartInput,
  dt: number,
): RaceState {
  const skill = state.skill;
  state.time += dt;
  state.rain = Math.max(0, state.rain - dt);

  if (state.phase === 'countdown') {
    state.countdown -= dt;
    if (state.countdown <= 0) {
      state.phase = 'racing';
      state.karts.forEach((k) => {
        k.lapStart = state.time;
      });
      log(state, '¡Verde en Caminito!', 'good');
    }
  }

  state.karts.forEach((k) => {
    const input = k.finished
      ? { ...NO_INPUT, throttle: 0.4 }
      : k.isPlayer && !state.autopilot
        ? playerInput
        : aiInput(state, k, skill);
    updateKart(state, k, input, dt, skill);
  });

  pickups(state, dt);
  projectiles(state, dt);
  collisions(state);

  const order = [...state.karts].sort((a, b) => {
    if (a.finished && b.finished) return (a.finishTime ?? 0) - (b.finishTime ?? 0);
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.progress - a.progress;
  });
  order.forEach((k, i) => {
    k.position = i + 1;
  });

  if (state.phase === 'racing' && state.karts.every((k) => k.finished)) {
    state.phase = 'finished';
  }
  // The race ends a few seconds after the player finishes.
  const player = state.karts[0];
  if (state.phase === 'racing' && player.finished && state.time - (player.finishTime ?? 0) > 6) {
    state.phase = 'finished';
  }

  return state;
}

export function shortcutNames(): string[] {
  return SHORTCUTS.map((s) => s.label);
}
