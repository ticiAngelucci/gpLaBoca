import * as THREE from 'three';
import { BOARD } from '../engine/board';
import { cobbleTexture, facadeTexture, grassTexture, standTexture } from './textures';

const CAMINITO_COLORS = ['#e94f37', '#f6bd3b', '#3fa7d6', '#59cd90', '#f26419', '#8a4fff'];

function seeded(i: number): number {
  const x = Math.sin(i * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

/** Streets, cobblestones, painted houses, the docks and the stadium shell. */
export function buildWorld(scene: THREE.Scene): { floodlights: THREE.SpotLight[] } {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshStandardMaterial({ map: cobbleTexture(), roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Riachuelo water on the north east side of the neighbourhood.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 170),
    new THREE.MeshStandardMaterial({
      color: '#3c6f79',
      metalness: 0.25,
      roughness: 0.3,
      emissive: new THREE.Color('#12333a'),
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.94,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(140, 0.05, 170);
  water.receiveShadow = true;
  scene.add(water);

  // Painted houses hugging the outside of the street loop.
  const facadeMats = CAMINITO_COLORS.map(
    (c) => new THREE.MeshStandardMaterial({ map: facadeTexture(c), roughness: 0.75 }),
  );
  const street = BOARD.filter((t) => !t.inside);
  const center = new THREE.Vector3(-4, 0, -4);
  street.forEach((t, i) => {
    if (i % 2 !== 0) return;
    const p = new THREE.Vector3(...t.pos);
    const outward = p.clone().sub(center).setY(0).normalize();
    for (const side of [1, -1]) {
      if (side === -1 && seeded(i * 3.7) > 0.45) continue;
      // Kept well back from the street so the board stays readable from above.
      const dist = side === 1 ? 17 + seeded(i) * 6 : -(16 + seeded(i + 99) * 5);
      const h = 5 + seeded(i * 7.3) * 6;
      const w = 6 + seeded(i * 2.1) * 4;
      const house = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, 6 + seeded(i * 5.5) * 3),
        facadeMats[Math.floor(seeded(i + side * 13) * facadeMats.length)],
      );
      house.position.copy(p).addScaledVector(outward, dist);
      house.position.y = h / 2;
      house.lookAt(new THREE.Vector3(p.x, h / 2, p.z));
      house.castShadow = true;
      house.receiveShadow = true;
      scene.add(house);

      if (seeded(i * 11.3) > 0.55) {
        const balcony = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.8, 0.35, 1.6),
          new THREE.MeshStandardMaterial({ color: '#2b2b33', roughness: 0.6 }),
        );
        balcony.position.copy(house.position);
        balcony.position.y = h * 0.62;
        balcony.translateZ(3.4);
        balcony.quaternion.copy(house.quaternion);
        balcony.position.copy(house.position).addScaledVector(outward, -3.2);
        balcony.position.y = h * 0.62;
        scene.add(balcony);
      }
    }
  });

  // Transporter bridge silhouette over the water.
  const steel = new THREE.MeshStandardMaterial({ color: '#7c3b2a', metalness: 0.6, roughness: 0.5 });
  const bridge = new THREE.Group();
  [-1, 1].forEach((s) => {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(2.2, 46, 2.2), steel);
    tower.position.set(s * 16, 23, 0);
    tower.castShadow = true;
    bridge.add(tower);
  });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(36, 1.6, 3), steel);
  deck.position.y = 44;
  bridge.add(deck);
  bridge.position.set(120, 0, 120);
  scene.add(bridge);

  // Port cranes and containers.
  const containerColors = ['#c0392b', '#2980b9', '#27ae60', '#f39c12'];
  for (let i = 0; i < 16; i++) {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(7, 3, 3),
      new THREE.MeshStandardMaterial({
        color: containerColors[i % containerColors.length],
        roughness: 0.8,
      }),
    );
    box.position.set(96 + (i % 4) * 8, 1.5 + Math.floor(i / 8) * 3, 78 + Math.floor(i / 4) * 5);
    box.castShadow = true;
    scene.add(box);
  }

  buildCrowd(scene, street, center);

  const floodlights = buildStadium(scene);
  return { floodlights };
}

/** Neighbours on the sidewalk: cheap instanced silhouettes that fill the streets. */
function buildCrowd(scene: THREE.Scene, street: typeof BOARD, center: THREE.Vector3) {
  const skin = ['#2f3640', '#8e44ad', '#16a085', '#c0392b', '#2c3e50', '#d35400'];
  const geo = new THREE.CapsuleGeometry(0.42, 1.1, 4, 8);
  skin.forEach((color, ci) => {
    const mesh = new THREE.InstancedMesh(
      geo,
      new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
      street.length,
    );
    const dummy = new THREE.Object3D();
    let n = 0;
    street.forEach((t, i) => {
      if ((i + ci) % skin.length !== 0) return;
      const p = new THREE.Vector3(...t.pos);
      const outward = p.clone().sub(center).setY(0).normalize();
      const side = seeded(i * 4.1 + ci) > 0.5 ? 1 : -1;
      dummy.position
        .copy(p)
        .addScaledVector(outward, side * (8 + seeded(i * 6.7) * 4))
        .setY(1.05);
      dummy.position.x += (seeded(i * 9.3) - 0.5) * 3;
      dummy.position.z += (seeded(i * 1.7) - 0.5) * 3;
      dummy.rotation.y = seeded(i * 2.9) * Math.PI * 2;
      dummy.updateMatrix();
      mesh.setMatrixAt(n, dummy.matrix);
      n += 1;
    });
    mesh.count = n;
    mesh.castShadow = true;
    scene.add(mesh);
  });
}

/** La Bombonera inspired bowl: three steep stands plus the flat vertical side. */
function buildStadium(scene: THREE.Scene): THREE.SpotLight[] {
  const stadium = new THREE.Group();
  stadium.position.set(0, 0, -95);

  const pitch = new THREE.Mesh(
    new THREE.PlaneGeometry(64, 92),
    new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 0.95 }),
  );
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.y = -3.4;
  pitch.receiveShadow = true;
  stadium.add(pitch);

  const lineMat = new THREE.MeshStandardMaterial({ color: '#f2f2f2' });
  const circle = new THREE.Mesh(new THREE.RingGeometry(8.4, 9, 48), lineMat);
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = -3.35;
  stadium.add(circle);

  const standMat = new THREE.MeshStandardMaterial({ map: standTexture(), roughness: 0.9 });
  const concrete = new THREE.MeshStandardMaterial({ color: '#1b3a74', roughness: 0.8 });

  // Steep side stands.
  const sideStand = (x: number) => {
    const g = new THREE.Group();
    for (let tier = 0; tier < 3; tier++) {
      const h = 9;
      const seat = new THREE.Mesh(new THREE.BoxGeometry(14, h, 96), standMat);
      seat.position.set(x + Math.sign(x) * tier * 5.5, -3 + tier * 8.4 + h / 2, 0);
      seat.rotation.z = Math.sign(x) * -0.18;
      seat.castShadow = true;
      seat.receiveShadow = true;
      g.add(seat);
    }
    return g;
  };
  stadium.add(sideStand(-40));
  stadium.add(sideStand(40));

  // Curved ends.
  [1, -1].forEach((s) => {
    for (let tier = 0; tier < 3; tier++) {
      const end = new THREE.Mesh(new THREE.BoxGeometry(96, 9, 14), standMat);
      end.position.set(0, -3 + tier * 8.4 + 4.5, s * (52 + tier * 5.5));
      end.rotation.x = s * 0.18;
      end.castShadow = true;
      stadium.add(end);
    }
  });

  // The flat "vertical" stand that makes the ground unmistakable.
  const flat = new THREE.Mesh(new THREE.BoxGeometry(16, 34, 96), concrete);
  flat.position.set(58, 14, 0);
  flat.castShadow = true;
  stadium.add(flat);
  for (let i = 0; i < 4; i++) {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(2, 5, 92),
      new THREE.MeshStandardMaterial({
        color: '#0b1c3c',
        metalness: 0.3,
        roughness: 0.2,
        emissive: new THREE.Color('#0a2a5c'),
        emissiveIntensity: 0.4,
      }),
    );
    box.position.set(50.5, 4 + i * 8, 0);
    stadium.add(box);
  }

  // Tunnel mouth the cars drive through.
  const tunnel = new THREE.Mesh(
    new THREE.BoxGeometry(12, 8, 26),
    new THREE.MeshStandardMaterial({ color: '#12141a', roughness: 1 }),
  );
  tunnel.position.set(0, 0.5, 62);
  stadium.add(tunnel);

  const floodlights: THREE.SpotLight[] = [];
  const corners: [number, number][] = [
    [-46, -56],
    [46, -56],
    [-46, 56],
    [46, 56],
  ];
  corners.forEach(([x, z]) => {
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.9, 46, 10),
      new THREE.MeshStandardMaterial({ color: '#2a2f3a', metalness: 0.6, roughness: 0.5 }),
    );
    mast.position.set(x, 23, z);
    stadium.add(mast);
    const rig = new THREE.Mesh(
      new THREE.BoxGeometry(9, 4, 1.2),
      new THREE.MeshStandardMaterial({
        color: '#fffbe6',
        emissive: new THREE.Color('#fff4c2'),
        emissiveIntensity: 1.4,
      }),
    );
    rig.position.set(x, 45, z);
    rig.lookAt(new THREE.Vector3(0, 0, 0).add(stadium.position));
    stadium.add(rig);

    const light = new THREE.SpotLight('#fff6de', 0, 200, Math.PI / 5, 0.5, 1.2);
    light.position.set(x, 46, z);
    light.target.position.set(0, -3, 0);
    stadium.add(light);
    stadium.add(light.target);
    floodlights.push(light);
  });

  scene.add(stadium);
  return floodlights;
}
