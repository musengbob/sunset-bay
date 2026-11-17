// Sunset Bay: game loop, state machine (title / playing / paused / busted /
// wasted) and the wiring between city, player, vehicles, traffic, HUD and save.
// Missions, wanted level and police response live here as real systems: stealing
// a car raises your wanted level, cruisers chase you, reaching a mission marker
// pays cash and advances the story.
import * as THREE from 'three';
import { createCity, BEACH_Z } from './city.js';
import { createPlayer } from './player.js';
import { createVehicles } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createHud } from './hud.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { stageShot } from './shots.js';
import { missionAt, missionCount } from './missions.js';
import { createCombat } from './combat.js';
import { createPolice } from './police.js';
import { createAudio } from './audio.js';
const PLAYER_SPAWN = { x: 0, z: 150 };
const WANTED_DECAY_SECONDS = 25;

const params = new URLSearchParams(window.location.search);
const shotMode = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(-30, 40, 180);

const city = createCity(scene, seed);
const player = createPlayer(scene, city.colliders);
const vehicles = createVehicles(scene, city.colliders, seed + 4);
const traffic = createTraffic(scene, seed + 16);
const combat = createCombat(scene, city.colliders);
const police = createPolice(scene);
const audio = createAudio();
const hud = createHud();

// Mission marker: a tall golden beacon the player can see across the city.
const markerGeo = new THREE.CylinderGeometry(0.12, 0.12, 60, 8);
const markerMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.55 });
const markerBeam = new THREE.Mesh(markerGeo, markerMat);
markerBeam.position.set(missionAt(0).target.x, 30, missionAt(0).target.z);
scene.add(markerBeam);
const markerBase = new THREE.Mesh(
  new THREE.CylinderGeometry(2.2, 2.6, 0.4, 16),
  new THREE.MeshLambertMaterial({ color: 0xffd23e, emissive: 0x8a6a00, emissiveIntensity: 0.7 }),
);
markerBase.position.set(missionAt(0).target.x, 0.2, missionAt(0).target.z);
scene.add(markerBase);

const game = {
  screen: 'title',
  cash: 250,
  health: 100,
  wanted: 0,
  clockMinutes: 18 * 60 + 42,
  missionIndex: 0,
  missionsDone: 0,
  muted: false,
  crimeTimer: 0,
  wantedTimer: 0,
  lockCamera: false,
};

const keys = {};
const pointerDelta = { x: 0, y: 0 };
let ePressed = false;
let fPressed = false;
let shootPressed = false;
let titleAngle = 0;
let autoFireTimer = 0;

function currentMission() {
  return missionAt(game.missionIndex);
}

/** Fire mission-start triggers: gunfight squad, heat, heist wanted level. */
function onMissionStart(index) {
  const m = missionAt(index);
  hud.showDialogue(m.giver, m.dialogue, 7000);
  if (m.trigger === 'combat' && m.target) combat.spawnSquad(m.target.x, m.target.z, 3);
  if (m.trigger === 'heat') raiseWanted(3);
  if (m.trigger === 'heist') raiseWanted(2);
}

function setState(patch) {
  Object.assign(game, patch);
}

function applyMissionMarker() {
  const m = currentMission();
  const visible = !!m.target;
  markerBeam.visible = visible;
  markerBase.visible = visible;
  if (visible) {
    markerBeam.position.set(m.target.x, 30, m.target.z);
    markerBase.position.set(m.target.x, 0.2, m.target.z);
  }
}

function showScreen(name) {
  game.screen = name;
  for (const id of ['title', 'paused', 'busted', 'wasted']) {
    document.getElementById(id).classList.toggle('hidden', id !== name);
  }
  document.getElementById('hud').classList.toggle('on', name === 'playing');
  if (name !== 'playing' && document.pointerLockElement) document.exitPointerLock();
}

function startGame(fromSave) {
  const data = fromSave ? loadGame() : null;
  if (data) {
    game.cash = data.cash;
    game.missionsDone = data.missionsDone;
    game.wanted = 0;
    game.health = data.health ?? 100;
    game.clockMinutes = data.clockMinutes ?? 18 * 60 + 42;
    game.missionIndex = data.missionIndex ?? 0;
    player.teleport(data.player.x, data.player.z);
  } else {
    game.cash = 250;
    game.health = 100;
    game.wanted = 0;
    game.clockMinutes = 18 * 60 + 42;
    game.missionIndex = 0;
    game.missionsDone = 0;
    player.teleport(PLAYER_SPAWN.x, PLAYER_SPAWN.z);
  }
  applyMissionMarker();
  showScreen('playing');
  audio.unlock();
  audio.startMusic();
  hud.showToast(data ? 'Welcome back to Sunset Bay.' : 'Welcome to Sunset Bay, Jax.');
  onMissionStart(game.missionIndex);
}

function goBusted() {
  game.cash = Math.max(0, game.cash - 150);
  game.wanted = 0;
  game.health = 100;
  if (vehicles.current) vehicles.exitCar(player.state.pos);
  player.teleport(PLAYER_SPAWN.x, PLAYER_SPAWN.z);
  showScreen('busted');
  saveGame(snapshot());
}

function goWasted() {
  game.cash = Math.max(0, game.cash - 200);
  game.wanted = 0;
  game.health = 100;
  if (vehicles.current) vehicles.exitCar(player.state.pos);
  player.teleport(PLAYER_SPAWN.x, PLAYER_SPAWN.z);
  showScreen('wasted');
  saveGame(snapshot());
}

function snapshot() {
  return {
    cash: game.cash,
    missionsDone: game.missionsDone,
    wanted: game.wanted,
    health: game.health,
    clockMinutes: game.clockMinutes,
    playerPos: player.state.pos,
    missionIndex: game.missionIndex,
  };
}

function completeMission() {
  const m = currentMission();
  game.cash += m.reward;
  game.missionsDone += 1;
  game.missionIndex = Math.min(game.missionIndex + 1, missionCount());
  audio.missionJingle();
  hud.showToast(`Mission complete — +$${m.reward}`);
  applyMissionMarker();
  saveGame(snapshot());
  if (game.missionIndex < missionCount()) onMissionStart(game.missionIndex);
  else hud.showDialogue('Rico Vega', missionAt(game.missionIndex).dialogue, 8000);
}

function raiseWanted(level) {
  if (level > game.wanted) {
    game.wanted = level;
    game.crimeTimer = 0;
    if (level >= 2) hud.showToast('The SBPD is on you!');
  }
}

// --- Input -------------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') e.preventDefault();
  keys[e.code] = true;
  if (e.code === 'KeyE') ePressed = true;
  if (e.code === 'KeyF') fPressed = true;
  if (e.code === 'KeyP' && game.screen === 'playing') showScreen('paused');
  else if (e.code === 'KeyP' && game.screen === 'paused') showScreen('playing');
  if (e.code === 'KeyM') {
    game.muted = !game.muted;
    audio.setMuted(game.muted);
    hud.showToast(game.muted ? 'Sound muted.' : 'Sound on.');
  }
  if (e.code === 'KeyR' && game.screen === 'playing') {
    if (combat.startReload()) audio.reloadClick();
  }
  if (e.code === 'KeyT' && game.screen === 'playing') {
    hud.showToast(`Current job: ${currentMission().text}`);
  }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas) {
    pointerDelta.x += e.movementX;
    pointerDelta.y += e.movementY;
  }
});
canvas.addEventListener('click', () => {
  if (game.screen !== 'playing') return;
  if (document.pointerLockElement !== canvas) {
    canvas.requestPointerLock();
    audio.unlock();
    return;
  }
  shootPressed = true;
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Buttons -------------------------------------------------------------------
document.getElementById('btnNew').addEventListener('click', () => startGame(false));
document.getElementById('btnContinue').addEventListener('click', () => startGame(true));
document.getElementById('btnResume').addEventListener('click', () => showScreen('playing'));
document.getElementById('btnQuit').addEventListener('click', () => { saveGame(snapshot()); showScreen('title'); });
document.getElementById('btnBusted').addEventListener('click', () => showScreen('playing'));
document.getElementById('btnWasted').addEventListener('click', () => showScreen('playing'));
if (hasSave()) document.getElementById('btnContinue').classList.remove('hidden');

// --- Shot staging ---------------------------------------------------------------
if (shotMode) {
  stageShot(shotMode, {
    player, vehicles, traffic, hud, setState, combat, police,
    camera, get lockCamera() { return game.lockCamera; }, set lockCamera(v) { game.lockCamera = v; },
  });
  applyMissionMarker();
  showScreen(game.screen === 'title' ? 'title' : 'playing');
  if (game.screen === 'playing') document.getElementById('hud').classList.add('on');
}

// --- Main loop --------------------------------------------------------------------
let last = performance.now();
let saveTimer = 0;
let framesRendered = 0;
let shotReadyAt = 0;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (game.screen === 'playing') {
    game.clockMinutes += dt * 0.5; // one game minute every two real seconds
    game.crimeTimer += dt;

    // Enter / exit cars.
    if (ePressed) {
      if (vehicles.current) {
        vehicles.exitCar(player.state.pos);
        player.teleport(player.state.pos.x, player.state.pos.z, player.state.camYaw);
      } else {
        const near = vehicles.nearestCar(player.state.pos);
        if (near) {
          const result = vehicles.enterCar(near);
          if (result === 'stolen') {
            raiseWanted(1);
            hud.showToast(`Stole a ${near.def.name} — the SBPD noticed!`);
          } else {
            hud.showToast(`Driving the ${near.def.name}.`);
          }
        }
      }
    }
    // Punch: shove a nearby pedestrian, and earn heat for it.
    if (fPressed) {
      let hit = false;
      for (const ped of traffic.peds) {
        const d = Math.hypot(ped.group.position.x - player.state.pos.x, ped.group.position.z - player.state.pos.z);
        if (d < 2.6 && !vehicles.current) {
          ped.group.rotation.x = -Math.PI / 2;
          ped.group.position.y = 0.3;
          hit = true;
        }
      }
      if (hit) raiseWanted(2);
    }
    ePressed = false;
    fPressed = false;

    const inCar = !!vehicles.current;
    player.state.group.visible = !inCar;
    const prevSpeed = inCar ? vehicles.current.speed : 0;
    if (inCar) vehicles.update(dt, keys, true);
    else player.update(dt, keys, pointerDelta, true);
    // Shooting: click fires the pistol (on foot or drive-by from a car).
    if (shootPressed || (shotMode === 'combat' && (autoFireTimer -= dt) <= 0)) {
      shootPressed = false;
      if (shotMode === 'combat') autoFireTimer = 0.3;
      const origin = inCar ? vehicles.current.pos : player.state.pos;
      const dir = new THREE.Vector3();
      if (inCar) dir.set(Math.sin(vehicles.current.heading), 0, Math.cos(vehicles.current.heading));
      else camera.getWorldDirection(dir);
      const hit = combat.shoot(origin, dir, () => {});
      if (hit === 'empty') {
        audio.emptyClick();
        hud.showToast('Empty! Press R to reload.');
      } else if (hit !== false) {
        audio.gunshot();
        if (hit) raiseWanted(2);
        else if (game.wanted < 1) raiseWanted(1);
      }
    }
    if (inCar) {
      // A hard crash hurts: a big sudden speed loss is an impact.
      const impact = Math.abs(prevSpeed - vehicles.current.speed);
      if (impact > 12) {
        game.health -= Math.round(impact * 0.8);
        hud.showToast('Crash!');
      }
    }
    const playerPos = inCar ? vehicles.current.pos : player.state.pos;
    const result = traffic.update(dt, playerPos, inCar, game.wanted, inCar ? vehicles.current.speed : 0);
    combat.update(dt, playerPos, inCar, (dmg) => {
      game.health -= dmg;
      audio.hurtThud();
    });
    const policeResult = police.update(dt, playerPos, game.wanted, inCar,
      inCar ? vehicles.current.speed : 0, inCar ? vehicles.current.heading : player.state.yaw);
    audio.setEngine(inCar ? vehicles.current.speed : 0, inCar);
    audio.setSiren(game.wanted >= 2);
    if (result.busted || policeResult.busted) { goBusted(); }
    else if (game.health <= 0) { goWasted(); }

    // Wanted decay: stay clean and out of sight and the heat cools off.
    if (game.wanted > 0 && game.crimeTimer > WANTED_DECAY_SECONDS) {
      game.wantedTimer += dt;
      if (game.wantedTimer > 20) {
        game.wanted -= 1;
        game.wantedTimer = 0;
        game.crimeTimer = 0;
      }
    } else {
      game.wantedTimer = 0;
    }

    // Mission progress.
    const m = currentMission();
    if (m.target) {
      const d = Math.hypot(playerPos.x - m.target.x, playerPos.z - m.target.z);
      let done = false;
      if (m.trigger === 'drive') done = !!vehicles.current && d < 8;
      else if (m.trigger === 'combat') done = combat.enemiesAlive() === 0 && d < 12;
      else done = d < 7;
      if (done) completeMission();
    }

    // Camera.
    if (!vehicles.updateCamera(camera)) player.updateCamera(camera);

    // Autosave.
    saveTimer += dt;
    if (saveTimer > 10) { saveTimer = 0; saveGame(snapshot()); }

    hud.update({
      cash: game.cash,
      health: game.health,
      wanted: game.wanted,
      clockMinutes: game.clockMinutes,
      objective: currentMission().text,
      inCar,
      speed: inCar ? vehicles.current.speed : 0,
      carName: inCar ? vehicles.current.def.name : '',
      ammoMag: combat.ammo.mag,
      ammoReserve: combat.ammo.reserve,
      reloading: combat.reloading,
      playerPos,
      playerHeading: inCar ? vehicles.current.heading : player.state.yaw,
      missionPos: currentMission().target,
      policePos: [...traffic.police.map((c) => c.pos), ...police.extraPolice.map((c) => c.pos)],
      trafficPos: traffic.traffic.map((c) => c.pos),
    });
  } else if (game.screen === 'title') {
    // Slow golden-hour orbit over the city behind the title screen.
    if (!game.lockCamera) {
      titleAngle += dt * 0.02;
      camera.position.set(Math.sin(titleAngle) * 150, 60, Math.cos(titleAngle) * 150 + 40);
      camera.lookAt(0, 6, 20);
    }
    traffic.update(dt, null, false, 0, 0);
  } else {
    // Paused / busted / wasted: keep the world visible, frozen.
    traffic.update(0, null, false, 0, 0);
  }

  markerBeam.rotation.y += dt * 0.8;
  renderer.render(scene, camera);
  framesRendered += 1;
  if (shotMode && framesRendered === 12) {
    shotReadyAt = performance.now();
    window.__shotReady = true;
  }
}

applyMissionMarker();
showScreen(game.screen);
requestAnimationFrame(animate);
