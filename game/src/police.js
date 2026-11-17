// Police escalation: wanted tiers scale the SBPD response — extra
// cruisers at 2 stars, roadblocks at 3, a searchlight helicopter at 4,
// and a full-speed pursuit at 5. All meshes and lights are built here.
import * as THREE from 'three';
import { buildCarMesh } from './vehicles.js';
import { WORLD_HALF } from './city.js';

const POLICE_DEF = { name: 'SBPD Cruiser', color: 0x1a1a22, topSpeed: 30, accel: 16, len: 4.4, wid: 1.9 };

function makeCruiser(scene) {
  const { group } = buildCarMesh(POLICE_DEF);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4),
    new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xcc0000, emissiveIntensity: 1.2 }));
  bar.position.set(0, 1.55, -0.1);
  group.add(bar);
  const barB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x0022cc, emissiveIntensity: 1.2 }));
  barB.position.set(0.6, 1.55, -0.1);
  group.add(barB);
  scene.add(group);
  return { group, bar, barB, pos: group.position, heading: 0, speed: 8, flash: Math.random() * 6 };
}

function makeRoadblock(scene) {
  const group = new THREE.Group();
  const stripe = new THREE.MeshLambertMaterial({ color: 0xffd23e });
  const dark = new THREE.MeshLambertMaterial({ color: 0x222222 });
  for (let i = -1; i <= 1; i += 1) {
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.0, 0.5), i % 2 === 0 ? stripe : dark);
    barrier.position.set(i * 3.6, 0.7, 0);
    group.add(barrier);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.4), dark);
    leg.position.set(i * 3.6, 0.35, 0);
    group.add(leg);
  }
  for (let i = -1; i <= 1; i += 1) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.0, 8),
      new THREE.MeshLambertMaterial({ color: 0xff5a2e, emissive: 0x662200, emissiveIntensity: 0.5 }));
    cone.position.set(i * 3.6, 0.5, 3.2);
    group.add(cone);
  }
  scene.add(group);
  return group;
}

function makeHelicopter(scene) {
  const group = new THREE.Group();
  // Bright white-blue airframe so the chopper reads against the sky.
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xdde6ee });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 4.6), bodyMat);
  group.add(body);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 1.4),
    new THREE.MeshLambertMaterial({ color: 0x9fd4ff, emissive: 0x224466, emissiveIntensity: 0.4 }));
  glass.position.set(0, 0.2, 1.8);
  group.add(glass);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.2), bodyMat);
  tail.position.set(0, 0.3, -4.0);
  group.add(tail);
  const rotor = new THREE.Group();
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.5), bladeMat);
    blade.rotation.y = a;
    rotor.add(blade);
  }
  rotor.position.y = 1.0;
  group.add(rotor);
  // Searchlight cone + spotlight aimed at the player below.
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(8, 14, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }),
  );
  cone.position.y = -7;
  cone.rotation.x = Math.PI;
  group.add(cone);
  const light = new THREE.SpotLight(0xfff2b0, 60, 60, 0.32, 0.5, 1.2);
  light.position.set(0, -0.5, 0);
  group.add(light);
  const lightTarget = new THREE.Object3D();
  lightTarget.position.set(0, -26, 0);
  group.add(lightTarget);
  light.target = lightTarget;
  group.visible = false;
  scene.add(group);
  return { group, rotor, light, cone };
}

export function createPolice(scene) {
  const extraCruisers = [];
  for (let i = 0; i < 4; i += 1) {
    const c = makeCruiser(scene);
    c.pos.set(-140 + i * 60, 0, -140 + i * 30);
    c.group.visible = false;
    extraCruisers.push(c);
  }
  const roadblocks = [makeRoadblock(scene), makeRoadblock(scene)];
  for (const r of roadblocks) r.visible = false;
  const heli = makeHelicopter(scene);
  let heliAngle = 0;
  let blockTimer = 0;
  let blockPlaced = false;

  function placeRoadblocks(playerPos, heading) {
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    for (let i = 0; i < roadblocks.length; i += 1) {
      const ahead = 26 + i * 20;
      roadblocks[i].position.set(
        THREE.MathUtils.clamp(playerPos.x + fx * ahead, -WORLD_HALF, WORLD_HALF),
        0,
        THREE.MathUtils.clamp(playerPos.z + fz * ahead, -WORLD_HALF, WORLD_HALF),
      );
      roadblocks[i].rotation.y = heading + Math.PI / 2;
      roadblocks[i].visible = true;
    }
    blockPlaced = true;
  }

  /** Scale the response to the wanted level. Returns { busted, heliActive }. */
  function update(dt, playerPos, wanted, inCar, carSpeed, heading) {
    let busted = false;
    if (!playerPos) {
      heli.group.visible = false;
      for (const r of roadblocks) r.visible = false;
      return { busted: false, heliActive: false };
    }
    // Extra cruisers: 1 at 2 stars, 2 at 3, 3 at 4, all 4 at 5 stars.
    const wantCruisers = wanted >= 2 ? Math.min(4, wanted - 1) : 0;
    for (let i = 0; i < extraCruisers.length; i += 1) {
      const cop = extraCruisers[i];
      const active = i < wantCruisers;
      cop.group.visible = active;
      if (!active) continue;
      cop.flash += dt * 10;
      const f = Math.sin(cop.flash) > 0;
      cop.bar.material.emissive.setHex(f ? 0xff0000 : 0x330000);
      cop.barB.material.emissive.setHex(f ? 0x0022cc : 0x000033);
      const dx = playerPos.x - cop.pos.x;
      const dz = playerPos.z - cop.pos.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      let diff = wantHeading - cop.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cop.heading += THREE.MathUtils.clamp(diff, -2.0 * dt, 2.0 * dt);
      const target = Math.min(14 + wanted * 4.5, 30);
      cop.speed += (target - cop.speed) * Math.min(1, dt * 0.9);
      cop.pos.x += Math.sin(cop.heading) * cop.speed * dt;
      cop.pos.z += Math.cos(cop.heading) * cop.speed * dt;
      cop.group.rotation.y = cop.heading;
      if (dist < 3.2 && !inCar) busted = true;
      if (dist < 4.2 && inCar && Math.abs(carSpeed) < 3) busted = true;
    }
    // Roadblocks from 3 stars: re-place ahead of the player every 14 s.
    if (wanted >= 3) {
      blockTimer -= dt;
      if (!blockPlaced || blockTimer <= 0) {
        placeRoadblocks(playerPos, heading || 0);
        blockTimer = 14;
      }
    } else {
      for (const r of roadblocks) r.visible = false;
      blockPlaced = false;
    }
    // Helicopter from 4 stars: orbits the player, searchlight pinned on them.
    const heliActive = wanted >= 4;
    heli.group.visible = heliActive;
    if (heliActive) {
      heliAngle += dt * 0.45;
      heli.group.position.set(
        playerPos.x + Math.cos(heliAngle) * 15,
        13,
        playerPos.z + Math.sin(heliAngle) * 15,
      );
      heli.group.lookAt(playerPos.x, 0, playerPos.z);
      heli.rotor.rotation.y += dt * 22;
    }
    return { busted, heliActive };
  }

  /** Stage a full 4-star pursuit for a screenshot: heli above, cruisers
   *  behind, a roadblock ahead on the road. */
  function stagePursuit(playerPos, heading) {
    // Extra cruisers staged head-on ahead of the player (staggered across
    // the road), so they are inside the chase camera's frame, not behind it.
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    for (let i = 0; i < extraCruisers.length; i += 1) {
      const cop = extraCruisers[i];
      const ahead = 20 + i * 9;
      const lat = i % 2 === 0 ? 5 : -5;
      cop.pos.set(playerPos.x + fx * ahead - fz * lat, 0, playerPos.z + fz * ahead + fx * lat);
      cop.heading = heading + Math.PI;
      cop.speed = 20;
      cop.group.visible = true;
      cop.group.position.copy(cop.pos);
      cop.group.rotation.y = cop.heading;
    }
    placeRoadblocks(playerPos, heading);
    blockTimer = 14;
    // Orbit angle parked ahead-north of the player so the chopper is inside
    // the chase camera's frame (it orbits slowly from there).
    heliAngle = -1.2;
    heli.group.position.set(
      playerPos.x + Math.cos(heliAngle) * 15, 13,
      playerPos.z + Math.sin(heliAngle) * 15,
    );
    heli.group.visible = true;
  }

  return {
    update, stagePursuit,
    get extraPolice() { return extraCruisers.filter((c) => c.group.visible); },
    get heliPos() { return heli.group.visible ? heli.group.position : null; },
    get roadblockPos() { return roadblocks.filter((r) => r.visible).map((r) => r.position); },
  };
}
