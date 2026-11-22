// Vehicles: the cars of Solmar Bay. Traffic cars drive the road grid — they
// follow their avenue or street, turn at intersections, slow for the car ahead
// and despawn far from the player. The player's car uses arcade physics:
// throttle, steering that bites harder at speed, handbrake slides and heavy
// off-road drag. Stealing a parked or traffic car is a crime; a stolen car
// keeps its ownerless flag so the wanted system can see it.
import { AVENUES, CAR, WORLD } from './config.js';
import { collideBuildings, isOnRoad, nearestRoadLine, nearestRoadPoint, randomRoadPoint } from './city.js';
import { createRandom } from './random.js';

export const CAR_MODELS = [
  { name: 'Pinto', color: '#c94f42', len: 52, wid: 26, top: 520, price: 800 },
  { name: 'Comet', color: '#4a7a9e', len: 54, wid: 26, top: 560, price: 1500 },
  { name: 'Solstice', color: '#e8a04c', len: 58, wid: 28, top: 620, price: 4200 },
  { name: 'Vagabond Van', color: '#8a8f98', len: 66, wid: 30, top: 460, price: 2200 },
  { name: 'Aurora GT', color: '#e85d8a', len: 60, wid: 28, top: 700, price: 9000 },
  { name: 'Marlin Cab', color: '#f2c94c', len: 56, wid: 27, top: 540, price: 1800 },
  { name: 'Tide Runner', color: '#3fa7c4', len: 62, wid: 29, top: 480, price: 2600 },
];

export const POLICE_COLORS = ['#1d2b3a', '#f5f1e6'];

let nextCarId = 1;

/** Make a car object. `traffic` cars drive themselves; `parked` ones wait to be stolen. */
export function makeCar(rng, x, y, angle, opts = {}) {
  const model = opts.model ?? CAR_MODELS[Math.floor(rng.next() * CAR_MODELS.length)];
  return {
    id: nextCarId,
    model,
    x,
    y,
    angle,
    speed: 0,
    hp: 100,
    traffic: !!opts.traffic,
    parked: !!opts.parked,
    police: !!opts.police,
    stolen: false,
    driver: !!opts.traffic,
    // Traffic AI state: which road line it follows and which way along it.
    axis: opts.axis ?? 'x',
    line: opts.line ?? y,
    dir: opts.dir ?? 1,
    turnCooldown: 0,
    honk: 0,
    smoke: 0,
  };
}

/** Spawn the opening traffic: parked cars near the player and moving traffic on roads. */
export function seedTraffic(state, rng) {
  state.cars = [];
  const p = state.player;
  // A few parked cars within a short walk, snapped onto the road so a stolen
  // car never starts inside a building.
  const parkedSpots = [
    { x: p.x + 140, y: p.y - 40 }, { x: p.x - 180, y: p.y + 90 }, { x: p.x + 60, y: p.y + 220 },
    { x: p.x + 320, y: p.y + 160 }, { x: p.x - 320, y: p.y - 160 },
  ];
  for (const spot of parkedSpots) {
    const road = nearestRoadPoint(spot.x, spot.y);
    const car = makeCar(rng, road.x, road.y, rng.next() * Math.PI * 2, { parked: true });
    state.cars.push(car);
  }
  for (let i = 0; i < 26; i += 1) {
    const pt = randomRoadPoint(rng, p.x, p.y, 500);
    const line = nearestRoadLine(pt.x, pt.y);
    const car = makeCar(rng, pt.x, pt.y, line.axis === 'x' ? (rng.next() < 0.5 ? 0 : Math.PI) : (rng.next() < 0.5 ? Math.PI / 2 : -Math.PI / 2), {
      traffic: true, axis: line.axis, line: line.at, dir: rng.next() < 0.5 ? 1 : -1,
    });
    car.speed = 140 + rng.next() * 90;
    state.cars.push(car);
  }
}

/** The nearest car within `maxDist` of (x, y) that the player could enter. Wrecked cars (hp 0) are not enterable. */
export function nearestEnterableCar(state, x, y, maxDist = 90) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (car.police || car.hp <= 0) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

/** Drive the player's car one step. Returns events: {crashed, hitPed}. */
export function drivePlayerCar(state, car, input, dt) {
  const axes = input.axes();
  const forward = axes.y < 0;
  const back = axes.y > 0;
  const steer = axes.x;
  const top = car.police ? 660 : Math.min(car.model.top, CAR.maxSpeed);
  const onRoad = isOnRoad(car.x, car.y);
  const drag = onRoad ? CAR.drag : CAR.offRoadDrag;

  if (forward) car.speed += CAR.accel * dt;
  else if (back) car.speed -= (car.speed > 0 ? CAR.brake : CAR.reverseAccel) * dt * (car.speed > 0 ? 1 : 1);
  else {
    // Coast down.
    car.speed -= car.speed * drag * dt;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  if (input.handbrake) {
    car.speed -= car.speed * 3.2 * dt;
    if (Math.abs(car.speed) > 120) spawnSkid(state, car);
  }
  car.speed = Math.max(-CAR.maxReverse, Math.min(top, car.speed));
  // Steering only bites while moving; reverse flips it, like a real car.
  const speedRatio = Math.min(1, Math.abs(car.speed) / 300);
  const steerAmount = steer * CAR.turnRate * speedRatio * dt * (car.speed < 0 ? -1 : 1);
  car.angle += steerAmount * (input.handbrake ? 1.5 : 1);

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const pushed = collideBuildings(state.city, nx, ny, CAR.radius);
  let crashed = false;
  if (pushed.hit && Math.abs(car.speed) > 90) {
    crashed = true;
    car.hp -= Math.min(24, Math.abs(car.speed) * 0.03);
    car.speed *= -0.25;
    state.audio.crash();
    spawnCrash(state, pushed.x, pushed.y);
  } else if (pushed.hit) {
    car.speed *= 0.4;
  }
  car.x = Math.max(40, Math.min(WORLD.width - 40, pushed.x));
  car.y = Math.max(40, Math.min(WORLD.height - 40, pushed.y));

  // Ramming pedestrians and other cars.
  let hitPed = false;
  for (const ped of state.peds) {
    if (ped.dead) continue;
    const d = Math.hypot(ped.x - car.x, ped.y - car.y);
    if (d < 30 && Math.abs(car.speed) > 60) {
      ped.dead = true;
      ped.fall = 1;
      hitPed = true;
      state.stats.pedsHit += 1;
      spawnCrash(state, ped.x, ped.y);
    } else if (d < 30) {
      // Nudge them out of the way at crawl speed.
      const a = Math.atan2(ped.y - car.y, ped.x - car.x);
      ped.x += Math.cos(a) * 60 * dt;
      ped.y += Math.sin(a) * 60 * dt;
    }
  }
  for (const other of state.cars) {
    if (other === car || other.police) continue;
    const d = Math.hypot(other.x - car.x, other.y - car.y);
    if (d < 44 && Math.abs(car.speed) > 40) {
      other.speed = car.speed * 0.4;
      other.traffic = true;
      other.parked = false;
      car.speed *= 0.85;
      state.audio.crash();
      spawnCrash(state, (car.x + other.x) / 2, (car.y + other.y) / 2);
    }
  }
  if (car.hp < 45) {
    car.smoke += dt;
    if (car.smoke > 0.12) {
      car.smoke = 0;
      state.particles.push({ kind: 'smoke', x: car.x, y: car.y, vx: 0, vy: -30, life: 0.9, max: 0.9 });
    }
  }
  return { crashed, hitPed };
}

/** One traffic step for a single car: follow its road, turn at intersections. */
export function stepTrafficCar(state, car, dt, rng) {
  if (car.police) return;
  car.turnCooldown -= dt;
  const ahead = car.speed * dt;
  let nx = car.x + Math.cos(car.angle) * ahead;
  let ny = car.y + Math.sin(car.angle) * ahead;
  // At an intersection, sometimes turn onto the crossing road.
  const onAvenue = AVENUES.some((ax) => Math.abs(car.x - ax) < 14);
  const onStreet = [260, 580, 900, 1220, 1540, 1860, 2140].some((sy) => Math.abs(car.y - sy) < 14);
  if (onAvenue && onStreet && car.turnCooldown <= 0 && rng.next() < 0.02) {
    car.turnCooldown = 4 + rng.next() * 4;
    const line = nearestRoadLine(car.x, car.y);
    // Pick the crossing line and a direction along it.
    if (line.axis === 'x') {
      car.axis = 'y';
      car.line = car.y;
      car.dir = rng.next() < 0.5 ? 1 : -1;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.axis = 'x';
      car.line = car.x;
      car.dir = rng.next() < 0.5 ? 1 : -1;
      car.angle = car.dir > 0 ? 0 : Math.PI;
    }
    nx = car.x;
    ny = car.y;
  }
  // Stay glued to the lane: drift back toward the road line.
  if (car.axis === 'x') ny += (car.line - ny) * 0.06;
  else nx += (car.line - nx) * 0.06;
  // Slow for the car ahead.
  let slow = false;
  for (const other of state.cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (along > 0 && along < 90 && side < 30) { slow = true; break; }
  }
  const target = slow ? 0 : 150 + (car.id % 5) * 18;
  car.speed += (target - car.speed) * Math.min(1, dt * 1.2);
  const pushed = collideBuildings(state.city, nx, ny, CAR.radius);
  if (pushed.hit) {
    // A building in the way: turn around.
    car.angle += Math.PI;
    car.axis = car.axis === 'x' ? 'y' : 'x';
    car.line = car.axis === 'x' ? car.y : car.x;
  }
  car.x = Math.max(30, Math.min(WORLD.width - 30, pushed.x));
  car.y = Math.max(30, Math.min(WORLD.height - 30, pushed.y));
}

/** Keep traffic dense near the player: respawn far cars on nearby roads. */
export function maintainTraffic(state, rng) {
  const p = state.player;
  let trafficCount = 0;
  for (const car of state.cars) {
    if (car.traffic && !car.police) trafficCount += 1;
  }
  for (const car of state.cars) {
    if (!car.traffic || car.police) continue;
    if (Math.hypot(car.x - p.x, car.y - p.y) > 1500) {
      const pt = randomRoadPoint(rng, p.x, p.y, 600);
      const line = nearestRoadLine(pt.x, pt.y);
      car.x = pt.x;
      car.y = pt.y;
      car.axis = line.axis;
      car.line = line.at;
      car.dir = rng.next() < 0.5 ? 1 : -1;
      car.angle = line.axis === 'x' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      car.speed = 150;
    }
  }
  if (trafficCount < 18) {
    const pt = randomRoadPoint(rng, p.x, p.y, 700);
    const line = nearestRoadLine(pt.x, pt.y);
    const car = makeCar(rng, pt.x, pt.y, line.axis === 'x' ? 0 : Math.PI / 2, { traffic: true, axis: line.axis, line: line.at, dir: 1 });
    car.speed = 160;
    state.cars.push(car);
  }
}

function spawnSkid(state, car) {
  state.particles.push({
    kind: 'skid', x: car.x - Math.cos(car.angle) * 20, y: car.y - Math.sin(car.angle) * 20,
    vx: 0, vy: 0, life: 0.5, max: 0.5,
  });
}

function spawnCrash(state, x, y) {
  for (let i = 0; i < 8; i += 1) {
    const a = Math.random() * Math.PI * 2;
    state.particles.push({ kind: 'spark', x, y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, life: 0.4, max: 0.4 });
  }
}
