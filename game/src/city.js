// Solmar Bay — the city itself: a sun-soaked coastal grid with a beach on the
// west, a harbour in the south-west, a marina in the north-west, Old Town in the
// centre, the neon Strip in the north-east and leafy Uptown in the south-east.
// Buildings, parks, trees and parking lots are generated once from a fixed seed,
// so the map is identical every visit. Everything here is pure geometry: no
// drawing, no input, just answers other modules ask about the map.
import { AVENUES, DISTRICTS, ROAD_W, WORLD } from './config.js';
import { createRandom } from './random.js';

export const STREETS_LIST = [260, 580, 900, 1220, 1540, 1860, 2140];

/** True when the point is on a road surface (avenue or street). */
export function isOnRoad(x, y) {
  const half = ROAD_W / 2;
  for (const ax of AVENUES) if (Math.abs(x - ax) <= half) return true;
  for (const sy of STREETS_LIST) if (Math.abs(y - sy) <= half) return true;
  return false;
}

/** True when the point is on the beach strip or in the sea, west of the city. */
export function isBeach(x) {
  return x < 200;
}

/** The district a point sits in, for the HUD location label. */
export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  }
  return DISTRICTS[1];
}

/** Nearest point on any road centreline to (x, y). Used to drop cars and cops on roads. */
export function nearestRoadPoint(x, y) {
  let bestX = x;
  let bestY = y;
  let bestD = Infinity;
  for (const ax of AVENUES) {
    const d = Math.abs(x - ax);
    if (d < bestD) { bestD = d; bestX = ax; bestY = y; }
  }
  for (const sy of STREETS_LIST) {
    const d = Math.abs(y - sy);
    if (d < bestD) { bestD = d; bestX = x; bestY = sy; }
  }
  return { x: bestX, y: bestY };
}

/** The nearest avenue or street line, as {axis:'x'|'y', at:number}. */
export function nearestRoadLine(x, y) {
  let best = { axis: 'x', at: AVENUES[0] };
  let bestD = Infinity;
  for (const ax of AVENUES) {
    const d = Math.abs(x - ax);
    if (d < bestD) { bestD = d; best = { axis: 'x', at: ax }; }
  }
  for (const sy of STREETS_LIST) {
    const d = Math.abs(y - sy);
    if (d < bestD) { bestD = d; best = { axis: 'y', at: sy }; }
  }
  return best;
}

/**
 * Build the static city: buildings (with height for shading, roof colour and a
 * name for the rare labelled landmark), parks, trees, parking lots and the
 * harbour cranes. Deterministic from the seed, so screenshots reproduce.
 */
export function buildCity(seed = 20261122) {
  const rng = createRandom(seed);
  const buildings = [];
  const parks = [];
  const trees = [];
  const lots = [];
  const roofColors = ['#c96f4a', '#4a7a9e', '#8a6fb0', '#b0a06a', '#5e8a6a', '#a34a5e', '#7a6a9e'];
  const half = ROAD_W / 2 + 14;

  const xs = [200, ...AVENUES, WORLD.width];
  const ys = [0, ...STREETS_LIST, WORLD.height];
  for (let bi = 0; bi < xs.length - 1; bi += 1) {
    for (let bj = 0; bj < ys.length - 1; bj += 1) {
      const x0 = xs[bi] + (bi === 0 ? 0 : half);
      const x1 = xs[bi + 1] - half;
      const y0 = ys[bj] + (bj === 0 ? 8 : half);
      const y1 = ys[bj + 1] - half;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      if (x0 < 210) continue; // beach strip stays open sand
      const roll = rng.next();
      if (roll < 0.16) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const n = 3 + Math.floor(rng.next() * 5);
        for (let i = 0; i < n; i += 1) {
          trees.push({ x: x0 + 20 + rng.next() * (x1 - x0 - 40), y: y0 + 20 + rng.next() * (y1 - y0 - 40), r: 12 + rng.next() * 10 });
        }
        continue;
      }
      if (roll < 0.24) {
        lots.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      // One or two buildings per block, with a small yard gap.
      const split = rng.next() < 0.45 && (x1 - x0) > 260;
      const parts = split
        ? [{ x: x0, w: (x1 - x0) * 0.46 }, { x: x0 + (x1 - x0) * 0.54, w: (x1 - x0) * 0.46 }]
        : [{ x: x0 + 8, w: x1 - x0 - 16 }];
      for (const part of parts) {
        const tall = rng.next() < 0.22;
        buildings.push({
          x: part.x,
          y: y0 + 8,
          w: part.w,
          h: y1 - y0 - 16,
          height: tall ? 3 : 1 + Math.floor(rng.next() * 2),
          roof: roofColors[Math.floor(rng.next() * roofColors.length)],
          windows: tall,
        });
      }
      if (rng.next() < 0.5) {
        trees.push({ x: x0 + 16 + rng.next() * (x1 - x0 - 32), y: y0 + 16 + rng.next() * (y1 - y0 - 32), r: 10 + rng.next() * 8 });
      }
    }
  }

  // Landmarks: the marina lighthouse, the harbour cranes, the Strip's neon tower.
  const landmarks = [
    { name: 'Solmar Lighthouse', x: 120, y: 120, w: 46, h: 46, roof: '#f5f1e6', height: 4, windows: false },
    { name: 'Harbor Crane 1', x: 420, y: 2180, w: 30, h: 90, roof: '#e8a04c', height: 3, windows: false },
    { name: 'Harbor Crane 2', x: 640, y: 2220, w: 30, h: 90, roof: '#e8a04c', height: 3, windows: false },
    { name: 'Neon Tower', x: 2760, y: 300, w: 120, h: 120, roof: '#e85d8a', height: 4, windows: true },
    { name: 'Solmar Grand Hotel', x: 2360, y: 980, w: 150, h: 110, roof: '#4a7a9e', height: 4, windows: true },
  ];

  return { buildings, parks, trees, lots, landmarks };
}

/** Push a circle (x, y, r) out of every building/landmark it overlaps. Returns true if it hit one. */
export function collideBuildings(city, x, y, r) {
  let hit = false;
  const all = city.buildings.concat(city.landmarks);
  for (const b of all) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (r - d) / d;
        x += dx * push;
        y += dy * push;
      } else {
        y -= r;
      }
    }
  }
  return { x, y, hit };
}

/** True when a circle overlaps a building (cheap check for traffic and bullets). */
export function hitsBuilding(city, x, y, r) {
  const all = city.buildings.concat(city.landmarks);
  for (const b of all) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  return false;
}

/** A random point on a road, at least `minDist` from (px, py) when given. */
export function randomRoadPoint(rng, px = null, py = null, minDist = 0) {
  for (let tries = 0; tries < 40; tries += 1) {
    const vertical = rng.next() < 0.5;
    const x = vertical ? AVENUES[Math.floor(rng.next() * AVENUES.length)] : 240 + rng.next() * (WORLD.width - 480);
    const y = vertical ? 240 + rng.next() * (WORLD.height - 480) : STREETS_LIST[Math.floor(rng.next() * STREETS_LIST.length)];
    if (px !== null && Math.hypot(x - px, y - py) < minDist) continue;
    return { x, y };
  }
  return { x: AVENUES[2], y: STREETS_LIST[2] };
}
