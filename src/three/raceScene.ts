import * as THREE from 'three';
import {
  createRace,
  stepRace,
  type Kart,
  type KartInput,
  type RaceConfig,
  type RaceState,
} from '../race/raceEngine';
import { ITEM_BOXES, STADIUM_CENTER } from '../race/track';
import { buildCar, type CarRig } from './car';
import { skyGradient } from './textures';
import { buildWorld } from './world';

export interface HudSnapshot {
  phase: RaceState['phase'];
  countdown: number;
  time: number;
  lap: number;
  totalLaps: number;
  position: number;
  gridSize: number;
  speed: number;
  item: Kart['item'];
  boost: number;
  shield: number;
  mud: number;
  offRoad: boolean;
  /** True during the flourish that plays when entering La Bombonera. */
  stadium: boolean;
  rain: boolean;
  driftCharge: number;
  bestLap: number | null;
  standings: {
    id: number;
    name: string;
    team: string;
    color: string;
    position: number;
    lap: number;
    isPlayer: boolean;
    finished: boolean;
    finishTime: number | null;
  }[];
  minimap: { x: number; z: number; color: string; isPlayer: boolean }[];
  events: RaceState['events'];
}

const KEYS = new Set<string>();

function readInput(): KartInput {
  const left = KEYS.has('arrowleft') || KEYS.has('a');
  const right = KEYS.has('arrowright') || KEYS.has('d');
  return {
    throttle: KEYS.has('arrowup') || KEYS.has('w') ? 1 : 0,
    brake: KEYS.has('arrowdown') || KEYS.has('s') ? 1 : 0,
    steer: (right ? 1 : 0) - (left ? 1 : 0),
    drift: KEYS.has(' ') || KEYS.has('shift'),
    use: KEYS.has('e') || KEYS.has('control'),
  };
}

/** True on machines without GPU acceleration, where the race starts in low detail. */
function softwareRenderer(renderer: THREE.WebGLRenderer): boolean {
  const gl = renderer.getContext();
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  if (!info) return false;
  const name = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? '');
  return /swiftshader|llvmpipe|software|mesa offscreen/i.test(name);
}

export class RaceScene {
  readonly state: RaceState;
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private rigs: CarRig[] = [];
  private boxMeshes: THREE.Mesh[] = [];
  private projectileMeshes = new Map<number, THREE.Mesh>();
  private hazardMeshes = new Map<number, THREE.Mesh>();
  private smoke: THREE.Points;
  private smokeData: { life: number; vel: THREE.Vector3 }[] = [];
  private smokeCursor = 0;
  private rain!: THREE.Points;
  private sun: THREE.DirectionalLight;
  private floodlights: THREE.SpotLight[] = [];
  private raf = 0;
  private last = 0;
  private acc = 0;
  private hudTimer = 0;
  private useLatch = false;
  /** 2 full quality, 1 without shadows, 0 also at reduced resolution. */
  private quality: number;
  private frameSum = 0;
  private frameCount = 0;
  private onPitch = false;
  private stadiumShot = 0;
  private onHud?: (s: HudSnapshot) => void;

  constructor(container: HTMLElement, config: RaceConfig, roster: string[]) {
    this.container = container;
    this.state = createRace(config, roster);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.quality = softwareRenderer(this.renderer) ? 0 : 2;
    this.renderer.setPixelRatio(this.quality === 2 ? Math.min(devicePixelRatio, 1.25) : 0.7);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = this.quality === 2;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(64, container.clientWidth / container.clientHeight, 0.4, 900);
    this.scene.fog = new THREE.Fog('#b9c6d6', this.quality === 2 ? 180 : 110, this.quality === 2 ? 520 : 300);
    if (this.quality === 2) this.scene.environment = skyGradient('#87b7e8', '#f3d9b8');
    this.scene.background = skyGradient('#6fa8dc', '#ffd9a0');

    const hemi = new THREE.HemisphereLight('#cfe4ff', '#6b5a49', 1.1);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight('#fff0d4', 2.3);
    this.sun.position.set(90, 120, 40);
    this.sun.castShadow = this.quality === 2;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -70;
    this.sun.shadow.camera.right = 70;
    this.sun.shadow.camera.top = 70;
    this.sun.shadow.camera.bottom = -70;
    this.sun.shadow.camera.far = 300;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    const world = buildWorld(this.scene);
    this.floodlights = world.floodlights;
    this.rain = world.rainSystem;

    this.state.karts.forEach((k) => {
      const rig = buildCar(k.driver.colors[0], k.driver.colors[1], k.driver.accent);
      this.scene.add(rig.group);
      this.rigs.push(rig);
    });

    const boxGeo = new THREE.BoxGeometry(2.4, 2.4, 2.4);
    ITEM_BOXES.forEach((spot) => {
      const mesh = new THREE.Mesh(
        boxGeo,
        new THREE.MeshStandardMaterial({
          color: '#ffd400',
          emissive: new THREE.Color('#ff9d00'),
          emissiveIntensity: 0.8,
          transparent: true,
          opacity: 0.9,
        }),
      );
      mesh.position.copy(spot.pos);
      this.scene.add(mesh);
      this.boxMeshes.push(mesh);
    });

    const smokeCount = 400;
    const positions = new Float32Array(smokeCount * 3).fill(-9999);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.smoke = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: '#e8e8e8',
        size: 1.5,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    for (let i = 0; i < smokeCount; i++) {
      this.smokeData.push({ life: 0, vel: new THREE.Vector3() });
    }
    this.scene.add(this.smoke);

    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('resize', this.resize);
  }

  setHudListener(cb: (s: HudSnapshot) => void) {
    this.onHud = cb;
  }

  start() {
    this.last = performance.now();
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.acc += dt;
      let input = readInput();
      // The item key fires once per press instead of every frame.
      if (input.use && this.useLatch) input = { ...input, use: false };
      this.useLatch = readInput().use;
      while (this.acc >= 1 / 60) {
        stepRace(this.state, input, 1 / 60);
        input = { ...input, use: false };
        this.acc -= 1 / 60;
      }
      this.render(dt);
    };
    this.raf = requestAnimationFrame(loop);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    KEYS.clear();
  }

  private keyDown = (e: KeyboardEvent) => {
    KEYS.add(e.key.toLowerCase());
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
      e.preventDefault();
    }
  };

  private keyUp = (e: KeyboardEvent) => {
    KEYS.delete(e.key.toLowerCase());
  };

  private resize = () => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private spawnSmoke(pos: THREE.Vector3, color: THREE.Color | null) {
    const attr = this.smoke.geometry.getAttribute('position') as THREE.BufferAttribute;
    const i = this.smokeCursor;
    this.smokeCursor = (this.smokeCursor + 1) % this.smokeData.length;
    attr.setXYZ(i, pos.x, pos.y + 0.3, pos.z);
    this.smokeData[i].life = 0.8;
    this.smokeData[i].vel.set((Math.random() - 0.5) * 2, 1.5 + Math.random(), (Math.random() - 0.5) * 2);
    attr.needsUpdate = true;
    if (color) (this.smoke.material as THREE.PointsMaterial).color.lerp(color, 0.02);
  }

  private render(dt: number) {
    const state = this.state;
    const player = state.karts[0];

    state.karts.forEach((k, i) => {
      const rig = this.rigs[i];
      rig.group.position.copy(k.pos);
      rig.group.rotation.y = k.yaw + k.slip * 0.8;
      rig.group.rotation.z = -k.slip * 0.25;
      rig.wheels.forEach((w) => {
        w.rotation.x -= k.speed * dt * 1.6;
      });
      const squash = k.boost > 0 ? 1.06 : 1;
      rig.group.scale.set(1, squash, 1 / squash);
      if ((k.driftDir !== 0 || k.offRoad) && k.speed > 8 && Math.random() > 0.35) {
        this.spawnSmoke(k.pos, null);
      }
      if (k.boost > 0 && Math.random() > 0.5) {
        this.spawnSmoke(
          k.pos.clone().addScaledVector(new THREE.Vector3(Math.sin(k.yaw), 0, Math.cos(k.yaw)), -2.4),
          new THREE.Color(k.driver.accent),
        );
      }
    });

    // Item boxes spin and vanish while respawning.
    this.boxMeshes.forEach((m, i) => {
      m.rotation.y += dt * 2;
      m.rotation.x += dt * 1.1;
      m.visible = state.boxCooldown[i] <= 0;
    });

    // Projectiles and oil patches.
    state.projectiles.forEach((p) => {
      let mesh = this.projectileMeshes.get(p.id);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.8, 12, 10),
          new THREE.MeshStandardMaterial({
            color: '#ffd166',
            emissive: new THREE.Color('#ff7b00'),
            emissiveIntensity: 2,
          }),
        );
        this.scene.add(mesh);
        this.projectileMeshes.set(p.id, mesh);
      }
      mesh.position.copy(p.pos);
    });
    this.projectileMeshes.forEach((mesh, id) => {
      if (!state.projectiles.some((p) => p.id === id)) {
        this.scene.remove(mesh);
        this.projectileMeshes.delete(id);
      }
    });
    state.hazards.forEach((h) => {
      let mesh = this.hazardMeshes.get(h.id);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.CircleGeometry(2.4, 18),
          new THREE.MeshStandardMaterial({ color: '#15161a', roughness: 0.2, metalness: 0.5 }),
        );
        mesh.rotation.x = -Math.PI / 2;
        this.scene.add(mesh);
        this.hazardMeshes.set(h.id, mesh);
      }
      mesh.position.copy(h.pos).setY(0.14);
    });
    this.hazardMeshes.forEach((mesh, id) => {
      if (!state.hazards.some((h) => h.id === id)) {
        this.scene.remove(mesh);
        this.hazardMeshes.delete(id);
      }
    });

    // Smoke puffs.
    const attr = this.smoke.geometry.getAttribute('position') as THREE.BufferAttribute;
    this.smokeData.forEach((s, i) => {
      if (s.life <= 0) return;
      s.life -= dt;
      if (s.life <= 0) {
        attr.setXYZ(i, -9999, -9999, -9999);
      } else {
        attr.setXYZ(
          i,
          attr.getX(i) + s.vel.x * dt,
          attr.getY(i) + s.vel.y * dt,
          attr.getZ(i) + s.vel.z * dt,
        );
      }
    });
    attr.needsUpdate = true;

    // Stadium entry: one wide, high shot the first moment the car is on the pitch.
    const onPitch = player.pos.distanceTo(STADIUM_CENTER) < 62;
    if (onPitch && !this.onPitch) this.stadiumShot = 3.4;
    this.onPitch = onPitch;
    this.stadiumShot = Math.max(0, this.stadiumShot - dt);
    const wide = Math.min(1, this.stadiumShot / 1.2);

    // Chase camera with a speed dependent field of view.
    const fwd = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
    const goal = player.pos
      .clone()
      .addScaledVector(fwd, -10.5 - wide * 7)
      .setY(player.pos.y + 4.6 + wide * 5)
      .addScaledVector(new THREE.Vector3(fwd.z, 0, -fwd.x), player.slip * 3);
    this.camera.position.lerp(goal, Math.min(1, dt * 6));
    const look = player.pos.clone().addScaledVector(fwd, 10).setY(player.pos.y + 1.6);
    this.camera.lookAt(look);
    const boostFov = player.boost > 0 ? 8 : 0;
    const targetFov = 62 + (player.speed / 40) * 12 + boostFov + wide * 10;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 4);
    this.camera.updateProjectionMatrix();

    this.sun.position.copy(player.pos).add(new THREE.Vector3(50, 80, 30));
    this.sun.target.position.copy(player.pos);
    this.sun.target.updateMatrixWorld();

    // Stadium and weather lighting.
    const nearStadium = player.pos.distanceTo(STADIUM_CENTER) < 150;
    const floodTarget = onPitch ? 3.2 : 0.6;
    this.floodlights.forEach((l) => {
      l.visible = nearStadium;
      if (nearStadium) l.intensity += (floodTarget - l.intensity) * Math.min(1, dt * 2);
    });
    const raining = state.rain > 0;
    this.rain.visible = raining;
    if (raining) {
      this.rain.position.set(player.pos.x, 0, player.pos.z);
      const rp = this.rain.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < rp.count; i++) {
        let y = rp.getY(i) - dt * 55;
        if (y < 0) y = 60;
        rp.setY(i, y);
      }
      rp.needsUpdate = true;
    }
    this.sun.intensity += ((raining ? 0.9 : 2.3) - this.sun.intensity) * Math.min(1, dt * 1.5);
    this.renderer.toneMappingExposure += ((raining ? 0.82 : 1.05) - this.renderer.toneMappingExposure) * Math.min(1, dt * 1.5);

    this.renderer.render(this.scene, this.camera);
    this.tuneQuality(dt);

    this.hudTimer -= dt;
    if (this.hudTimer <= 0 && this.onHud) {
      this.hudTimer = 0.08;
      this.onHud(this.snapshot());
    }
  }

  /**
   * Drops shadows and then resolution on machines that cannot hold 30 fps, so
   * the race keeps running at real time speed instead of in slow motion.
   */
  private tuneQuality(dt: number) {
    if (this.quality === 0) return;
    this.frameSum += dt;
    this.frameCount += 1;
    if (this.frameCount < 45) return;
    const avg = this.frameSum / this.frameCount;
    this.frameSum = 0;
    this.frameCount = 0;
    if (avg < 1 / 28) return;
    this.quality -= 1;
    if (this.quality === 1) {
      this.renderer.shadowMap.enabled = false;
      this.scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((m) => (m.needsUpdate = true));
        else if (mat) mat.needsUpdate = true;
      });
    } else {
      this.renderer.setPixelRatio(0.7);
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
  }

  snapshot(): HudSnapshot {
    const state = this.state;
    const p = state.karts[0];
    const standings = [...state.karts]
      .sort((a, b) => a.position - b.position)
      .map((k) => ({
        id: k.id,
        name: k.driver.name,
        team: k.driver.team,
        color: k.driver.colors[0],
        position: k.position,
        lap: Math.min(Math.max(k.lap, 1), state.totalLaps),
        isPlayer: k.isPlayer,
        finished: k.finished,
        finishTime: k.finishTime,
      }));
    return {
      phase: state.phase,
      countdown: state.countdown,
      time: state.time,
      lap: Math.min(Math.max(p.lap, 1), state.totalLaps),
      totalLaps: state.totalLaps,
      position: p.position,
      gridSize: state.karts.length,
      speed: p.speed,
      item: p.item,
      boost: p.boost,
      shield: p.shield,
      mud: p.mud,
      offRoad: p.offRoad,
      stadium: this.stadiumShot > 0,
      rain: state.rain > 0,
      driftCharge: p.driftCharge,
      bestLap: p.bestLap,
      standings,
      minimap: state.karts.map((k) => ({
        x: k.pos.x,
        z: k.pos.z,
        color: k.driver.colors[0],
        isPlayer: k.isPlayer,
      })),
      events: state.events,
    };
  }
}
