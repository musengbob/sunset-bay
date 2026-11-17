// Sunset Bay city: a procedural sun-soaked coastal city built from boxes, canvas
// textures and cheap instancing-friendly meshes. Grid of blocks, roads, sidewalks,
// varied-height buildings, a beach and ocean on the south edge, palms, streetlights.
import * as THREE from 'three';

/** Half the city side in world units; the playable city runs -180..180 on x and z. */
export const WORLD_HALF = 180;
/** Distance between neighbouring street centrelines. */
export const PITCH = 30;
/** Half-width of a road. */
export const ROAD_HALF = 4;
/** z beyond which the sand starts; the ocean lies past the sand. */
export const BEACH_Z = 180;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FACADE_COLORS = [0xe8b98a, 0xd99a6c, 0xf0d0a8, 0xc98d7a, 0xb8c4d0, 0xe0a080, 0x9ab8c8, 0xd8c090, 0xefc9a0, 0xc0b090];
const ROOF_COLORS = [0x8a6a55, 0x6b5a4a, 0x7a7a72, 0x5a6a72];

/** Paint a warm facade with lit windows onto a canvas; returns a CanvasTexture. */
export function makeFacadeTexture(random, baseColor, floors, cols) {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const base = new THREE.Color(baseColor);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, 128, 256);
  // Subtle vertical shading so flat boxes read as buildings.
  const grad = ctx.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.18)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.06)');
  grad.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 256);
  const lit = ['#ffd98a', '#fff2c0', '#ffe9a0'];
  for (let f = 0; f < floors; f += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = 10 + c * ((128 - 20) / cols);
      const y = 14 + f * ((256 - 28) / floors);
      const w = (128 - 20) / cols - 8;
      const h = (256 - 28) / floors - 10;
      const r = random();
      ctx.fillStyle = r < 0.45 ? lit[Math.floor(random() * lit.length)] : (r < 0.8 ? '#2c3e55' : '#4a5a6e');
      ctx.fillRect(x, y, w, h);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** True when (x, z) lies on a road (within ROAD_HALF of a street centreline). */
export function isRoad(x, z) {
  const mx = (((x + WORLD_HALF) % PITCH) + PITCH) % PITCH;
  const mz = (((z + WORLD_HALF) % PITCH) + PITCH) % PITCH;
  return mx < ROAD_HALF || mx > PITCH - ROAD_HALF || mz < ROAD_HALF || mz > PITCH - ROAD_HALF;
}

/** Centreline coordinates of the streets (13 lines each way). */
export function streetLines() {
  const lines = [];
  for (let k = 0; k <= 12; k += 1) lines.push(-WORLD_HALF + k * PITCH);
  return lines;
}

/** A point on a road near the city centre, handy for spawning cars and peds. */
export function randomRoadPoint(random, avoid) {
  const lines = streetLines();
  for (let tries = 0; tries < 20; tries += 1) {
    const along = lines[Math.floor(random() * lines.length)];
    const across = -WORLD_HALF + 8 + random() * (WORLD_HALF * 2 - 16);
    const horizontal = random() < 0.5;
    const x = horizontal ? across : along + (random() < 0.5 ? -2 : 2);
    const z = horizontal ? along + (random() < 0.5 ? -2 : 2) : across;
    if (avoid && Math.hypot(x - avoid.x, z - avoid.z) < 25) continue;
    return { x, z, horizontal };
  }
  return { x: 0, z: 0, horizontal: true };
}

export function createCity(scene, seed = 7) {
  const random = mulberry32(seed);
  const colliders = [];
  const group = new THREE.Group();
  group.name = 'SunsetBayCity';

  // --- Sky, sun, fog -------------------------------------------------------
  scene.background = new THREE.Color(0x87b5e0);
  scene.fog = new THREE.Fog(0x9fc3e8, 220, 620);
  const sun = new THREE.DirectionalLight(0xffe0b0, 2.6);
  sun.position.set(120, 180, 80);
  sun.castShadow = false;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 1.1);
  scene.add(hemi);

  // --- Ground: city slab, beach sand, ocean --------------------------------
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x6f7a6a });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_HALF * 2 + 30, WORLD_HALF * 2 + 30), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 0);
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_HALF * 2 + 60, 46),
    new THREE.MeshLambertMaterial({ color: 0xe8d29a }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.0, BEACH_Z + 22);
  group.add(sand);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 320),
    new THREE.MeshLambertMaterial({ color: 0x1e6f9e }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.4, BEACH_Z + 180);
  group.add(ocean);

  // --- Roads and sidewalks ---------------------------------------------------
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e3138 });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x9a938a });
  for (const line of streetLines()) {
    const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, WORLD_HALF * 2), roadMat);
    roadNS.rotation.x = -Math.PI / 2;
    roadNS.position.set(line, 0.02, 0);
    group.add(roadNS);
    const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_HALF * 2, ROAD_HALF * 2), roadMat);
    roadEW.rotation.x = -Math.PI / 2;
    roadEW.position.set(0, 0.02, line);
    group.add(roadEW);
    // Sidewalk strips flanking each road.
    const walkNS = new THREE.Mesh(new THREE.PlaneGeometry(2.4, WORLD_HALF * 2), walkMat);
    walkNS.rotation.x = -Math.PI / 2;
    walkNS.position.set(line + ROAD_HALF + 1.4, 0.03, 0);
    group.add(walkNS);
    const walkEW = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_HALF * 2, 2.4), walkMat);
    walkEW.rotation.x = -Math.PI / 2;
    walkEW.position.set(0, 0.03, line + ROAD_HALF + 1.4);
    group.add(walkEW);
  }

  // --- Buildings -------------------------------------------------------------
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  for (let bx = 0; bx < 12; bx += 1) {
    for (let bz = 0; bz < 12; bz += 1) {
      const cx = -WORLD_HALF + PITCH / 2 + bx * PITCH;
      const cz = -WORLD_HALF + PITCH / 2 + bz * PITCH;
      const roll = random();
      // A few blocks are parks / plazas instead of buildings.
      if (roll < 0.09) {
        addPark(group, cx, cz, random);
        continue;
      }
      const distCentre = Math.hypot(cx, cz) / (WORLD_HALF * 1.4);
      const tall = 1 - distCentre;
      const count = roll < 0.55 ? 1 : 2;
      for (let i = 0; i < count; i += 1) {
        const w = 9 + random() * 9;
        const d = 9 + random() * 9;
        const h = 7 + random() * random() * (14 + tall * 34);
        const ox = count === 1 ? 0 : (i === 0 ? -5 : 5) + (random() - 0.5) * 2;
        const oz = count === 1 ? 0 : (i === 0 ? 5 : -5) + (random() - 0.5) * 2;
        const x = cx + ox;
        const z = cz + oz;
        const floors = Math.max(2, Math.round(h / 3.4));
        const cols = Math.max(2, Math.round(w / 4));
        const color = FACADE_COLORS[Math.floor(random() * FACADE_COLORS.length)];
        const mat = new THREE.MeshLambertMaterial({ map: makeFacadeTexture(random, color, floors, cols) });
        const building = new THREE.Mesh(boxGeo, mat);
        building.scale.set(w, h, d);
        building.position.set(x, h / 2, z);
        group.add(building);
        const roof = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: ROOF_COLORS[Math.floor(random() * ROOF_COLORS.length)] }));
        roof.scale.set(w + 0.4, 0.5, d + 0.4);
        roof.position.set(x, h + 0.25, z);
        group.add(roof);
        // Rooftop box (AC unit / stair house) on taller buildings.
        if (h > 20 && random() < 0.6) {
          const unit = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x8a8a80 }));
          unit.scale.set(3, 2, 3);
          unit.position.set(x + w / 5, h + 1.5, z - d / 5);
          group.add(unit);
        }
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }

  // --- Palm trees along the beach and in parks --------------------------------
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8f4e });
  function addPalm(x, z, scale = 1) {
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.3 * scale, 5 * scale, 6), trunkMat);
    trunk.position.y = 2.5 * scale;
    trunk.rotation.z = (random() - 0.5) * 0.12;
    palm.add(trunk);
    for (let i = 0; i < 6; i += 1) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9 * scale, 3.2 * scale, 4), leafMat);
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.1 * scale, 5.2 * scale, Math.sin(a) * 1.1 * scale);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      palm.add(leaf);
    }
    palm.position.set(x, 0, z);
    group.add(palm);
  }
  for (let x = -170; x <= 170; x += 14) {
    if (random() < 0.8) addPalm(x + (random() - 0.5) * 4, BEACH_Z + 6 + random() * 12, 0.9 + random() * 0.5);
  }
  for (let i = 0; i < 26; i += 1) {
    const p = randomRoadPoint(random);
    if (!isRoad(p.x, p.z)) addPalm(p.x, p.z, 0.8 + random() * 0.4);
  }

  // --- Streetlights ------------------------------------------------------------
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffdf80, emissiveIntensity: 0.9 });
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 6, 6);
  const headGeo = new THREE.SphereGeometry(0.32, 8, 6);
  for (const line of streetLines()) {
    for (let t = -165; t <= 165; t += 60) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(line + ROAD_HALF + 1, 3, t);
      group.add(pole);
      const head = new THREE.Mesh(headGeo, lampMat);
      head.position.set(line + ROAD_HALF + 1, 6.1, t);
      group.add(head);
    }
  }

  // --- Street props: crates, benches, planters ----------------------------------
  const crateMat = new THREE.MeshLambertMaterial({ color: 0xa8763e });
  const benchMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
  for (let i = 0; i < 40; i += 1) {
    const p = randomRoadPoint(random);
    const px = p.horizontal ? p.x : p.x + 6;
    const pz = p.horizontal ? p.z + 6 : p.z;
    if (isRoad(px, pz)) continue;
    const crate = new THREE.Mesh(boxGeo, random() < 0.5 ? crateMat : benchMat);
    crate.scale.set(1.2, random() < 0.5 ? 1.2 : 0.6, 1.2);
    crate.position.set(px, crate.scale.y / 2, pz);
    group.add(crate);
  }

  // --- Marina marker pier on the beach -------------------------------------------
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a48 });
  const pier = new THREE.Mesh(boxGeo, pierMat);
  pier.scale.set(6, 0.8, 26);
  pier.position.set(60, 0.4, BEACH_Z + 26);
  group.add(pier);

  scene.add(group);
  return { group, colliders, random };
}

/** Small park: green slab, a couple of trees and a bench. */
function addPark(group, cx, cz, random) {
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshLambertMaterial({ color: 0x4a8a3f }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(cx, 0.04, cz);
  group.add(grass);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f7a35 });
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a28 });
  for (let i = 0; i < 3; i += 1) {
    const tx = cx + (random() - 0.5) * 14;
    const tz = cz + (random() - 0.5) * 14;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 3, 6), trunkMat);
    trunk.position.set(tx, 1.5, tz);
    group.add(trunk);
    const top = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), leafMat);
    top.position.set(tx, 4.2, tz);
    group.add(top);
  }
}

/** Push a circle (x, z, radius) out of every building AABB it overlaps. */
export function resolveBuildingCollision(pos, radius, colliders) {
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        // Centre inside the box: push out along the smallest penetration axis.
        const pushL = pos.x - c.minX + radius;
        const pushR = c.maxX - pos.x + radius;
        const pushB = pos.z - c.minZ + radius;
        const pushF = c.maxZ - pos.z + radius;
        const m = Math.min(pushL, pushR, pushB, pushF);
        if (m === pushL) pos.x = c.minX - radius;
        else if (m === pushR) pos.x = c.maxX + radius;
        else if (m === pushB) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
      }
      return true;
    }
  }
  return false;
}
