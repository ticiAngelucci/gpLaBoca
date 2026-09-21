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

function collectMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry.getAttribute('position')) meshes.push(mesh);
  });
  return meshes;
}

/**
 * Imported cars arrive as static hulls with no useful node names, so the tyres
 * are found by shape: the only geometry sitting low and outboard, clustered
 * into two axles.
 */
function findWheelHubs(meshes: THREE.Mesh[], toRoot: THREE.Matrix4[], box: THREE.Box3): WheelHub[] {
  const size = box.getSize(new THREE.Vector3());
  const midX = (box.min.x + box.max.x) / 2;
  const outer = size.x * 0.3;
  const lowY = box.min.y + size.y * 0.45;
  const v = new THREE.Vector3();
  const candidates: THREE.Vector3[] = [];
  meshes.forEach((mesh, mi) => {
    const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i += 3) {
      v.fromBufferAttribute(pos, i).applyMatrix4(toRoot[mi]);
      if (Math.abs(v.x - midX) > outer && v.y < lowY) candidates.push(v.clone());
    }
  });
  if (candidates.length < 64) return [];

  let front = box.max.z - size.z * 0.25;
  let rear = box.min.z + size.z * 0.25;
  for (let pass = 0; pass < 12; pass += 1) {
    let fSum = 0;
    let fCount = 0;
    let rSum = 0;
    let rCount = 0;
    candidates.forEach((c) => {
      if (Math.abs(c.z - front) < Math.abs(c.z - rear)) {
        fSum += c.z;
        fCount += 1;
      } else {
        rSum += c.z;
        rCount += 1;
      }
    });
    if (!fCount || !rCount) return [];
    front = fSum / fCount;
    rear = rSum / rCount;
  }

  const hubs: WheelHub[] = [];
  [front, rear].forEach((axleZ) => {
    [-1, 1].forEach((side) => {
      const near = candidates.filter(
        (c) => Math.sign(c.x - midX) === side && Math.abs(c.z - axleZ) < size.z * 0.14,
      );
      if (near.length < 16) return;
      const b = new THREE.Box3().setFromPoints(near);
      const radius = Math.max(b.max.y - b.min.y, b.max.z - b.min.z) / 2;
      hubs.push({
        center: new THREE.Vector3((b.min.x + b.max.x) / 2, b.min.y + radius, axleZ),
        radius,
      });
    });
  });
  return hubs.length === 4 ? hubs : [];
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
      a.add(b).add(c).divideScalar(3);
      const hit = hubs.findIndex(
        (h) =>
          Math.abs(a.x - h.center.x) < h.radius * 2 &&
          Math.hypot(a.y - h.center.y, a.z - h.center.z) < h.radius * 1.02,
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
