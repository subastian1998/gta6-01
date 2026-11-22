// Combat: the player's pistol. Mouse aims, click (or hold) fires with a short
// cooldown; bullets fly straight, spark on buildings, wound pedestrians and
// cops, and can disable a police car. Firing is a crime — it raises heat and
// scares the crowd. The player has no infinite health: cops shoot back when
// close, and at zero the player is Wasted.
import { scarePeds } from './pedestrians.js';
import { addHeat } from './police.js';
import { hitsBuilding } from './city.js';

const FIRE_COOLDOWN = 0.22;
const BULLET_SPEED = 900;
const BULLET_RANGE = 620;

/** Fire one shot from the player toward the aim point (world coords). */
export function tryShoot(state, aimX, aimY) {
  const p = state.player;
  if (p.shootCooldown > 0 || p.car) return false;
  p.shootCooldown = FIRE_COOLDOWN;
  const angle = Math.atan2(aimY - p.y, aimX - p.x);
  state.bullets.push({
    x: p.x + Math.cos(angle) * 20,
    y: p.y + Math.sin(angle) * 20,
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    life: BULLET_RANGE / BULLET_SPEED,
    friendly: true,
  });
  p.angle = angle;
  state.audio.shoot();
  state.muzzle = 0.08;
  addHeat(state, 0.6, 'shots fired');
  scarePeds(state, p.x, p.y, 320);
  return true;
}

/** Advance bullets; returns {killedCop, killedPed} counts for the caller. */
export function stepBullets(state, dt) {
  let killedCop = 0;
  let killedPed = 0;
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) { b.dead = true; continue; }
    if (hitsBuilding(state.city, b.x, b.y, 2)) {
      b.dead = true;
      state.particles.push({ kind: 'spark', x: b.x, y: b.y, vx: 0, vy: 0, life: 0.25, max: 0.25 });
      continue;
    }
    if (b.friendly) {
      for (const ped of state.peds) {
        if (ped.dead) continue;
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
          ped.dead = true;
          ped.fall = 1;
          b.dead = true;
          killedPed += 1;
          addHeat(state, 1.0, 'pedestrian down');
          break;
        }
      }
      if (b.dead) continue;
      for (const cop of state.cops) {
        if (cop.down) continue;
        if (Math.hypot(cop.x - b.x, cop.y - b.y) < 15) {
          cop.hp -= 34;
          b.dead = true;
          if (cop.hp <= 0) {
            cop.down = true;
            cop.downT = 20;
            killedCop += 1;
            addHeat(state, 1.0, 'officer down');
          }
          break;
        }
      }
      if (b.dead) continue;
      for (const car of state.cars) {
        if (car.police && Math.hypot(car.x - b.x, car.y - b.y) < 30) {
          car.hp -= 12;
          b.dead = true;
          if (car.hp <= 0) {
            car.speed = 0;
            car.police = false;
            car.traffic = false;
            car.parked = true;
            state.particles.push({ kind: 'smoke', x: car.x, y: car.y, vx: 0, vy: -20, life: 1, max: 1 });
            addHeat(state, 1.0, 'police car disabled');
          }
          break;
        }
      }
    }
  }
  state.bullets = state.bullets.filter((b) => !b.dead);
  return { killedCop, killedPed };
}

/** Cops shoot back when the player is wanted and close on foot. */
export function stepCopFire(state, dt) {
  const p = state.player;
  if (state.wanted <= 0 || p.car) return;
  p.copFireT -= dt;
  if (p.copFireT > 0) return;
  for (const cop of state.cops) {
    if (cop.down) continue;
    const d = Math.hypot(cop.x - p.x, cop.y - p.y);
    if (d < 320) {
      p.copFireT = 0.9;
      const angle = Math.atan2(p.y - cop.y, p.x - cop.x) + (Math.random() - 0.5) * 0.2;
      state.bullets.push({
        x: cop.x, y: cop.y,
        vx: Math.cos(angle) * BULLET_SPEED, vy: Math.sin(angle) * BULLET_SPEED,
        life: BULLET_RANGE / BULLET_SPEED, friendly: false,
      });
      break;
    }
  }
}

/** Enemy bullets hitting the player. Returns damage dealt this step. */
export function stepEnemyBullets(state, dt) {
  const p = state.player;
  let damage = 0;
  for (const b of state.bullets) {
    if (b.friendly) continue;
    if (Math.hypot(p.x - b.x, p.y - b.y) < 14) {
      b.dead = true;
      damage += 9;
    }
  }
  if (damage > 0) hurtPlayer(state, damage);
  state.bullets = state.bullets.filter((b) => !b.dead);
  return damage;
}

/** Damage the player; returns true when the player is down. */
export function hurtPlayer(state, amount) {
  const p = state.player;
  if (p.invulnT > 0) return false;
  p.hp -= amount;
  p.invulnT = 0.25;
  if (p.hp <= 0) {
    p.hp = 0;
    return true;
  }
  return false;
}
