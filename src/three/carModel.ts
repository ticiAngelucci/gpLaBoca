import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/** Nose-to-diffuser length every imported car is scaled to, in metres. */
const CAR_LENGTH = 5.12;

/** Marks the spinning hubs carved out of an imported hull. */
export const WHEEL_PIVOT = 'wheelPivot';

const modelCache = new Map<string, Promise<THREE.Object3D>>();

interface WheelHub {
  center: THREE.Vector3;
  radius: number;
}

interface WheelCandidate extends WheelHub {
  triangles: number;
}

function collectMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry.getAttribute('position')) meshes.push(mesh);
  });
  return meshes;
}

/** Find connected pieces whose side profile is circular, low and outboard. */
function wheelCandidates(
  mesh: THREE.Mesh,
  toRoot: THREE.Matrix4,
  carBox: THREE.Box3,
): WheelCandidate[] {
  const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  const index = mesh.geometry.getIndex();
  if (!index) return [];

  // A GLB may put the whole car in one mesh, but its wheel rings are still
  // disconnected pieces. Grouping by shared vertices lets us identify those
  // rings without mistaking the front wing or floor for a tyre.
  const parent = Int32Array.from({ length: pos.count }, (_, i) => i);
  const find = (value: number): number => {
    let root = value;
    while (parent[root] !== root) root = parent[root];
    while (parent[value] !== value) {
      const next = parent[value];
      parent[value] = root;
      value = next;
    }
    return root;
  };
  const union = (left: number, right: number) => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent[b] = a;
  };

  const indices = index.array;
  for (let i = 0; i < indices.length; i += 3) {
    union(indices[i], indices[i + 1]);
    union(indices[i], indices[i + 2]);
  }

  const components = new Map<number, { box: THREE.Box3; triangles: number }>();
  const point = new THREE.Vector3();
  for (let i = 0; i < indices.length; i += 3) {
    const root = find(indices[i]);
    let component = components.get(root);
    if (!component) {
      component = { box: new THREE.Box3(), triangles: 0 };
      components.set(root, component);
    }
    component.triangles += 1;
    for (let corner = 0; corner < 3; corner += 1) {
      point.fromBufferAttribute(pos, indices[i + corner]).applyMatrix4(toRoot);
      component.box.expandByPoint(point);
    }
  }

  const carSize = carBox.getSize(new THREE.Vector3());
  const midX = (carBox.min.x + carBox.max.x) / 2;
  const componentSize = new THREE.Vector3();
  const center = new THREE.Vector3();
  const candidates: WheelCandidate[] = [];
  components.forEach((component) => {
    component.box.getSize(componentSize);
    component.box.getCenter(center);
    const minDiameter = Math.min(componentSize.y, componentSize.z);
    const maxDiameter = Math.max(componentSize.y, componentSize.z);
    const diameter = (componentSize.y + componentSize.z) / 2;
    const circular = maxDiameter / Math.max(minDiameter, Number.EPSILON) <= 1.25;
    const thinSideProfile = componentSize.x <= diameter * 0.55;
    const outboard = Math.abs(center.x - midX) >= carSize.x * 0.25;
    const low = center.y <= carBox.min.y + carSize.y * 0.6;
    const largeEnough = minDiameter >= carSize.y * 0.32;
    if (
      component.triangles >= 20 &&
      circular &&
      thinSideProfile &&
      outboard &&
      low &&
      largeEnough
    ) {
      candidates.push({
        center: center.clone(),
        radius: diameter / 2,
        triangles: component.triangles,
      });
    }
  });
  return candidates;
}

/**
 * Imported cars arrive as static hulls with no useful node names. Wheel hubs
 * are inferred from complete circular components instead of loose vertices;
 * the latter are heavily biased by wings and used to make the car flap apart.
 */
function findWheelHubs(meshes: THREE.Mesh[], toRoot: THREE.Matrix4[], box: THREE.Box3): WheelHub[] {
  const size = box.getSize(new THREE.Vector3());
  const midX = (box.min.x + box.max.x) / 2;
  const candidates = meshes.flatMap((mesh, i) => wheelCandidates(mesh, toRoot[i], box));
  if (candidates.length < 4) return [];

  // Candidates from the same tyre (sidewall, rim and tread) have practically
  // the same Z. Merge them into axle clusters, then retain the two clusters
  // that contain a circular component on both sides of the car.
  const clusters: { z: number; candidates: WheelCandidate[] }[] = [];
  const tolerance = size.z * 0.08;
  candidates
    .sort((a, b) => a.center.z - b.center.z)
    .forEach((candidate) => {
      const cluster = clusters.find((entry) => Math.abs(entry.z - candidate.center.z) <= tolerance);
      if (cluster) {
        cluster.candidates.push(candidate);
        cluster.z =
          cluster.candidates.reduce((sum, entry) => sum + entry.center.z, 0) /
          cluster.candidates.length;
      } else {
        clusters.push({ z: candidate.center.z, candidates: [candidate] });
      }
    });

  const axles = clusters
    .map((cluster) => {
      const left = cluster.candidates
        .filter((candidate) => candidate.center.x < midX)
        .sort((a, b) => b.radius - a.radius)[0];
      const right = cluster.candidates
        .filter((candidate) => candidate.center.x > midX)
        .sort((a, b) => b.radius - a.radius)[0];
      return left && right ? { left, right } : null;
    })
    .filter((axle): axle is { left: WheelCandidate; right: WheelCandidate } => axle !== null)
    .sort((a, b) => b.left.radius + b.right.radius - (a.left.radius + a.right.radius))
    .slice(0, 2);

  if (axles.length !== 2 || Math.abs(axles[0].left.center.z - axles[1].left.center.z) < size.z * 0.25) {
    return [];
  }
  return axles.flatMap(({ left, right }) => [left, right]);
}

/**
 * Re-parents the tyre triangles of every mesh under a pivot centred on their
 * hub so they can spin. Index buffers are rebuilt per hub while the vertex
 * attributes stay shared with the original geometry.
 */
function detachWheels(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const meshes = collectMeshes(root);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const toRoot = meshes.map((mesh) => new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld));
  const localBox = new THREE.Box3();
  meshes.forEach((mesh, mi) => {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    localBox.union(mesh.geometry.boundingBox!.clone().applyMatrix4(toRoot[mi]));
  });
  const hubs = findWheelHubs(meshes, toRoot, localBox);
  if (!hubs.length) return;

  const carSize = localBox.getSize(new THREE.Vector3());
  const midX = (localBox.min.x + localBox.max.x) / 2;
  const innerWheelEdge = carSize.x * 0.25;
  const insideWheel = (point: THREE.Vector3, hub: WheelHub): boolean =>
    Math.sign(point.x - midX) === Math.sign(hub.center.x - midX) &&
    Math.abs(point.x - midX) >= innerWheelEdge &&
    Math.hypot(point.y - hub.center.y, point.z - hub.center.z) <= hub.radius * 1.08;

  const pivots = hubs.map((hub) => {
    const pivot = new THREE.Group();
    pivot.name = WHEEL_PIVOT;
    pivot.position.copy(hub.center);
    root.add(pivot);
    return pivot;
  });

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  meshes.forEach((mesh, mi) => {
    const geo = mesh.geometry;
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const index = geo.getIndex();
    const idx = index
      ? Array.from(index.array)
      : Array.from({ length: pos.count }, (_, i) => i);
    const rel = toRoot[mi];
    const kept: number[] = [];
    const perHub: number[][] = hubs.map(() => []);
    for (let i = 0; i < idx.length; i += 3) {
      a.fromBufferAttribute(pos, idx[i]).applyMatrix4(rel);
      b.fromBufferAttribute(pos, idx[i + 1]).applyMatrix4(rel);
      c.fromBufferAttribute(pos, idx[i + 2]).applyMatrix4(rel);
      // Every corner must belong to the wheel volume. A centroid-only test can
      // grab a long wing triangle and turn it into a spinning mower blade.
      const hit = hubs.findIndex(
        (hub) => insideWheel(a, hub) && insideWheel(b, hub) && insideWheel(c, hub),
      );
      if (hit < 0) kept.push(idx[i], idx[i + 1], idx[i + 2]);
      else perHub[hit].push(idx[i], idx[i + 1], idx[i + 2]);
    }
    if (kept.length === idx.length) return;
    geo.setIndex(kept);
    perHub.forEach((list, h) => {
      if (!list.length) return;
      const tyre = new THREE.BufferGeometry();
      Object.keys(geo.attributes).forEach((name) => {
        tyre.setAttribute(name, geo.attributes[name]);
      });
      tyre.setIndex(list);
      const piece = new THREE.Mesh(tyre, mesh.material);
      piece.castShadow = true;
      piece.matrixAutoUpdate = false;
      piece.matrix
        .makeTranslation(-hubs[h].center.x, -hubs[h].center.y, -hubs[h].center.z)
        .multiply(rel);
      pivots[h].add(piece);
    });
  });
}

/**
 * Loads a GLB from public/models and normalises it to the game's car space:
 * nose towards +Z, centred on the origin and resting on the ground.
 */
export function loadCarModel(file: string): Promise<THREE.Object3D> {
  const cached = modelCache.get(file);
  if (cached) return cached;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const pending = loader.loadAsync(`${import.meta.env.BASE_URL}models/${file}`).then((gltf) => {
    const model = gltf.scene;
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    if (size.x > size.z) {
      model.rotateY(Math.PI / 2);
      model.updateMatrixWorld(true);
      box.setFromObject(model);
      box.getSize(size);
      box.getCenter(center);
    }
    const group = new THREE.Group();
    group.add(model);
    group.scale.setScalar(CAR_LENGTH / size.z);
    model.position.set(-center.x, -box.min.y, -center.z);
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mesh.castShadow = true;
    });
    group.updateMatrixWorld(true);
    detachWheels(model);
    return group;
  });
  modelCache.set(file, pending);
  return pending;
}
