// Street life: traffic cars that follow the road lanes, pedestrians on the
// sidewalks, and Sunset Bay PD cruisers that patrol — and chase when wanted.
import * as THREE from 'three';
import { buildCarMesh } from './vehicles.js';
import { randomRoadPoint, streetLines, WORLD_HALF } from './city.js';

const MAX_TRAFFIC = 10;
const MAX_PEDS = 14;
const POLICE_DEF = { name: 'SBPD Cruiser', color: 0x1a1a22, topSpeed: 30, accel: 16, len: 4.4, wid: 1.9 };
const PED_COLORS = [0xd95f4a, 0x4a7ad9, 0x6ab04a, 0xd9a44a, 0x9a5fd9, 0x4ad9c2, 0xd94a8a, 0x8a6a4a];

function makePedestrian(scene, color) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color });
  const skin = new THREE.MeshLambertMaterial({ color: [0xc98a5e, 0x8a5a3a, 0xe8b890][Math.floor(Math.random() * 3)] });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a3242 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.3), shirt);
  torso.position.y = 1.0;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.3), skin);
  head.position.y = 1.52;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.24), pants);
  legL.position.set(-0.14, 0.31, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  group.add(torso, head, legL, legR);
  scene.add(group);
  return { group, legL, legR, swing: Math.random() * 6 };
}

export function createTraffic(scene, seed = 23) {
  let s = seed >>> 0;
  const random = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const lines = streetLines();
  const traffic = [];
  const peds = [];
  const police = [];

  function randomLaneCar() {
    const p = randomRoadPoint(random);
    const dir = p.horizontal ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    return { x: p.x, z: p.z, heading: dir, speed: 7 + random() * 4, horizontal: p.horizontal };
  }

  const TRAFFIC_COLORS = [0xc23b2e, 0x2e6ac2, 0xe8e4da, 0x3a3a3a, 0x7a4a9a, 0xd97a2e, 0x4a8a5a];
  for (let i = 0; i < MAX_TRAFFIC; i += 1) {
    const lane = randomLaneCar();
    const def = { name: 'Traffic Car', color: TRAFFIC_COLORS[i % TRAFFIC_COLORS.length], topSpeed: 12, accel: 10, len: 4.4, wid: 1.9 };
    const { group } = buildCarMesh(def);
    group.position.set(lane.x, 0, lane.z);
    group.rotation.y = lane.heading;
    scene.add(group);
    traffic.push({ def, group, pos: group.position, heading: lane.heading, speed: lane.speed, cruise: lane.speed });
  }

  // Two SBPD cruisers: black-and-white, light bar on top.
  for (let i = 0; i < 2; i += 1) {
    const lane = randomLaneCar();
    const { group } = buildCarMesh(POLICE_DEF);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xcc0000, emissiveIntensity: 1.2 }));
    bar.position.set(0, 1.55, -0.1);
    group.add(bar);
    const barB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x0022cc, emissiveIntensity: 1.2 }));
    barB.position.set(0.6, 1.55, -0.1);
    group.add(barB);
    group.position.set(lane.x, 0, lane.z);
    group.rotation.y = lane.heading;
    scene.add(group);
    police.push({ group, bar, barB, pos: group.position, heading: lane.heading, speed: 8, chasing: false, flash: 0 });
  }

  for (let i = 0; i < MAX_PEDS; i += 1) {
    const p = randomRoadPoint(random);
    const ped = makePedestrian(scene, PED_COLORS[i % PED_COLORS.length]);
    const horizontal = random() < 0.5;
    const line = lines[Math.floor(random() * lines.length)];
    const x = horizontal ? -150 + random() * 300 : line + 5.5;
    const z = horizontal ? line + 5.5 : -150 + random() * 300;
    ped.group.position.set(x, 0, z);
    peds.push({ ...ped, horizontal, dir: random() < 0.5 ? 1 : -1, speed: 1.1 + random() * 0.9 });
  }

  function driveLane(car, dt) {
    // Move along the current heading; at the city edge, turn onto a cross street.
    car.pos.x += Math.sin(car.heading) * car.speed * dt;
    car.pos.z += Math.cos(car.heading) * car.speed * dt;
    car.group.rotation.y = car.heading;
    const edge = WORLD_HALF - 4;
    if (Math.abs(car.pos.x) > edge || Math.abs(car.pos.z) > edge) {
      car.heading += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
      car.pos.x = THREE.MathUtils.clamp(car.pos.x, -edge, edge);
      car.pos.z = THREE.MathUtils.clamp(car.pos.z, -edge, edge);
    } else if (Math.random() < dt * 0.06) {
      // Occasionally turn at an intersection.
      car.heading += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
    }
  }

  /** Advance traffic, peds and police. Returns { busted: boolean } when a
   *  cruiser catches the player on foot at wanted level 1+. */
  function update(dt, playerPos, inCar, wanted, carSpeed) {
    for (const car of traffic) {
      car.speed += (car.cruise - car.speed) * Math.min(1, dt);
      driveLane(car, dt);
    }
    for (const ped of peds) {
      ped.swing += dt * 7;
      const step = ped.speed * ped.dir * dt;
      if (ped.horizontal) {
        ped.group.position.x += step;
        ped.group.rotation.y = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        if (Math.abs(ped.group.position.x) > 172) ped.dir *= -1;
      } else {
        ped.group.position.z += step;
        ped.group.rotation.y = ped.dir > 0 ? 0 : Math.PI;
        if (Math.abs(ped.group.position.z) > 172) ped.dir *= -1;
      }
      const sw = Math.sin(ped.swing);
      ped.legL.rotation.x = sw * 0.6;
      ped.legR.rotation.x = -sw * 0.6;
    }
    let busted = false;
    for (const cop of police) {
      cop.flash += dt * 10;
      const f = Math.sin(cop.flash) > 0;
      cop.bar.material.emissive.setHex(f ? 0xff0000 : 0x330000);
      cop.barB.material.emissive.setHex(f ? 0x0022cc : 0x000033);
      cop.chasing = wanted > 0;
      if (cop.chasing && playerPos) {
        const dx = playerPos.x - cop.pos.x;
        const dz = playerPos.z - cop.pos.z;
        const dist = Math.hypot(dx, dz);
        const wantHeading = Math.atan2(dx, dz);
        let diff = wantHeading - cop.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        cop.heading += THREE.MathUtils.clamp(diff, -1.8 * dt, 1.8 * dt);
        const target = Math.min(13 + wanted * 4, 26);
        cop.speed += (target - cop.speed) * Math.min(1, dt * 0.8);
        cop.pos.x += Math.sin(cop.heading) * cop.speed * dt;
        cop.pos.z += Math.cos(cop.heading) * cop.speed * dt;
        cop.group.rotation.y = cop.heading;
        if (dist < 3.2 && !inCar) busted = true;
        if (dist < 4.2 && inCar && Math.abs(carSpeed) < 3) busted = true;
      } else {
        cop.speed += (9 - cop.speed) * Math.min(1, dt);
        driveLane(cop, dt);
      }
    }
    return { busted };
  }

  /** Place a cruiser right behind the player for a staged chase screenshot. */
  function stageChase(playerPos, heading) {
    for (let i = 0; i < police.length; i += 1) {
      const cop = police[i];
      const back = 10 + i * 7;
      cop.pos.set(playerPos.x - Math.sin(heading) * back, 0, playerPos.z - Math.cos(heading) * back);
      cop.heading = heading;
      cop.speed = 20;
      cop.group.position.copy(cop.pos);
      cop.group.rotation.y = heading;
    }
  }

  /** Scatter traffic and peds around a point so a street reads as busy. */
  function stageBusy(cx, cz) {
    for (let i = 0; i < traffic.length; i += 1) {
      const car = traffic[i];
      const lane = (i % 2 === 0) ? cz : cx;
      car.pos.set(cx - 40 + i * 11, 0, cz + (i % 3) * 3 - 3);
      car.heading = 0;
      car.group.position.copy(car.pos);
      car.group.rotation.y = 0;
      void lane;
    }
    for (let i = 0; i < peds.length; i += 1) {
      const ped = peds[i];
      ped.group.position.set(cx - 18 + (i % 7) * 6, 0, cz + 6 + Math.floor(i / 7) * 4);
    }
  }

  return { traffic, peds, police, update, stageChase, stageBusy };
}
