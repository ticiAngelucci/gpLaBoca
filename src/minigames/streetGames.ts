import * as THREE from 'three';
import { buildCar } from '../three/car';
import { cobbleTexture, facadeTexture } from '../three/textures';
import { baseScene, type MinigameCtx, type MinigameFactory, type MinigameInstance } from './framework';

const LANE_X = [-6.5, -2.2, 2.2, 6.5];

function street(scene: THREE.Scene, length = 400) {
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(22, length),
    new THREE.MeshStandardMaterial({ map: cobbleTexture(), roughness: 0.95 }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.z = -length / 2 + 40;
  road.receiveShadow = true;
  scene.add(road);

  const colors = ['#e94f37', '#f6bd3b', '#3fa7d6', '#59cd90', '#f26419'];
  for (let i = 0; i < 60; i++) {
    for (const side of [-1, 1]) {
      const h = 7 + ((i * 37) % 9);
      const house = new THREE.Mesh(
        new THREE.BoxGeometry(8, h, 9),
        new THREE.MeshStandardMaterial({
          map: facadeTexture(colors[(i + (side > 0 ? 2 : 0)) % colors.length]),
          roughness: 0.8,
        }),
      );
      house.position.set(side * 17, h / 2, 40 - i * 10);
      house.castShadow = true;
      scene.add(house);
    }
  }
}

/** Sprint por Caminito: hold accelerate, steer between lanes, dodge the crowd. */
export const sprintCaminito: MinigameFactory = (ctx: MinigameCtx): MinigameInstance => {
  const scene = ctx.scene;
  street(scene);
  const FINISH = 320;

  const racers = ctx.players.map((p, i) => {
    const rig = buildCar(p.driver.colors[0], p.driver.colors[1], p.driver.accent);
    rig.group.position.set(LANE_X[i % 4], 0, 10);
    rig.group.rotation.y = Math.PI;
    scene.add(rig.group);
    return { p, rig, speed: 0, lane: i % 4, x: LANE_X[i % 4], dist: 0, stun: 0, finishedAt: 0 };
  });

  interface Obstacle {
    mesh: THREE.Mesh;
    z: number;
    x: number;
  }
  const obstacles: Obstacle[] = [];
  const coneGeo = new THREE.ConeGeometry(0.8, 1.8, 10);
  const coneMat = new THREE.MeshStandardMaterial({ color: '#ff6b1a' });
  for (let i = 0; i < 46; i++) {
    const x = LANE_X[Math.floor(ctx.rand() * 4)];
    const z = -18 - i * 7 - ctx.rand() * 4;
    const mesh = new THREE.Mesh(coneGeo, coneMat);
    mesh.position.set(x, 0.9, z);
    mesh.castShadow = true;
    scene.add(mesh);
    obstacles.push({ mesh, z, x });
  }

  ctx.camera.position.set(0, 9, 26);
  ctx.camera.lookAt(0, 1.5, 0);
  let elapsed = 0;
  let done = false;

  return {
    update(dt, t) {
      elapsed = t;
      let leader = racers[0];
      racers.forEach((r) => {
        const human = r.p.control === 'human';
        let throttle = 0;
        let steer = 0;
        if (human) {
          throttle = ctx.input.isDown(r.p.slot, 'up') ? 1 : 0;
          steer = (ctx.input.isDown(r.p.slot, 'right') ? 1 : 0) - (ctx.input.isDown(r.p.slot, 'left') ? 1 : 0);
        } else {
          throttle = 1;
          const ahead = obstacles.find(
            (o) => o.z < -r.dist + 6 && o.z > -r.dist - 26 && Math.abs(o.x - r.x) < 1.6,
          );
          if (ahead) steer = ahead.x > 0 ? -1 : 1;
          const skill = 0.55 + r.p.driver.stats.grip * 0.1;
          if (ctx.rand() > skill) steer = 0;
        }
        r.stun = Math.max(0, r.stun - dt);
        const maxSpeed = 26 + r.p.driver.stats.grip * 1.4;
        r.speed += (throttle ? 22 : -16) * dt;
        r.speed = Math.max(0, Math.min(maxSpeed * (r.stun > 0 ? 0.35 : 1), r.speed));
        r.x = Math.max(-8.5, Math.min(8.5, r.x + steer * dt * 12));
        if (r.finishedAt === 0) r.dist += r.speed * dt;
        if (r.dist >= FINISH && r.finishedAt === 0) r.finishedAt = t;

        obstacles.forEach((o) => {
          if (Math.abs(o.z + r.dist) < 1.6 && Math.abs(o.x - r.x) < 1.5 && r.stun <= 0) {
            r.stun = 0.9;
            r.speed *= 0.3;
          }
        });

        r.rig.group.position.set(r.x, 0, 10 - (r.dist % 1000));
        r.rig.group.rotation.y = Math.PI - steer * 0.15;
        r.rig.wheels.forEach((w) => (w.rotation.x -= dt * r.speed * 0.6));
        if (r.dist > leader.dist) leader = r;
      });

      // Track the leader from a low, cinematic chase angle.
      const target = leader.rig.group.position;
      ctx.camera.position.lerp(new THREE.Vector3(target.x * 0.4, 8.5, target.z + 22), 1 - Math.pow(0.001, dt));
      ctx.camera.lookAt(target.x * 0.3, 1.6, target.z - 8);
      obstacles.forEach((o) => {
        o.mesh.position.z = o.z + leader.dist;
      });
      done = racers.every((r) => r.finishedAt > 0) || elapsed > 30;
    },
    scores: () =>
      racers.map((r) => ({
        playerId: r.p.id,
        score: r.finishedAt > 0 ? 10000 - Math.round(r.finishedAt * 100) : Math.round(r.dist),
      })),
    finished: () => done,
    hud: () => `Acelerá y esquivá · meta a ${FINISH} m`,
    scoreLabel: (id) => {
      const r = racers.find((x) => x.p.id === id);
      return r ? `${Math.min(FINISH, Math.round(r.dist))} m` : '';
    },
  };
};

/** Esquivá el caos: no throttle, only survival while the street gets nastier. */
export const esquiva: MinigameFactory = (ctx): MinigameInstance => {
  const scene = ctx.scene;
  street(scene, 600);
  const racers = ctx.players.map((p, i) => {
    const rig = buildCar(p.driver.colors[0], p.driver.colors[1], p.driver.accent);
    rig.group.rotation.y = Math.PI;
    scene.add(rig.group);
    return { p, rig, x: LANE_X[i % 4], alive: true, survived: 0, dodges: 0 };
  });

  const hazards: { mesh: THREE.Mesh; x: number; z: number }[] = [];
  const geo = new THREE.BoxGeometry(2.6, 1.6, 2.6);
  const mat = new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.7 });
  let spawnTimer = 0;
  let speed = 34;
  let elapsed = 0;

  ctx.camera.position.set(0, 16, 30);

  return {
    update(dt, t) {
      elapsed = t;
      speed = 34 + t * 1.6;
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnTimer = Math.max(0.22, 0.75 - t * 0.02);
        const x = -8 + ctx.rand() * 16;
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, 0.8, -140);
        mesh.castShadow = true;
        scene.add(mesh);
        hazards.push({ mesh, x, z: -140 });
      }

      hazards.forEach((h) => {
        h.z += speed * dt;
        h.mesh.position.z = h.z;
        h.mesh.rotation.x += dt * 2;
      });
      for (let i = hazards.length - 1; i >= 0; i--) {
        if (hazards[i].z > 30) {
          scene.remove(hazards[i].mesh);
          hazards.splice(i, 1);
        }
      }

      racers.forEach((r) => {
        if (!r.alive) return;
        r.survived = t;
        let steer = 0;
        if (r.p.control === 'human') {
          steer = (ctx.input.isDown(r.p.slot, 'right') ? 1 : 0) - (ctx.input.isDown(r.p.slot, 'left') ? 1 : 0);
        } else {
          const threat = hazards
            .filter((h) => h.z > -40 && h.z < 4)
            .sort((a, b) => b.z - a.z)
            .find((h) => Math.abs(h.x - r.x) < 4);
          if (threat) steer = threat.x > r.x ? -1 : 1;
          if (ctx.rand() > 0.45 + r.p.driver.stats.reflex * 0.09) steer = 0;
        }
        r.x = Math.max(-9, Math.min(9, r.x + steer * dt * 16));
        r.rig.group.position.set(r.x, 0, 4);
        r.rig.group.rotation.z = -steer * 0.12;
        hazards.forEach((h) => {
          if (Math.abs(h.z - 4) < 2 && Math.abs(h.x - r.x) < 2.2 && r.alive) {
            r.alive = false;
            r.rig.group.rotation.x = -0.6;
          }
        });
      });
      ctx.camera.lookAt(0, 1.5, -10);
    },
    scores: () => racers.map((r) => ({ playerId: r.p.id, score: Math.round(r.survived * 100) })),
    finished: () => racers.every((r) => !r.alive) || elapsed > 28,
    hud: () => 'Sobreviví lo máximo posible',
    scoreLabel: (id) => {
      const r = racers.find((x) => x.p.id === id);
      return r ? `${r.survived.toFixed(1)} s${r.alive ? '' : ' 💥'}` : '';
    },
  };
};

/** Semáforo de largada: five lights, then pure reaction time. */
export const reflejos: MinigameFactory = (ctx): MinigameInstance => {
  const scene = ctx.scene;
  street(scene, 160);
  const lights: THREE.Mesh[] = [];
  const gantry = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 16, 12),
      new THREE.MeshStandardMaterial({ color: '#2a0a0a', emissive: new THREE.Color('#300'), emissiveIntensity: 0.2 }),
    );
    bulb.position.set(-6 + i * 3, 9, -22);
    gantry.add(bulb);
    lights.push(bulb);
  }
  scene.add(gantry);

  const racers = ctx.players.map((p, i) => {
    const rig = buildCar(p.driver.colors[0], p.driver.colors[1], p.driver.accent);
    rig.group.position.set(LANE_X[i % 4], 0, 6);
    rig.group.rotation.y = Math.PI;
    scene.add(rig.group);
    return { p, rig, reaction: 0, jumped: false, launched: 0, round: 0, total: 0 };
  });

  ctx.camera.position.set(0, 6, 22);
  ctx.camera.lookAt(0, 4, -10);

  let phase: 'arming' | 'lit' | 'go' | 'showing' = 'arming';
  let timer = 1.2;
  let litCount = 0;
  let goAt = 0;
  let rounds = 0;
  const TOTAL_ROUNDS = 3;

  const resetRound = () => {
    phase = 'arming';
    timer = 1.0;
    litCount = 0;
    lights.forEach((l) => {
      const m = l.material as THREE.MeshStandardMaterial;
      m.color.set('#2a0a0a');
      m.emissive.set('#300');
      m.emissiveIntensity = 0.2;
    });
    racers.forEach((r) => {
      r.jumped = false;
      r.launched = 0;
      r.rig.group.position.z = 6;
    });
  };

  return {
    update(dt, t) {
      timer -= dt;
      if (phase === 'arming' && timer <= 0) {
        phase = 'lit';
        timer = 0.55;
      } else if (phase === 'lit' && timer <= 0) {
        if (litCount < 5) {
          const m = lights[litCount].material as THREE.MeshStandardMaterial;
          m.color.set('#ff2200');
          m.emissive.set('#ff2200');
          m.emissiveIntensity = 2.4;
          litCount += 1;
          timer = 0.5;
        } else {
          phase = 'go';
          goAt = t;
          timer = 2.2;
          lights.forEach((l) => {
            const m = l.material as THREE.MeshStandardMaterial;
            m.color.set('#111');
            m.emissive.set('#000');
            m.emissiveIntensity = 0;
          });
        }
      } else if (phase === 'go' && timer <= 0) {
        racers.forEach((r) => {
          if (r.launched === 0) r.total += 0;
        });
        rounds += 1;
        phase = 'showing';
        timer = 1.2;
      } else if (phase === 'showing' && timer <= 0 && rounds < TOTAL_ROUNDS) {
        resetRound();
      }

      racers.forEach((r) => {
        if (r.launched > 0) {
          r.rig.group.position.z -= dt * 30;
          return;
        }
        const fire =
          r.p.control === 'human'
            ? ctx.input.justPressed(r.p.slot, 'action')
            : phase === 'go' && t - goAt > 0.16 + (5 - r.p.driver.stats.reflex) * 0.045 + ctx.rand() * 0.05;
        if (!fire) return;
        if (phase !== 'go') {
          if (!r.jumped) {
            r.jumped = true;
            r.total -= 200; // salida en falso
          }
          return;
        }
        r.launched = t;
        const reaction = t - goAt;
        r.reaction = reaction;
        r.total += Math.max(50, Math.round(1000 - reaction * 900));
      });
    },
    scores: () => racers.map((r) => ({ playerId: r.p.id, score: r.total })),
    finished: () => rounds >= TOTAL_ROUNDS && phase === 'showing' && timer <= 0,
    hud: () =>
      phase === 'go' ? '¡LARGÁ!' : phase === 'showing' ? 'Preparate…' : 'Esperá que se apaguen las luces',
    scoreLabel: (id) => {
      const r = racers.find((x) => x.p.id === id);
      if (!r) return '';
      return `${r.total} pts${r.reaction ? ` · ${(r.reaction * 1000).toFixed(0)} ms` : ''}`;
    },
  };
};

/** Duelo de pilotos: head to head quick draw, best of five. */
export const duelo: MinigameFactory = (ctx): MinigameInstance => {
  const scene = ctx.scene;
  street(scene, 120);
  const duelists = ctx.players.slice(0, 2).map((p, i) => {
    const rig = buildCar(p.driver.colors[0], p.driver.colors[1], p.driver.accent);
    rig.group.position.set(i === 0 ? -4 : 4, 0, 0);
    rig.group.rotation.y = Math.PI;
    scene.add(rig.group);
    return { p, rig, wins: 0, ready: false };
  });
  const rest = ctx.players.slice(2);

  ctx.camera.position.set(0, 7, 20);
  ctx.camera.lookAt(0, 1.5, -6);

  const target = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.45, 12, 28),
    new THREE.MeshStandardMaterial({ color: '#333', emissive: new THREE.Color('#111') }),
  );
  target.position.set(0, 6, -14);
  scene.add(target);

  let armed = false;
  let armAt = 0;
  let timer = 1 + ctx.rand() * 1.5;
  let round = 0;
  const ROUNDS = 5;

  return {
    update(dt, t) {
      timer -= dt;
      const mat = target.material as THREE.MeshStandardMaterial;
      if (!armed && timer <= 0) {
        armed = true;
        armAt = t;
        mat.color.set('#3ddc84');
        mat.emissive.set('#3ddc84');
        mat.emissiveIntensity = 2;
      }
      target.rotation.z += dt * (armed ? 6 : 1);

      duelists.forEach((d) => {
        if (d.ready) return;
        const fire =
          d.p.control === 'human'
            ? ctx.input.justPressed(d.p.slot, 'action')
            : armed && t - armAt > 0.18 + (5 - d.p.driver.stats.reflex) * 0.05 + ctx.rand() * 0.06;
        if (!fire) return;
        if (!armed) {
          d.wins -= 1;
          d.ready = true;
          return;
        }
        d.ready = true;
        if (!duelists.some((o) => o !== d && o.ready && o.wins > d.wins)) d.wins += 1;
      });

      if (armed && (duelists.every((d) => d.ready) || t - armAt > 2.2)) {
        round += 1;
        armed = false;
        timer = 1 + ctx.rand() * 1.4;
        mat.color.set('#333');
        mat.emissive.set('#111');
        duelists.forEach((d) => (d.ready = false));
      }
    },
    scores: () => [
      ...duelists.map((d) => ({ playerId: d.p.id, score: d.wins })),
      ...rest.map((p) => ({ playerId: p.id, score: -1 })),
    ],
    finished: () => round >= ROUNDS,
    hud: () => (armed ? '¡AHORA!' : 'Esperá el verde…'),
    scoreLabel: (id) => {
      const d = duelists.find((x) => x.p.id === id);
      return d ? `${d.wins} pts` : 'espectador';
    },
  };
};

export { baseScene };
