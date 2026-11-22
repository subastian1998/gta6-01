// Save / continue: money, missions finished, the current mission, player
// position and health, kept in localStorage under one key. Loading a save
// never throws — a corrupt or missing save just starts a new game.
import { SAVE_KEY } from './config.js';

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    const data = {
      money: Math.floor(state.player.money),
      missionsDone: state.missions.done.slice(),
      missionIndex: state.missions.index,
      x: Math.floor(state.player.x),
      y: Math.floor(state.player.y),
      hp: Math.floor(state.player.hp),
      carsStolen: state.stats.carsStolen,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage off (private windows): the session still plays, it just does not persist.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch { /* ignore */ }
}
