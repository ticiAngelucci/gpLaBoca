import * as THREE from 'three';
import { buildCar } from '../three/car';
import { grassTexture, standTexture } from '../three/textures';
import type { MinigameCtx, MinigameFactory, MinigameInstance } from './framework';

/** Compact version of the stadium bowl used by the pitch minigames. */
function bowl(scene: THREE.Scene) {
  const pitch = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 100),
    new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 0.95 }),
  );
  pitch.rotation.x = -Math.PI / 2;
  pitch.receiveShadow = true;
  scene.add(pitch);

  const standMat = new THREE.MeshStandardMaterial({ map: standTexture(), roughness: 0.9 });
  [-1, 1].forEach((s) => {
    for (let tier = 0; tier < 3; tier++) {
      const stand = new THREE.Mesh(new THREE.BoxGeometry(16, 10, 104), standMat);
      stand.position.set(s * (44 + tier * 6), tier * 9 + 5, 0);
      stand.rotation.z = s * -0.18;
      scene.add(stand);
      const end = new THREE.Mesh(new THREE.BoxGeometry(104, 10, 16), standMat);
      end.position.set(0, tier * 9 + 5, s * (58 + tier * 6));
      end.rotation.x = s * 0.18;
      scene.add(end);
    }
  });

  [[-40, -54], [40, -54], [-40, 54], [40, 54]].forEach(([x, z]) => {
    const light = new THREE.SpotLight('#fff6de', 2600, 220, Math.PI / 4.5, 0.6, 1.2);
    light.position.set(x, 48, z);
    light.target.position.set(0, 0, 0);
    light.castShadow = true;
    scene.add(light);
    scene.add(light.target);
  });
}

/** Tiro al arco: aim with left/right, shoot with the action key. */
export const penales: MinigameFactory = (ctx: MinigameCtx): MinigameInstance => {
  const scene = ctx.scene;
  bowl(scene);

  const goal = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: '#f5f5f5', roughness: 0.4 });
  [-9, 9].forEach((x) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 8, 12), postMat);
    post.position.set(x, 4, 0);
    goal.add(post);
  });
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 18.5, 12), postMat);
  bar.rotation.z = Math.PI / 2;
  bar.position.y = 8;
  goal.add(bar);
  const net = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 8),
    new THREE.MeshStandardMaterial({ color: '#dfe6f2', transparent: true, opacity: 0.25, side: THREE.DoubleSide }),
  );
  net.position.set(0, 4, -2.4);
  goal.add(net);
  goal.position.set(0, 0, -34);
  scene.add(goal);

  const keeper = new THREE.Mesh(
    new THREE.CapsuleGeometry(1.1, 2.6, 6, 12),
    new THREE.MeshStandardMaterial({ color: '#25c17a', roughness: 0.6 }),
  );
  keeper.position.set(0, 2.4, -33);
  keeper.castShadow = true;
  scene.add(keeper);

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 20, 14),
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }),
  );
  ball.castShadow = true;
  scene.add(ball);

  const shooters = ctx.players.map((p, i) => {
    const rig = buildCar(p.driver.colors[0], p.driver.colors[1], p.driver.accent);
    rig.group.position.set(-18 + i * 12, 0, 12);
    rig.group.rotation.y = Math.PI;
    scene.add(rig.group);
    return { p, rig, goals: 0, shots: 0 };
  });

  const aim = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 1.1, 20),
    new THREE.MeshBasicMaterial({ color: '#ffd400', side: THREE.DoubleSide }),
  );
  aim.position.set(0, 4, -31);
  scene.add(aim);

  ctx.camera.position.set(0, 9, 22);
  ctx.camera.lookAt(0, 4, -30);

  let turn = 0;
  let aimX = 0;
  let aimDir = 1;
  let state: 'aim' | 'shot' | 'result' = 'aim';
  let timer = 0;
  let ballVel = new THREE.Vector3();
  let lastResult = '';
  let round = 0;
  const ROUNDS = 2;

  const resetShot = () => {
    state = 'aim';
    timer = 0;
    ball.position.set(0, 0.9, -12);
    aimDir = ctx.rand() > 0.5 ? 1 : -1;
    keeper.position.x = 0;
    keeper.rotation.z = 0;
  };
  resetShot();

  return {
    update(dt, t) {
      const shooter = shooters[turn];
      if (state === 'aim') {
        aimX += aimDir * dt * 11;
        if (Math.abs(aimX) > 8.5) aimDir *= -1;
        aim.position.x = aimX;
        timer += dt;
        const fire =
          shooter.p.control === 'human'
            ? ctx.input.justPressed(shooter.p.slot, 'action')
            : timer > 0.6 + ctx.rand() * 0.5 &&
              Math.abs(Math.abs(aimX) - (5 + shooter.p.driver.stats.reflex * 0.4)) < 1.6;
        if (fire || timer > 5) {
          state = 'shot';
          shooter.shots += 1;
          const keeperGuess = (ctx.rand() > 0.5 ? 1 : -1) * (3 + ctx.rand() * 5);
          keeper.userData.guess = keeperGuess;
          ballVel = new THREE.Vector3(aimX * 1.6, 3.4, -46);
          timer = 0;
        }
      } else if (state === 'shot') {
        timer += dt;
        ball.position.addScaledVector(ballVel, dt);
        ball.rotation.x -= dt * 14;
        keeper.position.x += ((keeper.userData.guess as number) - keeper.position.x) * dt * 6;
        keeper.rotation.z = -keeper.position.x * 0.07;
        const saved = Math.abs(keeper.position.x - ball.position.x) < 2.4 && ball.position.z < -28;
        if (ball.position.z <= -33) {
          const onTarget = Math.abs(ball.position.x) < 8.6;
          if (onTarget && !saved) {
            shooter.goals += 1;
            lastResult = `⚽ ¡GOL de ${shooter.p.name}!`;
          } else {
            lastResult = saved ? `🧤 Atajó el arquero a ${shooter.p.name}` : `❌ ${shooter.p.name} la mandó afuera`;
          }
          state = 'result';
          timer = 0;
        }
      } else {
        timer += dt;
        if (timer > 1.1) {
          turn += 1;
          if (turn >= shooters.length) {
            turn = 0;
            round += 1;
          }
          resetShot();
        }
      }
      // Camera swings behind whoever is shooting.
      const target = shooters[turn].rig.group.position;
      ctx.camera.position.lerp(new THREE.Vector3(target.x * 0.5, 9, 22), 1 - Math.pow(0.004, dt));
      ctx.camera.lookAt(ball.position.x * 0.4, 4, -30);
      void t;
    },
    scores: () => shooters.map((s) => ({ playerId: s.p.id, score: s.goals })),
    finished: () => round >= ROUNDS,
    hud: () =>
      state === 'result' ? lastResult : `Patea ${shooters[turn].p.name} · apretá acción para disparar`,
    scoreLabel: (id) => {
      const s = shooters.find((x) => x.p.id === id);
      return s ? `${s.goals}/${s.shots} goles` : '';
    },
  };
};

/** Vuelta en la cancha: drive on the grass and grab the flags. */
export const cancha: MinigameFactory = (ctx): MinigameInstance => {
  const scene = ctx.scene;
  bowl(scene);

  const racers = ctx.players.map((p, i) => {
    const rig = buildCar(p.driver.colors[0], p.driver.colors[1], p.driver.accent);
    rig.group.position.set(-15 + i * 10, 0, 30);
    scene.add(rig.group);
    return { p, rig, angle: Math.PI, speed: 0, picked: 0 };
  });

  interface Flag {
    mesh: THREE.Group;
    taken: boolean;
  }
  const flags: Flag[] = [];
  for (let i = 0; i < 26; i++) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 3, 8),
      new THREE.MeshStandardMaterial({ color: '#dddddd' }),
    );
    pole.position.y = 1.5;
    g.add(pole);
    const cloth = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.1),
      new THREE.MeshStandardMaterial({
        color: i % 2 ? '#f2c500' : '#1b4fa8',
        side: THREE.DoubleSide,
        emissive: new THREE.Color(i % 2 ? '#8a7000' : '#0d2a5c'),
        emissiveIntensity: 0.5,
      }),
    );
    cloth.position.set(0.8, 2.4, 0);
    g.add(cloth);
    g.position.set((ctx.rand() - 0.5) * 58, 0, (ctx.rand() - 0.5) * 84);
    scene.add(g);
    flags.push({ mesh: g, taken: false });
  }

  ctx.camera.position.set(0, 46, 52);
  ctx.camera.lookAt(0, 0, 0);
  let elapsed = 0;

  return {
    update(dt, t) {
      elapsed = t;
      racers.forEach((r) => {
        let throttle = 0;
        let steer = 0;
        if (r.p.control === 'human') {
          throttle = (ctx.input.isDown(r.p.slot, 'up') ? 1 : 0) - (ctx.input.isDown(r.p.slot, 'down') ? 0.6 : 0);
          steer = (ctx.input.isDown(r.p.slot, 'left') ? 1 : 0) - (ctx.input.isDown(r.p.slot, 'right') ? 1 : 0);
        } else {
          const goal = flags
            .filter((f) => !f.taken)
            .sort(
              (a, b) =>
                a.mesh.position.distanceTo(r.rig.group.position) -
                b.mesh.position.distanceTo(r.rig.group.position),
            )[0];
          if (goal) {
            const dir = goal.mesh.position.clone().sub(r.rig.group.position);
            const want = Math.atan2(dir.x, dir.z);
            let diff = want - r.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            steer = Math.max(-1, Math.min(1, diff * 2));
            throttle = 1;
          }
        }
        const top = 20 + r.p.driver.stats.grip * 1.6;
        r.speed += (throttle * 26 - r.speed * 0.9) * dt;
        r.speed = Math.max(-8, Math.min(top, r.speed));
        r.angle += steer * dt * 1.9 * Math.min(1, Math.abs(r.speed) / 6);
        r.rig.group.position.x += Math.sin(r.angle) * r.speed * dt;
        r.rig.group.position.z += Math.cos(r.angle) * r.speed * dt;
        r.rig.group.position.x = Math.max(-33, Math.min(33, r.rig.group.position.x));
        r.rig.group.position.z = Math.max(-48, Math.min(48, r.rig.group.position.z));
        r.rig.group.rotation.y = r.angle;
        r.rig.wheels.forEach((w) => (w.rotation.x -= dt * r.speed * 0.8));

        flags.forEach((f) => {
          if (f.taken) return;
          if (f.mesh.position.distanceTo(r.rig.group.position) < 3.2) {
            f.taken = true;
            f.mesh.visible = false;
            r.picked += 1;
          }
        });
      });
      flags.forEach((f, i) => {
        if (!f.taken) f.mesh.rotation.y = t * 1.5 + i;
      });
    },
    scores: () => racers.map((r) => ({ playerId: r.p.id, score: r.picked })),
    finished: () => flags.every((f) => f.taken) || elapsed > 30,
    hud: () => 'Juntá banderines sobre el césped',
    scoreLabel: (id) => {
      const r = racers.find((x) => x.p.id === id);
      return r ? `${r.picked} banderines` : '';
    },
  };
};

/** Parada en boxes: stop the sweeping needle inside the green window, four times. */
export const boxes: MinigameFactory = (ctx): MinigameInstance => {
  const scene = ctx.scene;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: '#2b2f38', roughness: 0.8 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const garage = new THREE.Mesh(
    new THREE.BoxGeometry(60, 12, 2),
    new THREE.MeshStandardMaterial({ color: '#12161f', roughness: 0.7 }),
  );
  garage.position.set(0, 6, -16);
  scene.add(garage);

  const crews = ctx.players.map((p, i) => {
    const rig = buildCar(p.driver.colors[0], p.driver.colors[1], p.driver.accent);
    rig.group.position.set(-16.5 + i * 11, 0, 4);
    rig.group.rotation.y = Math.PI * 0.5;
    scene.add(rig.group);

    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.7, 0.4),
      new THREE.MeshStandardMaterial({ color: '#1b1f2a' }),
    );
    bar.position.set(-16.5 + i * 11, 6.5, 2);
    scene.add(bar);
    const zone = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.9, 0.5),
      new THREE.MeshStandardMaterial({ color: '#3ddc84', emissive: new THREE.Color('#3ddc84'), emissiveIntensity: 1 }),
    );
    zone.position.copy(bar.position);
    zone.position.z = 2.1;
    scene.add(zone);
    const needle = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 1.3, 0.6),
      new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.8 }),
    );
    needle.position.copy(bar.position);
    needle.position.z = 2.3;
    scene.add(needle);

    return {
      p,
      rig,
      bar,
      zone,
      needle,
      pos: 0,
      dir: 1,
      tyres: 0,
      penalty: 0,
      done: false,
      zoneX: (ctx.rand() - 0.5) * 5,
    };
  });

  ctx.camera.position.set(0, 10, 26);
  ctx.camera.lookAt(0, 4, 0);
  let elapsed = 0;

  return {
    update(dt, t) {
      elapsed = t;
      crews.forEach((c) => {
        if (c.done) return;
        const speed = 7 + c.tyres * 1.6;
        c.pos += c.dir * dt * speed;
        if (Math.abs(c.pos) > 3.9) {
          c.pos = Math.sign(c.pos) * 3.9;
          c.dir *= -1;
        }
        c.needle.position.x = c.bar.position.x + c.pos;
        c.zone.position.x = c.bar.position.x + c.zoneX;

        const hit = Math.abs(c.pos - c.zoneX) < 0.95;
        const fire =
          c.p.control === 'human'
            ? ctx.input.justPressed(c.p.slot, 'action')
            : hit && ctx.rand() < 0.12 + c.p.driver.stats.reflex * 0.035;
        if (!fire) return;
        if (hit) {
          c.tyres += 1;
          c.zoneX = (ctx.rand() - 0.5) * 5.4;
          c.rig.group.position.y = 0.6;
          if (c.tyres >= 4) {
            c.done = true;
            c.rig.group.position.y = 0;
            (c.zone.material as THREE.MeshStandardMaterial).color.set('#ffd400');
          }
        } else {
          c.penalty += 1;
        }
      });
      crews.forEach((c) => {
        if (!c.done && c.rig.group.position.y > 0) c.rig.group.position.y -= dt * 0.8;
      });
    },
    scores: () =>
      crews.map((c) => ({
        playerId: c.p.id,
        score: c.tyres * 1000 - c.penalty * 120 - (c.done ? 0 : 500),
      })),
    finished: () => crews.every((c) => c.done) || elapsed > 26,
    hud: () => 'Frená la aguja en la zona verde · 4 neumáticos',
    scoreLabel: (id) => {
      const c = crews.find((x) => x.p.id === id);
      return c ? `${c.tyres}/4 gomas${c.penalty ? ` · ${c.penalty} fallos` : ''}` : '';
    },
  };
};
