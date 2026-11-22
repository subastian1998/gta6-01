// Solmar Bay — tuning, palette and world constants. One place for every number
// the rest of the game reads, so balancing never means hunting through logic.
export const STEP = 1 / 60;
export const WORLD = { width: 3200, height: 2400 };
export const SAVE_KEY = 'solmar-bay.save.v1';

// The city grid: avenues run north-south, streets east-west. Road width 96.
export const AVENUES = [280, 680, 1080, 1480, 1880, 2280, 2680, 3000];
export const STREETS = [260, 580, 900, 1220, 1540, 1860, 2140];
export const ROAD_W = 96;

export const PLAYER = {
  radius: 14,
  walkSpeed: 230,
  sprintSpeed: 330,
  maxHp: 100,
  punchDamage: 12,
};

export const CAR = {
  accel: 520,
  reverseAccel: 320,
  maxSpeed: 640,
  maxReverse: 220,
  turnRate: 2.6,
  brake: 900,
  drag: 0.55,
  offRoadDrag: 2.2,
  radius: 22,
};

export const WANTED = {
  decayPerSec: 0.045,
  stealCar: 1.0,
  hitPed: 1.0,
  shoot: 0.6,
  ramCop: 1.0,
  maxStars: 5,
};

export const DISTRICTS = [
  { name: 'Marina Bay', x0: 0, y0: 0, x1: 520, y1: 1080, tint: '#3fa7c4' },
  { name: 'Old Town', x0: 520, y0: 0, x1: 1680, y1: 1080, tint: '#e8a04c' },
  { name: 'The Strip', x0: 1680, y0: 0, x1: 3200, y1: 1080, tint: '#e85d8a' },
  { name: 'Harbor District', x0: 0, y0: 1080, x1: 1200, y1: 2400, tint: '#7a8a99' },
  { name: 'Uptown', x0: 1200, y0: 1080, x1: 3200, y1: 2400, tint: '#5aa86e' },
];

export const PALETTE = {
  grass: '#7fae5a',
  grassDark: '#74a24f',
  sand: '#e8d29a',
  sea: '#2f8fc4',
  seaDeep: '#1f6fa3',
  road: '#3a3f47',
  roadEdge: '#2c3038',
  lane: '#e8d44d',
  sidewalk: '#b9b3a4',
  buildingRoof: ['#c96f4a', '#4a7a9e', '#8a6fb0', '#b0a06a', '#5e8a6a', '#a34a5e'],
  buildingWall: '#8f8578',
  park: '#5d9e4a',
  tree: '#3f7d33',
  treeLight: '#57a047',
  player: '#f2c94c',
  cop: '#2b6cb0',
  hudBg: 'rgba(12, 16, 24, 0.72)',
  text: '#f5f1e6',
  muted: '#c9c2b2',
  gold: '#f2c94c',
  red: '#e5534b',
  blue: '#4fc3f7',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const FONT_DISPLAY = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
