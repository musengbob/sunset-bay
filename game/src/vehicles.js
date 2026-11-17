// Arcade driving: distinct car models built from boxes, enter/exit with E,
// steering / acceleration / brake / handbrake, simple AABB building collision.
import * as THREE from 'three';
import { resolveBuildingCollision, randomRoadPoint, WORLD_HALF } from './city.js';

const CAR_DEFS = [
  { name: 'Bayside Sedan', color: 0xc23b2e, topSpeed: 26, accel: 14, len: 4.4, wid: 1.9 },
  { name: 'Sunset Taxi', color: 0xf2b705, topSpeed: 24, accel: 13, len: 4.4, wid: 1.9, taxi: true },
  { name: 'Harbor Truck', color: 0x4a6a8a, topSpeed: 19, accel: 9, len: 5.6, wid: 2.1, truck: true },
  { name: 'Vortex GT', color: 0x18b5a6, topSpeed: 34, accel: 19, len: 4.2, wid: 2.0, sports: true },
];

const PAINT = [0xc23b2e, 0x2e6ac2, 0xe8e4da, 0x3a3a3a, 0x7a4a9a, 0xd97a2e, 0x18b5a6, 0x8a2e4a];

export function buildCarMesh(def) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: def.color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x18242e });
  const dark = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const bodyH = def.truck ? 1.0 : 0.62;
  const bodyY = def.truck ? 0.85 : 0.62;
  const body = new THREE.Mesh(new THREE.BoxGeometry(def.wid, bodyH, def.len), paint);
  body.position.y = bodyY;
  group.add(body);
  const cabinH = def.truck ? 0.85 : 0.55;
  const cabinLen = def.truck ? 1.3 : def.len * 0.48;
  const cabinZ = def.truck ? def.len / 2 - 0.9 : -def.len * 0.05;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(def.wid - 0.25, cabinH, cabinLen), def.sports ? paint : glass);
  cabin.position.set(0, bodyY + bodyH / 2 + cabinH / 2 - 0.05, cabinZ);
  group.add(cabin);
  if (def.truck) {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(def.wid - 0.2, 0.55, def.len * 0.42), dark);
    bed.position.set(0, bodyY + bodyH / 2 + 0.2, -def.len / 2 + def.len * 0.24);
    group.add(bed);
  }
  if (def.taxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xffe14d, emissive: 0x8a7a00, emissiveIntensity: 0.6 }));
    sign.position.set(0, bodyY + bodyH / 2 + cabinH + 0.05, cabinZ);
    group.add(sign);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelPos = [
    [-def.wid / 2, 0.36, def.len / 2 - 0.85], [def.wid / 2, 0.36, def.len / 2 - 0.85],
    [-def.wid / 2, 0.36, -def.len / 2 + 0.85], [def.wid / 2, 0.36, -def.len / 2 + 0.85],
  ];
  const wheels = [];
  for (const [x, y, z] of wheelPos) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.position.set(x, y, z);
    group.add(w);
    wheels.push(w);
  }
  // Headlights + taillights.
  const lightGeo = new THREE.BoxGeometry(0.32, 0.14, 0.06);
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff6c0, emissive: 0xfff2a0, emissiveIntensity: 0.8 });
  for (const x of [-def.wid / 2 + 0.3, def.wid / 2 - 0.3]) {
    const h = new THREE.Mesh(lightGeo, headMat);
    h.position.set(x, bodyY, def.len / 2 + 0.02);
    group.add(h);
    const t = new THREE.Mesh(lightGeo, new THREE.MeshLambertMaterial({ color: 0xff2a2a, emissive: 0xaa0000, emissiveIntensity: 0.6 }));
    t.position.set(x, bodyY, -def.len / 2 - 0.02);
    group.add(t);
  }
  return { group, wheels };
}

export function createVehicles(scene, colliders, seed = 11) {
  let s = seed >>> 0;
  const random = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const cars = [];
  function spawnCar(def, x, z, heading, parked) {
    const { group, wheels } = buildCarMesh(def);
    group.position.set(x, 0, z);
    group.rotation.y = heading;
    scene.add(group);
    const car = { def, group, wheels, pos: group.position, heading, speed: 0, parked, stolen: false, steer: 0 };
    cars.push(car);
    return car;
  }

  // Parked cars along the roads, a few per district.
  for (let i = 0; i < 14; i += 1) {
    const p = randomRoadPoint(random);
    const def = { ...CAR_DEFS[Math.floor(random() * CAR_DEFS.length)] };
    def.color = PAINT[Math.floor(random() * PAINT.length)];
    if (def.taxi) def.color = 0xf2b705;
    const heading = p.horizontal ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const ox = p.horizontal ? 0 : (random() < 0.5 ? -3 : 3);
    const oz = p.horizontal ? (random() < 0.5 ? -3 : 3) : 0;
    spawnCar(def, p.x + ox, p.z + oz, heading, true);
  }
  // A sports car parked by the marina, and a taxi by the plaza — easy first steals.
  spawnCar({ ...CAR_DEFS[3] }, 54, 172, Math.PI, true);
  spawnCar({ ...CAR_DEFS[1] }, 4, -2, Math.PI / 2, true);

  let current = null;

  function enterCar(car) {
    if (current) return false;
    current = car;
    car.parked = false;
    if (!car.stolen) {
      car.stolen = true;
      return 'stolen';
    }
    return 'entered';
  }

  function exitCar(playerPos) {
    if (!current) return null;
    const car = current;
    current = null;
    car.speed = 0;
    const side = new THREE.Vector3(Math.cos(car.heading), 0, -Math.sin(car.heading));
    playerPos.set(car.pos.x + side.x * 2.2, 0, car.pos.z + side.z * 2.2);
    return car;
  }

  function nearestCar(pos, maxDist = 4.5) {
    let best = null;
    let bestD = maxDist;
    for (const car of cars) {
      const d = Math.hypot(car.pos.x - pos.x, car.pos.z - pos.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function update(dt, keys, active) {
    if (!current || !active) return;
    const car = current;
    const def = car.def;
    const throttle = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const steerInput = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0);
    const handbrake = !!(keys.Space);
    const targetSteer = steerInput * 0.55 * Math.min(1, Math.abs(car.speed) / 6 + 0.25);
    car.steer += (targetSteer - car.steer) * Math.min(1, dt * 8);
    if (throttle > 0) car.speed += def.accel * dt;
    else if (throttle < 0) car.speed -= (car.speed > 0.5 ? 22 : 9) * dt;
    else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
    if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
    car.speed = THREE.MathUtils.clamp(car.speed, -10, def.topSpeed);
    car.heading += (car.steer * car.speed * dt) / Math.max(2.2, def.len * 0.55);
    const nx = car.pos.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.pos.z + Math.cos(car.heading) * car.speed * dt;
    const before = { x: car.pos.x, z: car.pos.z };
    car.pos.x = THREE.MathUtils.clamp(nx, -WORLD_HALF - 12, WORLD_HALF + 12);
    car.pos.z = THREE.MathUtils.clamp(nz, -WORLD_HALF - 12, 210);
    if (resolveBuildingCollision(car.pos, def.len / 2, colliders)) {
      // A hard hit: kill most of the speed, with a little bounce.
      car.speed *= -0.25;
    }
    if (Math.hypot(car.pos.x - before.x, car.pos.z - before.z) < 0.001 && Math.abs(car.speed) > 2) {
      car.speed *= 0.4; // pushed against the world edge
    }
    car.group.rotation.y = car.heading;
    for (const w of car.wheels) w.rotation.x += (car.speed * dt) / 0.36;
    car.wheels[0].rotation.y = car.steer * 0.7;
    car.wheels[1].rotation.y = car.steer * 0.7;
  }

  /** Chase camera behind the driven car. */
  function updateCamera(camera, playerCamYaw, playerCamPitch) {
    if (!current) return false;
    const car = current;
    const back = new THREE.Vector3(-Math.sin(car.heading), 0, -Math.cos(car.heading));
    const target = new THREE.Vector3(car.pos.x, car.pos.y + 1.8, car.pos.z);
    const dist = 9 + Math.abs(car.speed) * 0.12;
    camera.position.copy(target).addScaledVector(back, dist);
    camera.position.y = 4.2 + Math.abs(car.speed) * 0.03;
    camera.lookAt(target.x + Math.sin(car.heading) * 4, 1.4, target.z + Math.cos(car.heading) * 4);
    return true;
  }

  return { cars, spawnCar, enterCar, exitCar, nearestCar, update, updateCamera, get current() { return current; } };
}
