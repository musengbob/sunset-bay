// HUD: cash, health, wanted stars, mission objective, speed, clock, and a 2D
// canvas minimap (roads, player arrow, mission marker, police dots).
import { WORLD_HALF, BEACH_Z } from './city.js';

export function createHud() {
  const cashEl = document.getElementById('cash');
  const starsEl = document.getElementById('stars');
  const healthEl = document.getElementById('healthfill');
  const clockEl = document.getElementById('clock');
  const objectiveEl = document.getElementById('objectiveText');
  const speedoEl = document.getElementById('speedo');
  const speedEl = document.getElementById('speed');
  const carNameEl = document.getElementById('carname');
  const toastEl = document.getElementById('toast');
  const ammoEl = document.getElementById('ammo');
  const dialogueEl = document.getElementById('dialogue');
  const dialogueGiverEl = document.getElementById('dialogueGiver');
  const dialogueTextEl = document.getElementById('dialogueText');
  const map = document.getElementById('minimap');
  const mctx = map.getContext('2d');
  let toastTimer = 0;
  let dialogueTimer = 0;

  function showToast(text, ms = 2600) {
    toastEl.textContent = text;
    toastEl.style.opacity = '1';
    toastTimer = ms;
  }

  /** Story dialogue: who is talking, and what they say. */
  function showDialogue(giver, text, ms = 6000) {
    dialogueGiverEl.textContent = giver;
    dialogueTextEl.textContent = text;
    dialogueEl.style.opacity = '1';
    dialogueTimer = ms;
  }

  function drawMinimap(playerPos, playerHeading, missionPos, policePos, trafficPos) {
    const W = map.width;
    const H = map.height;
    const scale = W / (WORLD_HALF * 2 + 60);
    const toMap = (x, z) => [W / 2 + x * scale, H / 2 + z * scale];
    mctx.fillStyle = '#0e1a2e';
    mctx.fillRect(0, 0, W, H);
    // Ocean + beach on the south edge.
    mctx.fillStyle = '#1e6f9e';
    const [, beachY] = toMap(0, BEACH_Z);
    mctx.fillRect(0, beachY, W, H - beachY);
    mctx.fillStyle = '#e8d29a';
    mctx.fillRect(0, beachY - 4, W, 5);
    // City blocks.
    mctx.fillStyle = '#2a2f38';
    for (let bx = 0; bx < 12; bx += 1) {
      for (let bz = 0; bz < 12; bz += 1) {
        const [x, z] = toMap(-WORLD_HALF + 15 + bx * 30, -WORLD_HALF + 15 + bz * 30);
        mctx.fillRect(x - 9 * scale, z - 9 * scale, 18 * scale, 18 * scale);
      }
    }
    // Roads.
    mctx.strokeStyle = '#5a6270';
    mctx.lineWidth = 2;
    for (let k = 0; k <= 12; k += 1) {
      const line = -WORLD_HALF + k * 30;
      const [x1] = toMap(line, 0);
      const [, z1] = toMap(0, line);
      mctx.beginPath(); mctx.moveTo(x1, 0); mctx.lineTo(x1, H); mctx.stroke();
      mctx.beginPath(); mctx.moveTo(0, z1); mctx.lineTo(W, z1); mctx.stroke();
    }
    // Mission marker (yellow diamond).
    if (missionPos) {
      const [mx, mz] = toMap(missionPos.x, missionPos.z);
      mctx.fillStyle = '#ffd23e';
      mctx.beginPath();
      mctx.moveTo(mx, mz - 7); mctx.lineTo(mx + 6, mz); mctx.lineTo(mx, mz + 7); mctx.lineTo(mx - 6, mz);
      mctx.closePath(); mctx.fill();
      mctx.strokeStyle = '#7a5a00';
      mctx.stroke();
    }
    // Traffic dots (grey) and police dots (blue/red flashing).
    mctx.fillStyle = '#9aa5b5';
    for (const p of trafficPos || []) {
      const [x, z] = toMap(p.x, p.z);
      mctx.fillRect(x - 1.5, z - 1.5, 3, 3);
    }
    for (const p of policePos || []) {
      const [x, z] = toMap(p.x, p.z);
      mctx.fillStyle = '#3f8cff';
      mctx.beginPath(); mctx.arc(x, z, 4, 0, Math.PI * 2); mctx.fill();
    }
    // Player arrow (white, rotated to heading).
    const [px, pz] = toMap(playerPos.x, playerPos.z);
    mctx.save();
    mctx.translate(px, pz);
    mctx.rotate(playerHeading);
    mctx.fillStyle = '#ffffff';
    mctx.strokeStyle = '#111111';
    mctx.lineWidth = 1.5;
    mctx.beginPath();
    mctx.moveTo(0, -8); mctx.lineTo(5, 6); mctx.lineTo(0, 3); mctx.lineTo(-5, 6);
    mctx.closePath(); mctx.fill(); mctx.stroke();
    mctx.restore();
  }

  /** Refresh every HUD element from the live game state. */
  function update(state) {
    cashEl.textContent = `$${Math.round(state.cash)}`;
    starsEl.textContent = '★'.repeat(state.wanted) + '☆'.repeat(Math.max(0, 5 - state.wanted));
    healthEl.style.width = `${Math.max(0, Math.min(100, state.health))}%`;
    healthEl.style.background = state.health > 50 ? '#37d67a' : state.health > 25 ? '#f2b705' : '#e8433f';
    const hh = String(Math.floor(state.clockMinutes / 60) % 24).padStart(2, '0');
    const mm = String(Math.floor(state.clockMinutes % 60)).padStart(2, '0');
    clockEl.textContent = `${hh}:${mm}`;
    objectiveEl.textContent = state.objective;
    if (state.inCar) {
      speedoEl.style.display = 'block';
      speedEl.textContent = String(Math.round(Math.abs(state.speed) * 2.2));
      carNameEl.textContent = state.carName || '';
    } else {
      speedoEl.style.display = 'none';
    }
    if (ammoEl) {
      ammoEl.textContent = state.reloading
        ? 'RELOADING…'
        : `PISTOL ${state.ammoMag} / ${state.ammoReserve}`;
    }
    if (toastTimer > 0) {
      toastTimer -= 16;
      if (toastTimer <= 0) toastEl.style.opacity = '0';
    }
    if (dialogueTimer > 0) {
      dialogueTimer -= 16;
      if (dialogueTimer <= 0) dialogueEl.style.opacity = '0';
    }
    drawMinimap(state.playerPos, state.playerHeading, state.missionPos, state.policePos, state.trafficPos);
  }

  return { update, showToast, showDialogue };
}
