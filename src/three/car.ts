import * as THREE from 'three';
import { loadCarModel, WHEEL_PIVOT } from './carModel';

export interface CarRig {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  body: THREE.Mesh;
}

const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.42, 20);
wheelGeo.rotateZ(Math.PI / 2);
const rubber = new THREE.MeshStandardMaterial({ color: '#111114', roughness: 0.9 });

/**
 * Procedural open wheel car. Intentionally low poly but silhouette accurate so
 * it reads as a modern F1 machine from the board camera.
 */
export function buildCar(
  primary: string,
  secondary: string,
  accent: string,
  model?: string,
): CarRig {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color: primary,
    metalness: 0.55,
    roughness: 0.28,
  });
  const trim = new THREE.MeshStandardMaterial({
    color: secondary,
    metalness: 0.4,
    roughness: 0.3,
  });
  const glow = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: new THREE.Color(accent),
    emissiveIntensity: 0.6,
    roughness: 0.4,
  });

  const monocoque = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.38, 3.5), paint);
  monocoque.position.y = 0.52;
  monocoque.castShadow = true;
  group.add(monocoque);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.5, 8), paint);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.48, 2.3);
  nose.castShadow = true;
  group.add(nose);

  const frontWing = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.09, 0.65), trim);
  frontWing.position.set(0, 0.22, 2.75);
  frontWing.castShadow = true;
  group.add(frontWing);

  const endplateGeo = new THREE.BoxGeometry(0.08, 0.34, 0.66);
  [-0.98, 0.98].forEach((x) => {
    const ep = new THREE.Mesh(endplateGeo, glow);
    ep.position.set(x, 0.32, 2.75);
    group.add(ep);
  });

  [-0.78, 0.78].forEach((x) => {
    const pod = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.52, 1.7), paint);
    pod.position.set(x, 0.55, -0.15);
    pod.castShadow = true;
    group.add(pod);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.12, 1.72), trim);
    stripe.position.set(x, 0.78, -0.15);
    group.add(stripe);
  });

  const airbox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.7), paint);
  airbox.position.set(0, 0.95, -0.85);
  airbox.castShadow = true;
  group.add(airbox);

  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.055, 8, 18, Math.PI), trim);
  halo.rotation.set(Math.PI / 2, 0, 0);
  halo.position.set(0, 0.86, 0.35);
  group.add(halo);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), glow);
  helmet.position.set(0, 0.86, 0.1);
  group.add(helmet);

  const rearWing = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 0.14), trim);
  rearWing.position.set(0, 1.0, -1.75);
  rearWing.castShadow = true;
  group.add(rearWing);
  [-0.72, 0.72].forEach((x) => {
    const ep = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.6, 0.7), glow);
    ep.position.set(x, 0.86, -1.6);
    group.add(ep);
  });

  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.4), rubber);
  diffuser.position.set(0, 0.3, -1.85);
  group.add(diffuser);

  const wheels: THREE.Object3D[] = [];
  const offsets: [number, number][] = [
    [-0.95, 1.35],
    [0.95, 1.35],
    [-1.0, -1.25],
    [1.0, -1.25],
  ];
  offsets.forEach(([x, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, rubber);
    wheel.position.set(x, 0.42, z);
    wheel.castShadow = true;
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.44, 12),
      new THREE.MeshStandardMaterial({ color: secondary, metalness: 0.8, roughness: 0.25 }),
    );
    rim.rotation.z = Math.PI / 2;
    wheel.add(rim);
    wheels.push(wheel);
    group.add(wheel);
  });

  if (model) {
    const shell = new THREE.Group();
    group.children.slice().forEach((child) => shell.add(child));
    group.add(shell);
    loadCarModel(model).then((loaded) => {
      const copy = loaded.clone(true);
      shell.visible = false;
      group.add(copy);
      const pivots: THREE.Object3D[] = [];
      copy.traverse((o) => {
        if (o.name === WHEEL_PIVOT) pivots.push(o);
      });
      if (pivots.length) wheels.splice(0, wheels.length, ...pivots);
    });
  }

  return { group, wheels, body: monocoque };
}
