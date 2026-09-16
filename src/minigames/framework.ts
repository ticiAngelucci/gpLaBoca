import * as THREE from 'three';
import type { Driver } from '../engine/types';

export type Key = 'left' | 'right' | 'up' | 'down' | 'action';

/** Keyboard layout for up to four players sharing one keyboard. */
const LAYOUT: Record<number, Record<Key, string[]>> = {
  0: { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], action: ['Space', 'KeyF'] },
  1: {
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    up: ['ArrowUp'],
    down: ['ArrowDown'],
    action: ['Enter', 'ShiftRight'],
  },
  2: { left: ['KeyJ'], right: ['KeyL'], up: ['KeyI'], down: ['KeyK'], action: ['KeyH'] },
  3: {
    left: ['Numpad4'],
    right: ['Numpad6'],
    up: ['Numpad8'],
    down: ['Numpad5'],
    action: ['Numpad0'],
  },
};

export class InputState {
  private down = new Set<string>();
  private pressed = new Set<string>();

  attach() {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
  }

  detach() {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
  }

  private onDown = (e: KeyboardEvent) => {
    if (e.code === 'Space') e.preventDefault();
    if (!this.down.has(e.code)) this.pressed.add(e.code);
    this.down.add(e.code);
  };

  private onUp = (e: KeyboardEvent) => {
    this.down.delete(e.code);
  };

  isDown(slot: number, key: Key): boolean {
    return (LAYOUT[slot]?.[key] ?? []).some((code) => this.down.has(code));
  }

  justPressed(slot: number, key: Key): boolean {
    return (LAYOUT[slot]?.[key] ?? []).some((code) => this.pressed.has(code));
  }

  endFrame() {
    this.pressed.clear();
  }
}

export interface MinigamePlayer {
  id: number;
  slot: number;
  name: string;
  control: 'human' | 'cpu';
  driver: Driver;
}

export interface MinigameCtx {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  players: MinigamePlayer[];
  input: InputState;
  rand: () => number;
}

export interface MinigameInstance {
  update(dt: number, elapsed: number): void;
  scores(): { playerId: number; score: number }[];
  finished(): boolean;
  /** Short status line rendered above the canvas. */
  hud?(): string;
  scoreLabel?(playerId: number): string;
}

export type MinigameFactory = (ctx: MinigameCtx) => MinigameInstance;

/** Shared ground + lighting rig so every minigame looks like the same game. */
export function baseScene(kind: 'street' | 'pitch' | 'pit'): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(kind === 'pitch' ? '#09142c' : '#1b2740');
  scene.fog = new THREE.Fog(kind === 'pitch' ? '#09142c' : '#20304d', 60, 220);

  const hemi = new THREE.HemisphereLight('#cfe3ff', '#3a2b1e', kind === 'pitch' ? 0.9 : 1.1);
  scene.add(hemi);
  const key = new THREE.DirectionalLight('#fff3d6', kind === 'pitch' ? 2.4 : 2.0);
  key.position.set(30, 60, 24);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -80;
  key.shadow.camera.right = 80;
  key.shadow.camera.top = 80;
  key.shadow.camera.bottom = -80;
  scene.add(key);
  return scene;
}

export const PLAYER_ACCENTS = ['#ffd400', '#00d1a0', '#ff3b30', '#4aa3ff'];
