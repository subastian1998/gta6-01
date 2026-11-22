// Pedestrians: the people of Solmar Bay. They stroll the sidewalks and the
// beach, pause to look at the sea, and flee — screaming, in the renderer's
// case just running — when a car bears down on them or a gun goes off. A few
// carry cash: bump into a fleeing pedestrian and they may drop a few dollars.
import { WORLD } from './config.js';
import { collideBuildings, isOnRoad } from './city.js';
import { createRandom } from './random.js';

const SHIRTS = ['#e85d8a', '#4fc3f7', '#f2c94c', '#9b7ede', '#e8a04c', '#5aa86e', '#e5534b', '#f5f1e6'];
const PANTS = ['#2b3a4a', '#4a3a2b', '#3a4a2b', '#5a5a6e'];

let nextPedId = 1;

/** Make one pedestrian near (x, y). */
export function makePed(rng, x, y) {
  return {
    id: nextPedId,
    x,
    y,
    angle: rng.next() * Math.PI * 2,
    speed: 40 + rng.next() * 30,
    shirt: SHIRTS[Math.floor(rng.next() * SHIRTS.length)],
    pants: PANTS[Math.floor(rng.next() * PANTS.length)],
    walkPhase: rng.next() * Math.PI * 2,
    state: 'walk', // walk | idle | flee
    stateT: 1 + rng.next() * 4,
    dead: false,
    fall: 0,
    targetX: x,
    targetY: y,
  };
}

/** Seed the opening crowd around the player. */
export function seedPeds(state, rng) {
  state.peds = [];
  const p = state.player;
  for (let i = 0; i < 34; i += 1) {
    const a = rng.next() * Math.PI * 2;
    const d = 120 + rng.next() * 700;
    const x = Math.max(60, Math.min(WORLD.width - 60, p.x + Math.cos(a) * d));
    const y = Math.max(60, Math.min(WORLD.height - 60, p.y + Math.sin(a) * d));
    state.peds.push(makePed(rng, x, y));
  }
}

/** Scare every pedestrian near (x, y): they run away from the noise. */
export function scarePeds(state, x, y, radius = 260) {
  for (const ped of state.peds) {
    if (ped.dead) continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius) {
      ped.state = 'flee';
      ped.stateT = 2 + Math.random() * 2;
      ped.angle = Math.atan2(ped.y - y, ped.x - x);
    }
  }
}

export function stepPeds(state, dt, rng) {
  const p = state.player;
  for (const ped of state.peds) {
    if (ped.dead) {
      ped.fall = Math.min(1, ped.fall + dt * 3);
      continue;
    }
    ped.stateT -= dt;
    ped.walkPhase += dt * (ped.state === 'flee' ? 14 : 7);
    if (ped.stateT <= 0) {
      if (ped.state === 'flee') {
        ped.state = 'walk';
        ped.stateT = 2 + rng.next() * 5;
      } else if (rng.next() < 0.25) {
        ped.state = 'idle';
        ped.stateT = 1 + rng.next() * 3;
      } else {
        ped.state = 'walk';
        ped.stateT = 2 + rng.next() * 5;
        // Pick a new heading that keeps them off the road when possible.
        ped.angle = rng.next() * Math.PI * 2;
      }
    }
    if (ped.state === 'idle') continue;
    const speed = ped.state === 'flee' ? ped.speed * 3.2 : ped.speed;
    // Fleeing peds run from the player; walkers drift and avoid roads.
    let angle = ped.angle;
    if (ped.state === 'walk' && isOnRoad(ped.x, ped.y) && rng.next() < 0.05) {
      angle = ped.angle + Math.PI / 2;
      ped.angle = angle;
    }
    const nx = ped.x + Math.cos(angle) * speed * dt;
    const ny = ped.y + Math.sin(angle) * speed * dt;
    const pushed = collideBuildings(state.city, nx, ny, 10);
    ped.x = Math.max(50, Math.min(WORLD.width - 50, pushed.x));
    ped.y = Math.max(50, Math.min(WORLD.height - 50, pushed.y));
    if (pushed.hit) ped.angle += Math.PI / 2;
  }
  // Keep the crowd near the player: recycle distant peds to nearby sidewalks.
  for (const ped of state.peds) {
    if (Math.hypot(ped.x - p.x, ped.y - p.y) > 1300) {
      const a = Math.random() * Math.PI * 2;
      const d = 300 + Math.random() * 500;
      ped.x = Math.max(60, Math.min(WORLD.width - 60, p.x + Math.cos(a) * d));
      ped.y = Math.max(60, Math.min(WORLD.height - 60, p.y + Math.sin(a) * d));
      ped.dead = false;
      ped.fall = 0;
      ped.state = 'walk';
    }
  }
}
