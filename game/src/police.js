// The Solmar Bay Police Department — the wanted system. Crimes raise heat;
// heat decays when the player behaves. Stars decide how many police cars and
// foot officers hunt the player, how fast they are and how far they spawn.
// Police cars ram the player's car and block the road; foot officers chase on
// foot and, close up and slow, bust the player. Lose them by breaking line of
// sight for a while, or by hiding in the harbour tunnels — in practice, by
// getting far away and staying quiet until the heat fades.
import { WANTED, WORLD } from './config.js';
import { nearestRoadPoint, randomRoadPoint } from './city.js';
import { makeCar } from './vehicles.js';

export const COP_CAR_COLOR = '#1d2b3a';

/** Stars from heat: 0 below 0.5, then one star per whole heat point, capped at 5. */
export function starsFromHeat(heat) {
  if (heat < 0.5) return 0;
  return Math.min(WANTED.maxStars, Math.ceil(heat));
}

/** Add heat for a crime and return the new star count. */
export function addHeat(state, amount, reason) {
  state.wantedHeat = Math.min(6, state.wantedHeat + amount);
  state.wanted = starsFromHeat(state.wantedHeat);
  if (state.wanted > 0) state.wantedTimer = 0;
  state.lastCrime = reason;
  return state.wanted;
}

/** Spawn police to match the wanted level: 1 car per star, foot cops from 2 stars up. */
export function maintainPolice(state, rng) {
  const wantCars = state.wanted;
  const wantCops = state.wanted >= 2 ? state.wanted - 1 : 0;
  let cars = 0;
  let cops = 0;
  for (const c of state.cars) if (c.police) cars += 1;
  for (const c of state.cops) if (!c.down) cops += 1;
  const p = state.player;
  while (cars < wantCars) {
    const pt = randomRoadPoint(rng, p.x, p.y, 500);
    const car = makeCar(rng, pt.x, pt.y, Math.atan2(p.y - pt.y, p.x - pt.x), { police: true, traffic: false });
    car.model = { name: 'Interceptor', color: COP_CAR_COLOR, len: 58, wid: 28, top: 680, price: 0 };
    car.speed = 200;
    state.cars.push(car);
    cars += 1;
  }
  while (cops < wantCops) {
    const pt = nearestRoadPoint(p.x + (rng.next() - 0.5) * 500, p.y + (rng.next() - 0.5) * 500);
    state.cops.push({ x: pt.x, y: pt.y, angle: 0, speed: 250, hp: 50, down: false, downT: 0 });
    cops += 1;
  }
}

/** One police car step: chase the player, ram, and block when close. */
export function stepPoliceCar(state, car, dt) {
  const p = state.player;
  const targetX = p.car ? p.car.x : p.x;
  const targetY = p.car ? p.car.y : p.y;
  const dx = targetX - car.x;
  const dy = targetY - car.y;
  const dist = Math.hypot(dx, dy);
  const wantAngle = Math.atan2(dy, dx);
  // Steer toward the player, limited turn rate so the player can out-drive them.
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turn = Math.max(-2.8 * dt, Math.min(2.8 * dt, diff));
  car.angle += turn;
  const top = 420 + state.wanted * 55;
  car.speed += (top - car.speed) * Math.min(1, dt * 0.9);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  car.x = Math.max(40, Math.min(WORLD.width - 40, nx));
  car.y = Math.max(40, Math.min(WORLD.height - 40, ny));
  // Ramming the player's car damages it and slows both — hard, but not
  // instantly fatal: three interceptors in contact take ~4 s to wreck a car.
  if (p.car) {
    const d = Math.hypot(p.car.x - car.x, p.car.y - car.y);
    if (d < 48) {
      p.car.hp -= 8 * dt;
      p.car.speed *= 0.96;
      car.speed *= 0.85;
      if (Math.random() < dt * 2) state.audio.crash();
    }
  } else if (dist < 46) {
    // A cop car rolling up on a player on foot: the bust clock runs.
    state.bustMeter = Math.min(1, (state.bustMeter || 0) + dt * 0.55);
  }
  return dist;
}

/** One foot officer step: run at the player; close up, the bust meter climbs. */
export function stepFootCop(state, cop, dt) {
  const p = state.player;
  if (cop.down) {
    cop.downT -= dt;
    if (cop.downT <= 0) cop.down = false;
    return;
  }
  const dx = p.x - cop.x;
  const dy = p.y - cop.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 900) {
    // Teleport far cops back near the action so the chase never goes stale.
    const pt = nearestRoadPoint(p.x + (Math.random() - 0.5) * 400, p.y + (Math.random() - 0.5) * 400);
    cop.x = pt.x;
    cop.y = pt.y;
    return;
  }
  cop.angle = Math.atan2(dy, dx);
  const speed = cop.speed * (dist < 120 ? 1.15 : 1);
  cop.x += Math.cos(cop.angle) * speed * dt;
  cop.y += Math.sin(cop.angle) * speed * dt;
  // A foot officer can only bust a player on foot — not one sitting in a car.
  if (dist < 34 && !p.car) {
    state.bustMeter = Math.min(1, (state.bustMeter || 0) + dt * 0.8);
  }
}

/** Heat decay and the lose-the-cops timer. Call every step. */
export function stepWanted(state, dt) {
  if (state.wanted <= 0) {
    state.bustMeter = 0;
    return;
  }
  state.wantedTimer += dt;
  // Heat fades slowly; it fades twice as fast once the player has been out of
  // sight of every cop for a while (approximated: far from all police).
  let nearest = Infinity;
  for (const car of state.cars) {
    if (!car.police) continue;
    nearest = Math.min(nearest, Math.hypot(car.x - state.player.x, car.y - state.player.y));
  }
  for (const cop of state.cops) {
    if (cop.down) continue;
    nearest = Math.min(nearest, Math.hypot(cop.x - state.player.x, cop.y - state.player.y));
  }
  const hidden = nearest > 700;
  const rate = WANTED.decayPerSec * (hidden ? 2.2 : 1);
  state.wantedHeat = Math.max(0, state.wantedHeat - rate * dt);
  const stars = starsFromHeat(state.wantedHeat);
  if (stars !== state.wanted) {
    state.wanted = stars;
    if (stars === 0) {
      state.message = 'You lost the cops. Solmar Bay forgets fast.';
      state.messageT = 4;
    }
  }
  if (hidden) state.bustMeter = Math.max(0, (state.bustMeter || 0) - dt * 0.5);
}
