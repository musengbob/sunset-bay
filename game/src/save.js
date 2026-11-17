// Save / load through localStorage: cash, missions done, player position,
// wanted level and the in-game clock. Returns null when nothing is saved.
const SAVE_KEY = 'sunset-bay-save-v1';

export function saveGame(state) {
  try {
    const data = {
      cash: Math.round(state.cash),
      missionsDone: state.missionsDone,
      wanted: state.wanted,
      health: state.health,
      clockMinutes: state.clockMinutes,
      player: { x: state.playerPos.x, z: state.playerPos.z },
      missionIndex: state.missionIndex,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false; // Storage off (private window): the session just lasts this visit.
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || !data.player) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
