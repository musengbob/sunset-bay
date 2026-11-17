// Jax Marlow on foot: third-person controller. WASD moves relative to the camera,
// mouse orbits the camera (pointer lock on click), Shift runs, Space jumps.
import * as THREE from 'three';
import { resolveBuildingCollision, WORLD_HALF } from './city.js';

const WALK_SPEED = 5.2;
const RUN_SPEED = 9.5;
const JUMP_SPEED = 8.5;
const GRAVITY = 24;

export function createPlayer(scene, colliders) {
  // A simple stylised figure: jacket torso, head, legs, arms — built from boxes.
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5e });
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2e5e8a });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2a3242 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x201510 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), jacket);
  torso.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.34), skin);
  head.position.y = 1.62;
  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.36), hair);
  hairTop.position.y = 1.82;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.68, 0.28), jeans);
  legL.position.set(-0.16, 0.34, 0);
  const legR = legL.clone();
  legR.position.x = 0.16;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.22), jacket);
  armL.position.set(-0.42, 1.05, 0);
  const armR = armL.clone();
  armR.position.x = 0.42;
  group.add(torso, head, hairTop, legL, legR, armL, armR);
  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  scene.add(group);

  const state = {
    group,
    pos: new THREE.Vector3(0, 0, 150),
    velY: 0,
    grounded: true,
    yaw: Math.PI, // facing north, into the city from the beach
    camYaw: Math.PI,
    camPitch: 0.32,
    camDist: 7.5,
    moving: false,
    running: false,
    swing: 0,
    legL,
    legR,
    armL,
    armR,
  };
  group.position.copy(state.pos);

  function update(dt, keys, pointerDelta, active) {
    if (!active) return;
    state.camYaw -= pointerDelta.x * 0.0028;
    state.camPitch = THREE.MathUtils.clamp(state.camPitch + pointerDelta.y * 0.0022, -0.15, 1.1);
    pointerDelta.x = 0;
    pointerDelta.y = 0;

    const forward = new THREE.Vector3(-Math.sin(state.camYaw), 0, -Math.cos(state.camYaw));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const move = new THREE.Vector3();
    if (keys.KeyW || keys.ArrowUp) move.add(forward);
    if (keys.KeyS || keys.ArrowDown) move.sub(forward);
    if (keys.KeyD || keys.ArrowRight) move.add(right);
    if (keys.KeyA || keys.ArrowLeft) move.sub(right);
    state.moving = move.lengthSq() > 0;
    if (state.moving) {
      move.normalize();
      state.running = !!(keys.ShiftLeft || keys.ShiftRight);
      const speed = state.running ? RUN_SPEED : WALK_SPEED;
      state.pos.addScaledVector(move, speed * dt);
      state.yaw = Math.atan2(move.x, move.z);
      state.swing += dt * (state.running ? 13 : 9);
    } else {
      state.swing *= 0.8;
    }

    // Jump + gravity.
    if (keys.Space && state.grounded) {
      state.velY = JUMP_SPEED;
      state.grounded = false;
    }
    state.velY -= GRAVITY * dt;
    state.pos.y += state.velY * dt;
    if (state.pos.y <= 0) {
      state.pos.y = 0;
      state.velY = 0;
      state.grounded = true;
    }

    // Keep inside the city + beach, and out of buildings.
    state.pos.x = THREE.MathUtils.clamp(state.pos.x, -WORLD_HALF - 10, WORLD_HALF + 10);
    state.pos.z = THREE.MathUtils.clamp(state.pos.z, -WORLD_HALF - 10, 208);
    resolveBuildingCollision(state.pos, 0.55, colliders);

    group.position.copy(state.pos);
    group.rotation.y = state.yaw;
    const s = Math.sin(state.swing);
    state.legL.rotation.x = s * 0.7;
    state.legR.rotation.x = -s * 0.7;
    state.armL.rotation.x = -s * 0.55;
    state.armR.rotation.x = s * 0.55;
    if (!state.grounded) {
      state.legL.rotation.x = 0.5;
      state.legR.rotation.x = -0.35;
    }
  }

  /** Third-person camera: orbit behind the player, looking at their chest. */
  function updateCamera(camera) {
    const target = new THREE.Vector3(state.pos.x, state.pos.y + 1.6, state.pos.z);
    const off = new THREE.Vector3(
      Math.sin(state.camYaw) * Math.cos(state.camPitch),
      Math.sin(state.camPitch),
      Math.cos(state.camYaw) * Math.cos(state.camPitch),
    ).multiplyScalar(state.camDist);
    camera.position.copy(target).add(off);
    camera.lookAt(target);
  }

  function teleport(x, z, camYaw = Math.PI) {
    state.pos.set(x, 0, z);
    state.velY = 0;
    state.camYaw = camYaw;
    state.yaw = camYaw;
    group.position.copy(state.pos);
  }

  return { state, update, updateCamera, teleport };
}
