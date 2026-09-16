import * as THREE from 'three';
import { BOARD, tile } from '../engine/board';
import { driverById } from '../engine/drivers';
import type { GameState, TileKind } from '../engine/types';
import { buildCar, type CarRig } from './car';
import { skyGradient } from './textures';
import { buildWorld } from './world';

const TILE_COLORS: Record<TileKind, string> = {
  normal: '#e8e2d4',
  coin: '#f2c500',
  hazard: '#e04a3f',
  event: '#7b5cff',
  item: '#2fb5d6',
  boost: '#3ddc84',
  pit: '#ff8a3d',
  duel: '#ff3b81',
  trophy: '#ffd700',
  junction: '#ffffff',
  gate: '#1b4fa8',
  stadium: '#f2c500',
  start: '#111318',
};

interface Hop {
  playerId: number;
  tiles: number[];
  index: number;
  t: number;
  onDone: () => void;
}

export class BoardScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private cars = new Map<number, CarRig>();
  private tileMeshes = new Map<number, THREE.Mesh>();
  private trophy: THREE.Group;
  private floodlights: THREE.SpotLight[] = [];
  private sun: THREE.DirectionalLight;
  private hop: Hop | null = null;
  private frame = 0;
  private focusId = 0;
  private insideStadium = false;
  private highlight: number[] = [];
  private disposed = false;
  private camPos = new THREE.Vector3(0, 40, 60);
  private camLook = new THREE.Vector3();

  private container: HTMLElement;

  constructor(container: HTMLElement, state: GameState) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      48,
      container.clientWidth / container.clientHeight,
      0.5,
      900,
    );
    this.camera.position.copy(this.camPos);

    this.scene.background = skyGradient('#2a6fd6', '#f3c98b');
    this.scene.fog = new THREE.Fog('#c9d8ea', 150, 420);

    const hemi = new THREE.HemisphereLight('#bcd7ff', '#5a4632', 1.0);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight('#fff0cf', 2.1);
    this.sun.position.set(70, 90, 60);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const cam = this.sun.shadow.camera;
    cam.left = -170;
    cam.right = 170;
    cam.top = 170;
    cam.bottom = -170;
    cam.far = 400;
    this.scene.add(this.sun);

    const world = buildWorld(this.scene);
    this.floodlights = world.floodlights;

    this.buildTiles();
    this.trophy = this.buildTrophy();
    this.scene.add(this.trophy);
    this.buildCars(state);
    this.syncState(state);

    window.addEventListener('resize', this.onResize);
    this.renderer.setAnimationLoop(this.tick);
  }

  private buildTiles() {
    const geo = new THREE.CylinderGeometry(2.1, 2.1, 0.32, 6);
    BOARD.forEach((t) => {
      const mat = new THREE.MeshStandardMaterial({
        color: TILE_COLORS[t.kind],
        roughness: 0.45,
        metalness: 0.1,
        emissive: new THREE.Color(TILE_COLORS[t.kind]),
        emissiveIntensity: 0.12,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(t.pos[0], t.pos[1] + 0.18, t.pos[2]);
      mesh.receiveShadow = true;
      mesh.rotation.y = Math.PI / 6;
      this.scene.add(mesh);
      this.tileMeshes.set(t.id, mesh);
    });
  }

  private buildTrophy(): THREE.Group {
    const g = new THREE.Group();
    const star = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.5, 0),
      new THREE.MeshStandardMaterial({
        color: '#ffd700',
        metalness: 0.9,
        roughness: 0.15,
        emissive: new THREE.Color('#ffb300'),
        emissiveIntensity: 0.8,
      }),
    );
    star.position.y = 4;
    star.castShadow = true;
    g.add(star);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 14, 18, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#ffd700',
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
      }),
    );
    beam.position.y = 7;
    g.add(beam);
    g.add(new THREE.PointLight('#ffcf4d', 40, 26));
    return g;
  }

  private buildCars(state: GameState) {
    state.players.forEach((p) => {
      const d = driverById(p.driverId);
      const rig = buildCar(d.colors[0], d.colors[1], d.accent);
      rig.group.scale.setScalar(0.9);
      this.scene.add(rig.group);
      this.cars.set(p.id, rig);
    });
  }

  /** Places every car at its logical tile without animating. */
  syncState(state: GameState) {
    this.focusId = state.current;
    this.insideStadium = state.players[state.current]?.insideStadium ?? false;
    state.players.forEach((p, i) => {
      const rig = this.cars.get(p.id);
      if (!rig) return;
      if (this.hop && this.hop.playerId === p.id) return;
      const pos = this.tileAnchor(p.tile, i);
      rig.group.position.copy(pos);
      const t = tile(p.tile);
      const nextTile = tile(t.next[0]);
      rig.group.lookAt(new THREE.Vector3(nextTile.pos[0], pos.y, nextTile.pos[2]));
    });
    const tro = tile(state.trophyTile);
    this.trophy.position.set(tro.pos[0], tro.pos[1], tro.pos[2]);
  }

  /** Small per-player offset so four cars can share a tile. */
  private tileAnchor(tileId: number, slot: number): THREE.Vector3 {
    const t = tile(tileId);
    const angle = (slot / 4) * Math.PI * 2;
    return new THREE.Vector3(
      t.pos[0] + Math.cos(angle) * 1.0,
      t.pos[1] + 0.35,
      t.pos[2] + Math.sin(angle) * 1.0,
    );
  }

  setHighlight(tiles: number[]) {
    this.highlight = tiles;
  }

  animatePath(playerId: number, tiles: number[], onDone: () => void) {
    if (!tiles.length) {
      onDone();
      return;
    }
    this.hop = { playerId, tiles, index: 0, t: 0, onDone };
  }

  private updateHop(dt: number) {
    const hop = this.hop;
    if (!hop) return;
    const rig = this.cars.get(hop.playerId);
    if (!rig) {
      this.hop = null;
      hop.onDone();
      return;
    }
    hop.t += dt * 2.6;
    const from =
      hop.index === 0
        ? rig.group.position.clone()
        : this.tileAnchor(hop.tiles[hop.index - 1], hop.playerId);
    const to = this.tileAnchor(hop.tiles[hop.index], hop.playerId);
    const k = Math.min(1, hop.t);
    const eased = k * k * (3 - 2 * k);
    rig.group.position.lerpVectors(from, to, eased);
    rig.group.position.y = from.y + (to.y - from.y) * eased + Math.sin(eased * Math.PI) * 1.1;
    const flat = new THREE.Vector3(to.x, rig.group.position.y, to.z);
    if (flat.distanceTo(rig.group.position) > 0.05) rig.group.lookAt(flat);
    rig.wheels.forEach((w) => (w.rotation.x -= dt * 14));

    if (k >= 1) {
      hop.t = 0;
      hop.index += 1;
      if (hop.index >= hop.tiles.length) {
        this.hop = null;
        hop.onDone();
      }
    }
  }

  private updateCamera(dt: number) {
    const rig = this.cars.get(this.focusId);
    const target = rig ? rig.group.position.clone() : new THREE.Vector3();
    const t = this.frame * 0.0016;
    const radius = this.insideStadium ? 34 : 46;
    const height = this.insideStadium ? 22 : 34;
    const desired = new THREE.Vector3(
      target.x + Math.sin(t) * radius,
      target.y + height,
      target.z + Math.cos(t) * radius,
    );
    this.camPos.lerp(desired, 1 - Math.pow(0.0015, dt));
    this.camLook.lerp(target, 1 - Math.pow(0.002, dt));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  private tick = () => {
    if (this.disposed) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.frame += 1;
    this.updateHop(dt);
    this.updateCamera(dt);

    this.trophy.rotation.y += dt * 1.4;
    this.trophy.children[0].position.y = 4 + Math.sin(this.frame * 0.04) * 0.4;

    // Stadium lighting ramps up while the action is inside La Bombonera.
    const targetFlood = this.insideStadium ? 3200 : 0;
    this.floodlights.forEach((l) => {
      l.intensity += (targetFlood - l.intensity) * Math.min(1, dt * 2);
    });
    this.sun.intensity += ((this.insideStadium ? 0.6 : 2.1) - this.sun.intensity) * Math.min(1, dt);

    this.tileMeshes.forEach((mesh, id) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const wanted = this.highlight.includes(id) ? 1.2 : 0.12;
      mat.emissiveIntensity += (wanted - mat.emissiveIntensity) * Math.min(1, dt * 6);
      mesh.position.y =
        tile(id).pos[1] + 0.18 + (this.highlight.includes(id) ? Math.sin(this.frame * 0.1) * 0.25 : 0);
    });

    this.renderer.render(this.scene, this.camera);
  };

  private onResize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
