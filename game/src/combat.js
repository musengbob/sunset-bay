// Combat: the player's pistol (mouse aim, click to shoot, R to reload),
// armed enemy gunmen who shoot back, take cover when hurt and flee when
// nearly beaten, plus tracers, muzzle flashes and health / ammo state.
import * as THREE from 'three';
import { resolveBuildingCollision } from './city.js';

const MAG_SIZE = 12;
const ENEMY_COLORS = [0x8a2e2e, 0x5a2e6a, 0x2e4a2e, 0x6a4a1a];

function makeGunman(scene, color) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color });
  const skin = new THREE.MeshLambertMaterial({ color: 0x8a5a3a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x1c1c22 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.32), shirt);
  torso.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.32), skin);
  head.position.y = 1.6;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.36),
    new THREE.MeshLambertMaterial({ color: 0x14141a }));
  cap.position.y = 1.8;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.66, 0.26), pants);
  legL.position.set(-0.15, 0.33, 0);
  const legR = legL.clone();
  legR.position.x = 0.15;
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.55),
    new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.3, 1.25, 0.3);
  group.add(torso, head, cap, legL, legR, gun);
  scene.add(group);
  return { group, legL, legR, gun };
}

export function createCombat(scene, colliders) {
  const enemies = [];
  const tracers = [];
  const ammo = { mag: MAG_SIZE, reserve: 60 };
  let reloadTimer = 0;
  let shootCooldown = 0;
  let flash = null;
  let flashTimer = 0;

  function spawnEnemy(x, z) {
    const parts = makeGunman(scene, ENEMY_COLORS[enemies.length % ENEMY_COLORS.length]);
    parts.group.position.set(x, 0, z);
    const enemy = {
      ...parts, pos: parts.group.position, hp: 100,
      state: 'chase', shootTimer: 1 + Math.random() * 1.5,
      strafeDir: Math.random() < 0.5 ? 1 : -1, strafeTimer: 0, swing: Math.random() * 6,
    };
    enemies.push(enemy);
    return enemy;
  }

  function spawnSquad(cx, cz, count) {
    const made = [];
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2;
      made.push(spawnEnemy(cx + Math.cos(a) * (6 + i * 2), cz + Math.sin(a) * (6 + i * 2)));
    }
    return made;
  }

  // Tracers as thin glowing boxes (a 1 px THREE.Line does not read in a
  // screenshot); stretched from muzzle to impact point, fading fast.
  function addTracer(from, to, color = 0xffd23e) {
    const dir = to.clone().sub(from);
    const len = Math.max(0.5, dir.length());
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.09, len),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }),
    );
    mesh.position.copy(from).addScaledVector(dir, 0.5);
    mesh.lookAt(to);
    scene.add(mesh);
    tracers.push({ line: mesh, life: 0.6 });
  }

  function muzzleFlash(at) {
    if (!flash) {
      flash = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true }));
      scene.add(flash);
    }
    flash.position.copy(at);
    flash.visible = true;
    flashTimer = 0.06;
  }

  /** Fire the pistol from `origin` along `dir`. Returns the enemy hit, if any. */
  function shoot(origin, dir, onHit) {
    if (reloadTimer > 0 || shootCooldown > 0) return false;
    if (ammo.mag <= 0) { return 'empty'; }
    ammo.mag -= 1;
    shootCooldown = 0.22;
    const from = new THREE.Vector3(origin.x, (origin.y || 0) + 1.45, origin.z);
    const end = from.clone().addScaledVector(dir, 90);
    muzzleFlash(from.clone().addScaledVector(dir, 1.1));
    let best = null;
    let bestT = 90;
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const toE = new THREE.Vector3(e.pos.x - from.x, 1.3 - from.y, e.pos.z - from.z);
      const t = toE.dot(dir);
      if (t < 0.5 || t > bestT) continue;
      const closest = from.clone().addScaledVector(dir, t);
      const miss = Math.hypot(closest.x - e.pos.x, closest.z - e.pos.z, closest.y - 1.3);
      if (miss < 1.4) { best = e; bestT = t; }
    }
    if (best) {
      best.hp -= 34 + Math.floor(Math.random() * 12);
      end.copy(new THREE.Vector3(best.pos.x, 1.3, best.pos.z));
      if (best.hp <= 0) {
        best.state = 'dead';
        best.group.rotation.x = -Math.PI / 2;
        best.group.position.y = 0.3;
      } else if (best.hp < 30) {
        best.state = 'flee';
      } else {
        best.state = 'cover';
        best.strafeTimer = 1.5;
      }
      if (onHit) onHit(best);
    }
    addTracer(from, end);
    return best;
  }

  function startReload() {
    if (reloadTimer > 0 || ammo.mag >= MAG_SIZE || ammo.reserve <= 0) return false;
    reloadTimer = 1.1;
    return true;
  }

  function enemiesAlive() {
    return enemies.filter((e) => e.hp > 0).length;
  }

  /** Advance enemies: chase, strafe for cover, flee when nearly beaten,
   *  and shoot back. Calls onPlayerHit(damage) when a shot lands. */
  function update(dt, playerPos, inCar, onPlayerHit) {
    shootCooldown = Math.max(0, shootCooldown - dt);
    if (reloadTimer > 0) {
      reloadTimer -= dt;
      if (reloadTimer <= 0) {
        const need = MAG_SIZE - ammo.mag;
        const take = Math.min(need, ammo.reserve);
        ammo.mag += take;
        ammo.reserve -= take;
      }
    }
    if (flashTimer > 0) {
      flashTimer -= dt;
      if (flashTimer <= 0 && flash) flash.visible = false;
    }
    for (let i = tracers.length - 1; i >= 0; i -= 1) {
      const t = tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.6);
      if (t.life <= 0) {
        scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        tracers.splice(i, 1);
      }
    }
    if (!playerPos) return;
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const dx = playerPos.x - e.pos.x;
      const dz = playerPos.z - e.pos.z;
      const dist = Math.hypot(dx, dz);
      e.group.rotation.y = Math.atan2(dx, dz);
      e.swing += dt * 8;
      e.legL.rotation.x = Math.sin(e.swing) * 0.5;
      e.legR.rotation.x = -Math.sin(e.swing) * 0.5;
      let mx = 0;
      let mz = 0;
      if (e.state === 'flee') {
        mx = -dx / (dist || 1);
        mz = -dz / (dist || 1);
      } else if (e.state === 'cover') {
        e.strafeTimer -= dt;
        mx = (-dz / (dist || 1)) * e.strafeDir;
        mz = (dx / (dist || 1)) * e.strafeDir;
        if (e.strafeTimer <= 0) { e.state = 'chase'; e.strafeDir *= -1; }
      } else if (dist > 16) {
        mx = dx / dist;
        mz = dz / dist;
      } else if (dist < 7) {
        mx = -dx / dist;
        mz = -dz / dist;
      }
      const speed = e.state === 'flee' ? 6.5 : 4.2;
      e.pos.x += mx * speed * dt;
      e.pos.z += mz * speed * dt;
      resolveBuildingCollision(e.pos, 0.55, colliders);
      // Shoot back when in range and roughly facing the player.
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && dist < 34 && dist > 2) {
        e.shootTimer = 1.3 + Math.random() * 1.1;
        const from = new THREE.Vector3(e.pos.x, 1.35, e.pos.z);
        const spread = 0.12 + (inCar ? 0.1 : 0);
        const aim = new THREE.Vector3(
          dx / dist + (Math.random() - 0.5) * spread,
          (1.3 - 1.35) / dist,
          dz / dist + (Math.random() - 0.5) * spread,
        ).normalize();
        const hitChance = dist < 14 ? 0.5 : dist < 24 ? 0.32 : 0.18;
        const end = from.clone().addScaledVector(aim, dist);
        addTracer(from, end, 0xff5a3c);
        if (Math.random() < hitChance && onPlayerHit) onPlayerHit(5 + Math.floor(Math.random() * 6));
      }
    }
  }

  /** Stage a firefight for a screenshot: gunmen ahead, player aiming at them. */
  function stageFight(playerPos) {
    spawnSquad(playerPos.x + 10, playerPos.z - 14, 3);
    ammo.mag = 9;
    ammo.reserve = 48;
  }

  return {
    enemies, ammo, shoot, startReload, update, spawnEnemy, spawnSquad,
    enemiesAlive, stageFight,
    get reloading() { return reloadTimer > 0; },
  };
}
