import * as THREE from 'three';
import {
  RAMPS,
  SAMPLES_LIST,
  SHORTCUTS,
  STADIUM_CENTER,
  inRect,
  type TrackSample,
} from '../race/track';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { asphaltTexture, cobbleTexture, facadeTexture, grassTexture, standTexture } from './textures';

/** Length the imported pitch is scaled to so the circuit still fits across it. */
const PITCH_LENGTH = 100;

const CAMINITO_COLORS = ['#e94f37', '#f6bd3b', '#3fa7d6', '#59cd90', '#f26419', '#8a4fff'];

function seeded(i: number): number {
  const x = Math.sin(i * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function insideStadium(p: THREE.Vector3): boolean {
  return Math.abs(p.x - STADIUM_CENTER.x) < 56 && Math.abs(p.z - STADIUM_CENTER.z) < 62;
}

/** Keeps walls and houses away from the mouths of the dirt shortcuts. */
function nearShortcut(p: THREE.Vector3, margin: number): boolean {
  return SHORTCUTS.some((z) =>
    inRect(p, z.pos, z.yaw, z.size[0] + margin, z.size[1] + margin),
  );
}

/** Static props are welded into one mesh per material to keep draw calls low. */
function addMerged(
  scene: THREE.Scene,
  geos: THREE.BufferGeometry[],
  material: THREE.Material,
  shadows = false,
) {
  if (!geos.length) return;
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  if (!merged) return;
  const mesh = new THREE.Mesh(merged, material);
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  scene.add(mesh);
}

function placed(
  geo: THREE.BufferGeometry,
  pos: THREE.Vector3,
  yaw: number,
): THREE.BufferGeometry {
  const out = geo.clone();
  out.applyMatrix4(
    new THREE.Matrix4().compose(
      pos,
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
      new THREE.Vector3(1, 1, 1),
    ),
  );
  return out;
}

export interface WorldHandles {
  floodlights: THREE.SpotLight[];
  rainSystem: THREE.Points;
}

/** Cobbles, painted houses, the docks, the circuit itself and the stadium. */
export function buildWorld(scene: THREE.Scene): WorldHandles {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ map: cobbleTexture(), roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  buildWater(scene);
  buildRoad(scene);
  buildDecor(scene);
  const floodlights = buildStadium(scene);
  const rainSystem = buildRain(scene);
  return { floodlights, rainSystem };
}

function buildWater(scene: THREE.Scene) {
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 260),
    new THREE.MeshStandardMaterial({
      color: '#3c6f79',
      metalness: 0.3,
      roughness: 0.25,
      emissive: new THREE.Color('#12333a'),
      emissiveIntensity: 0.45,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(470, 0.04, -120);
  scene.add(water);

  const steel = new THREE.MeshStandardMaterial({ color: '#7c3b2a', metalness: 0.6, roughness: 0.5 });
  const bridge = new THREE.Group();
  [-1, 1].forEach((s) => {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(2.6, 52, 2.6), steel);
    tower.position.set(s * 18, 26, 0);
    bridge.add(tower);
  });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(40, 1.8, 3.4), steel);
  deck.position.y = 50;
  bridge.add(deck);
  bridge.position.set(226, 0, -120);
  scene.add(bridge);

  const containerColors = ['#c0392b', '#2980b9', '#27ae60', '#f39c12'];
  for (let i = 0; i < 40; i++) {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(8, 3, 3.2),
      new THREE.MeshStandardMaterial({
        color: containerColors[i % containerColors.length],
        roughness: 0.85,
      }),
    );
    box.position.set(
      256 + (i % 5) * 9,
      1.5 + Math.floor(i / 10) * 3,
      -200 + Math.floor(i / 5) * 12,
    );
    box.castShadow = true;
    scene.add(box);
  }

  for (let i = 0; i < 3; i++) {
    const crane = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.BoxGeometry(2, 34, 2), steel);
    mast.position.y = 17;
    crane.add(mast);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(40, 1.6, 2), steel);
    arm.position.set(-12, 33, 0);
    crane.add(arm);
    crane.position.set(262, 0, -60 - i * 56);
    scene.add(crane);
  }
}

/** Tarmac ribbon, curbs, start line and the shortcut surfaces. */
function buildRoad(scene: THREE.Scene) {
  const road = new THREE.Mesh(
    ribbonGeometry(SAMPLES_LIST, (s) => s.half),
    new THREE.MeshStandardMaterial({ map: asphaltTexture(), roughness: 0.82 }),
  );
  road.position.y = 0.08;
  road.receiveShadow = true;
  scene.add(road);

  // Red and white curbs on both sides.
  const curbMat = new THREE.MeshStandardMaterial({ color: '#d8d8d8', roughness: 0.7 });
  const curbRed = new THREE.MeshStandardMaterial({ color: '#c8343a', roughness: 0.7 });
  const curbGeo = new THREE.BoxGeometry(1.5, 0.16, 4.6);
  const white: THREE.BufferGeometry[] = [];
  const red: THREE.BufferGeometry[] = [];
  SAMPLES_LIST.forEach((s, i) => {
    if (i % 6 !== 0) return;
    if (insideStadium(s.pos)) return;
    [1, -1].forEach((side) => {
      const pos = s.pos
        .clone()
        .addScaledVector(s.right, side * (s.half + 0.7))
        .setY(0.12);
      const piece = placed(curbGeo, pos, Math.atan2(s.dir.x, s.dir.z));
      (i % 12 === 0 ? red : white).push(piece);
    });
  });
  addMerged(scene, white, curbMat);
  addMerged(scene, red, curbRed);

  // Start / finish line.
  const start = SAMPLES_LIST[0];
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(start.half * 2, 3),
    new THREE.MeshStandardMaterial({ map: checkerTexture(), roughness: 0.6 }),
  );
  line.rotation.x = -Math.PI / 2;
  line.rotation.z = -Math.atan2(start.dir.x, start.dir.z);
  line.position.copy(start.pos).setY(0.14);
  scene.add(line);

  const gantry = new THREE.Group();
  const post = new THREE.BoxGeometry(1.1, 9, 1.1);
  const postMat = new THREE.MeshStandardMaterial({ color: '#1b1f2a', roughness: 0.6 });
  [-1, 1].forEach((side) => {
    const p = new THREE.Mesh(post, postMat);
    p.position.copy(start.pos).addScaledVector(start.right, side * (start.half + 1.5)).setY(4.5);
    gantry.add(p);
  });
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(start.half * 2 + 4, 2.4, 0.6),
    new THREE.MeshStandardMaterial({
      color: '#0b4ea2',
      emissive: new THREE.Color('#0b4ea2'),
      emissiveIntensity: 0.4,
    }),
  );
  banner.position.copy(start.pos).setY(9);
  banner.rotation.y = Math.atan2(start.dir.x, start.dir.z);
  gantry.add(banner);
  scene.add(gantry);

  // Shortcut surfaces: packed dirt alleys and plazas.
  SHORTCUTS.forEach((z) => {
    const patch = new THREE.Mesh(
      new THREE.PlaneGeometry(z.size[0], z.size[1]),
      new THREE.MeshStandardMaterial({ color: '#7a6244', roughness: 1 }),
    );
    patch.rotation.x = -Math.PI / 2;
    patch.rotation.z = -z.yaw;
    patch.position.copy(z.pos).setY(0.07);
    patch.receiveShadow = true;
    scene.add(patch);
  });

  // Jump ramps.
  RAMPS.forEach((r) => {
    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(r.width, 1.5, r.length),
      new THREE.MeshStandardMaterial({ color: '#f2c500', roughness: 0.6 }),
    );
    ramp.position.copy(r.pos).setY(0.4);
    ramp.rotation.y = r.yaw;
    ramp.rotation.x = -0.16;
    ramp.castShadow = true;
    scene.add(ramp);
  });
}

/** Two sided ribbon mesh following the centre line. */
function ribbonGeometry(
  samples: TrackSample[],
  halfOf: (s: TrackSample) => number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const n = samples.length;
  samples.forEach((s, i) => {
    const h = halfOf(s);
    const l = s.pos.clone().addScaledVector(s.right, -h);
    const r = s.pos.clone().addScaledVector(s.right, h);
    positions.push(l.x, 0, l.z, r.x, 0, r.z);
    const v = s.dist / 12;
    uvs.push(0, v, 1, v);
    const a = i * 2;
    const b = ((i + 1) % n) * 2;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function checkerTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#101015' : '#f5f5f5';
      ctx.fillRect(x * 16, y * 16, 16, 16);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 1);
  return tex;
}

/** Houses, murals, signs, palms and the crowd lining the circuit. */
function buildDecor(scene: THREE.Scene) {
  const facadeMats = CAMINITO_COLORS.map(
    (c) => new THREE.MeshStandardMaterial({ map: facadeTexture(c), roughness: 0.75 }),
  );
  const crowdGeo = new THREE.CapsuleGeometry(0.4, 1.05, 4, 8);
  const crowdMats = ['#2f3640', '#8e44ad', '#16a085', '#c0392b', '#2c3e50', '#d35400'].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
  );
  const crowdDummy = new THREE.Object3D();
  const crowdMeshes = crowdMats.map((m) => {
    const mesh = new THREE.InstancedMesh(crowdGeo, m, 220);
    mesh.count = 0;
    scene.add(mesh);
    return mesh;
  });
  const crowdCount = crowdMats.map(() => 0);

  const barrierMat = new THREE.MeshStandardMaterial({ color: '#d7dae0', roughness: 0.7 });
  const barrierGeo = new THREE.BoxGeometry(0.7, 1.1, 5);
  const barriers: THREE.BufferGeometry[] = [];
  const houseParts: THREE.BufferGeometry[][] = facadeMats.map(() => []);
  const signParts: THREE.BufferGeometry[][] = CAMINITO_COLORS.map(() => []);

  SAMPLES_LIST.forEach((s, i) => {
    if (i % 6 !== 0) return;
    if (insideStadium(s.pos)) return;

    // Track side barriers.
    [1, -1].forEach((side) => {
      const pos = s.pos
        .clone()
        .addScaledVector(s.right, side * (s.half + 2.2))
        .setY(0.55);
      if (nearShortcut(pos, 6)) return;
      barriers.push(placed(barrierGeo, pos, Math.atan2(s.dir.x, s.dir.z)));
    });

    // Painted houses set back from the barriers.
    if (i % 18 === 0) {
      [1, -1].forEach((side) => {
        if (seeded(i * 3.7 + side) > 0.82) return;
        const h = 6 + seeded(i * 7.3 + side) * 9;
        const w = 7 + seeded(i * 2.1) * 5;
        const yaw = Math.atan2(s.dir.x, s.dir.z);
        const pos = s.pos
          .clone()
          .addScaledVector(s.right, side * (s.half + 13 + seeded(i) * 7))
          .setY(h / 2);
        if (nearShortcut(pos, 14)) return;
        const matIndex = Math.floor(seeded(i + side * 13) * facadeMats.length);
        houseParts[matIndex].push(
          placed(new THREE.BoxGeometry(w, h, 8 + seeded(i * 5.5) * 4), pos, yaw),
        );

        if (seeded(i * 11.3) > 0.6) {
          const signPos = pos
            .clone()
            .addScaledVector(s.right, -side * 4.2)
            .setY(h * 0.75);
          signParts[i % CAMINITO_COLORS.length].push(
            placed(new THREE.BoxGeometry(w * 0.7, 1.6, 0.3), signPos, yaw),
          );
        }
      });
    }

    // Spectators behind the barriers.
    const ci = i % crowdMats.length;
    if (crowdCount[ci] < 220) {
      const side = seeded(i * 4.1) > 0.5 ? 1 : -1;
      crowdDummy.position
        .copy(s.pos)
        .addScaledVector(s.right, side * (s.half + 4 + seeded(i * 6.7) * 3))
        .setY(1.0);
      if (nearShortcut(crowdDummy.position, 6)) return;
      crowdDummy.rotation.y = Math.atan2(-s.right.x * side, -s.right.z * side);
      crowdDummy.updateMatrix();
      crowdMeshes[ci].setMatrixAt(crowdCount[ci], crowdDummy.matrix);
      crowdCount[ci] += 1;
    }
  });
  crowdMeshes.forEach((m, i) => {
    m.count = crowdCount[i];
    m.instanceMatrix.needsUpdate = true;
  });

  addMerged(scene, barriers, barrierMat, true);
  houseParts.forEach((parts, i) => addMerged(scene, parts, facadeMats[i], true));
  signParts.forEach((parts, i) =>
    addMerged(
      scene,
      parts,
      new THREE.MeshStandardMaterial({
        color: CAMINITO_COLORS[i],
        emissive: new THREE.Color(CAMINITO_COLORS[(i + 2) % CAMINITO_COLORS.length]),
        emissiveIntensity: 0.6,
      }),
    ),
  );
}

/** La Bombonera: three steep stands, the flat vertical side and two tunnels. */
function buildStadium(scene: THREE.Scene): THREE.SpotLight[] {
  const stadium = new THREE.Group();
  stadium.position.copy(STADIUM_CENTER);
  const shell = new THREE.Group();
  stadium.add(shell);

  const pitch = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 100),
    new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 0.95 }),
  );
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.y = 0.02;
  pitch.receiveShadow = true;
  stadium.add(pitch);

  const lineMat = new THREE.MeshStandardMaterial({ color: '#f2f2f2' });
  const circle = new THREE.Mesh(new THREE.RingGeometry(9, 9.6, 48), lineMat);
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = 0.05;
  stadium.add(circle);

  const standMat = new THREE.MeshStandardMaterial({ map: standTexture(), roughness: 0.9 });
  const concrete = new THREE.MeshStandardMaterial({ color: '#12336b', roughness: 0.8 });

  [-1, 1].forEach((s) => {
    for (let tier = 0; tier < 3; tier++) {
      const h = 10;
      const seat = new THREE.Mesh(new THREE.BoxGeometry(15, h, 104), standMat);
      seat.position.set(s * (44 + tier * 6), tier * 9 + h / 2, 0);
      seat.rotation.z = s * -0.2;
      seat.castShadow = true;
      shell.add(seat);
    }
  });

  // End stands with a gap so the circuit can pass underneath.
  [1, -1].forEach((s) => {
    for (let tier = 0; tier < 3; tier++) {
      [-1, 1].forEach((half) => {
        const end = new THREE.Mesh(new THREE.BoxGeometry(30, 10, 15), standMat);
        end.position.set(half * 43, tier * 9 + 5, s * (54 + tier * 6));
        end.rotation.x = s * 0.2;
        end.castShadow = true;
        shell.add(end);
      });
      // Deck bridging over the tunnel mouth.
      const over = new THREE.Mesh(new THREE.BoxGeometry(56, 10, 15), standMat);
      over.position.set(0, tier * 9 + 14, s * (54 + tier * 6));
      over.rotation.x = s * 0.2;
      shell.add(over);
    }
    const tunnel = new THREE.Mesh(
      new THREE.BoxGeometry(56, 1.2, 30),
      new THREE.MeshStandardMaterial({ color: '#0d0f14', roughness: 1 }),
    );
    tunnel.position.set(0, 11.5, s * 56);
    shell.add(tunnel);
    [-1, 1].forEach((side) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(2, 12, 30), concrete);
      wall.position.set(side * 29, 6, s * 56);
      shell.add(wall);
    });
  });

  const flat = new THREE.Mesh(new THREE.BoxGeometry(16, 38, 104), concrete);
  flat.position.set(64, 19, 0);
  flat.castShadow = true;
  shell.add(flat);

  const floodlights: THREE.SpotLight[] = [];
  const corners: [number, number][] = [
    [-50, -60],
    [50, -60],
    [-50, 60],
    [50, 60],
  ];
  corners.forEach(([x, z]) => {
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1, 52, 10),
      new THREE.MeshStandardMaterial({ color: '#2a2f3a', metalness: 0.6, roughness: 0.5 }),
    );
    mast.position.set(x, 26, z);
    stadium.add(mast);
    const rig = new THREE.Mesh(
      new THREE.BoxGeometry(10, 4, 1.3),
      new THREE.MeshStandardMaterial({
        color: '#fffbe6',
        emissive: new THREE.Color('#fff4c2'),
        emissiveIntensity: 1.6,
      }),
    );
    rig.position.set(x, 51, z);
    rig.lookAt(STADIUM_CENTER);
    stadium.add(rig);

    const light = new THREE.SpotLight('#fff6de', 2.2, 260, Math.PI / 4.5, 0.6, 1.1);
    light.position.set(x, 52, z);
    light.target.position.set(0, 0, 0);
    stadium.add(light);
    stadium.add(light.target);
    floodlights.push(light);
  });

  scene.add(stadium);
  loadStadiumModel(stadium, shell);
  return floodlights;
}

/** Swaps the blocky stands for the detailed Bombonera once the model arrives. */
function loadStadiumModel(stadium: THREE.Group, shell: THREE.Group) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(`${import.meta.env.BASE_URL}models/bombonera.glb`, (gltf) => {
    const model = gltf.scene;
    model.updateMatrixWorld(true);
    const pitch = new THREE.Box3();
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      if (/cancha/i.test((mesh.material as THREE.Material).name)) pitch.expandByObject(mesh);
    });
    if (pitch.isEmpty()) return;
    const origin = pitch.getCenter(new THREE.Vector3()).setY(pitch.max.y);
    const scale = PITCH_LENGTH / (pitch.max.z - pitch.min.z);
    trimStadium(model, origin, scale);
    model.scale.setScalar(scale);
    model.position.copy(origin).multiplyScalar(-scale);
    shell.visible = false;
    stadium.add(model);
  });
}

/**
 * Drops the city block that ships around the model and opens the stands at
 * both ends so the circuit can run in and out of the pitch.
 */
function trimStadium(model: THREE.Object3D, origin: THREE.Vector3, scale: number) {
  const corridor = trackCorridor();
  const seen = new Set<THREE.BufferGeometry>();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    let geo = mesh.geometry as THREE.BufferGeometry;
    if (seen.has(geo)) {
      geo = geo.clone();
      mesh.geometry = geo;
    }
    seen.add(geo);
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const src: ArrayLike<number> =
      geo.getIndex()?.array ?? Array.from({ length: pos.count }, (_, i) => i);
    const kept: number[] = [];
    for (let i = 0; i < src.length; i += 3) {
      a.fromBufferAttribute(pos, src[i]).applyMatrix4(mesh.matrixWorld).sub(origin);
      b.fromBufferAttribute(pos, src[i + 1]).applyMatrix4(mesh.matrixWorld).sub(origin);
      c.fromBufferAttribute(pos, src[i + 2]).applyMatrix4(mesh.matrixWorld).sub(origin);
      const x = (a.x + b.x + c.x) / 3;
      const y = (a.y + b.y + c.y) / 3;
      const z = (a.z + b.z + c.z) / 3;
      const outsideBowl = Math.abs(x) > 95 || Math.abs(z) > 112 || y < -3;
      const onTrack =
        y * scale < TUNNEL_HEIGHT &&
        corridor.has(corridorKey(STADIUM_CENTER.x + x * scale, STADIUM_CENTER.z + z * scale));
      if (outsideBowl || onTrack) continue;
      kept.push(src[i], src[i + 1], src[i + 2]);
    }
    if (kept.length === src.length) return;
    geo.setIndex(kept);
  });
}

const CORRIDOR_CELL = 5;
const CORRIDOR_HALF = 15;
const TUNNEL_HEIGHT = 22;

const corridorKey = (x: number, z: number) =>
  `${Math.floor(x / CORRIDOR_CELL)}:${Math.floor(z / CORRIDOR_CELL)}`;

/** Cells of the circuit that run through the stadium, used to carve the tunnels. */
function trackCorridor(): Set<string> {
  const cells = new Set<string>();
  for (const sample of SAMPLES_LIST) {
    if (sample.pos.distanceTo(STADIUM_CENTER) > 200) continue;
    for (let dx = -CORRIDOR_HALF; dx <= CORRIDOR_HALF; dx += CORRIDOR_CELL)
      for (let dz = -CORRIDOR_HALF; dz <= CORRIDOR_HALF; dz += CORRIDOR_CELL)
        cells.add(corridorKey(sample.pos.x + dx, sample.pos.z + dz));
  }
  return cells;
}

function buildRain(scene: THREE.Scene): THREE.Points {
  const count = 4000;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 160;
    positions[i * 3 + 1] = Math.random() * 60;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 160;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color: '#cfe8ff', size: 0.35, transparent: true, opacity: 0.75 }),
  );
  points.visible = false;
  scene.add(points);
  return points;
}
