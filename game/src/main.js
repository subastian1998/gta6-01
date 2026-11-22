// Boot and the one loop: Solmar Bay. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// Screens: title, play, paused, busted, wasted, done (all six jobs finished).
//
// ?shot=1|2|3|4 (with &seed=N) stages that screenshot scene instead of running
// the loop, paints it twice and sets window.__shotReady for a screenshot.
// window.__solmar exposes the live state for playtests: state, screen and
// helpers to start the game and read the HUD numbers.
import { PLAYER, STEP, WORLD } from './config.js';
import { createRandom } from './random.js';
import { buildCity, collideBuildings } from './city.js';
import { createInput, createScriptedInput, ACTION_CONFIRM, ACTION_ENTER_CAR, ACTION_MISSION, ACTION_PAUSE, ACTION_RESTART } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_DONE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { seedTraffic, maintainTraffic, nearestEnterableCar, drivePlayerCar, stepTrafficCar, CAR_MODELS } from './vehicles.js';
import { seedPeds, stepPeds } from './pedestrians.js';
import { addHeat, maintainPolice, stepFootCop, stepPoliceCar, stepWanted } from './police.js';
import { tryShoot, stepBullets, stepCopFire, stepEnemyBullets } from './combat.js';
import { MISSIONS, createMissions, currentMarker, startNextMission, stepMission, completeStealStage } from './missions.js';
import { readSave, writeSave } from './save.js';
import { setupShot, stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const RESPAWN = { x: 1080, y: 1020 };

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261122;

const canvas = document.getElementById('game');
const status = document.getElementById('status');

/** Build a fresh game state. `save` restores money, jobs and position when given. */
export function createState(rng, save = null) {
  const state = {
    rng,
    city: buildCity(20261122),
    time: 0,
    dayMinutes: 16 * 60 + 40,
    clock: '16:40 · SUNNY',
    player: {
      x: RESPAWN.x, y: RESPAWN.y, angle: -Math.PI / 2,
      hp: PLAYER.maxHp, money: 250, car: null,
      moving: false, aiming: false, shootCooldown: 0, copFireT: 0, invulnT: 0,
    },
    cars: [],
    peds: [],
    cops: [],
    bullets: [],
    pickups: [],
    particles: [],
    wanted: 0,
    wantedHeat: 0,
    wantedTimer: 0,
    bustMeter: 0,
    lastCrime: '',
    missions: createMissions(),
    marker: null,
    message: '',
    messageT: 0,
    muzzle: 0,
    mouse: { x: 640, y: 300 },
    stats: { carsStolen: 0, pedsHit: 0, missionsDone: 0 },
    saveT: 0,
    pickupT: 0,
    audio: null,
    scripted: null,
  };
  if (save) {
    state.player.money = save.money ?? 250;
    state.player.x = save.x ?? RESPAWN.x;
    state.player.y = save.y ?? RESPAWN.y;
    state.player.hp = save.hp ?? PLAYER.maxHp;
    state.missions.done = (save.missionsDone ?? []).slice();
    state.missions.index = save.missionIndex ?? state.missions.done.length;
    state.stats.carsStolen = save.carsStolen ?? 0;
    state.stats.missionsDone = state.missions.done.length;
  }
  seedTraffic(state, rng);
  seedPeds(state, rng);
  seedPickups(state, rng);
  return state;
}

function seedPickups(state, rng) {
  state.pickups = [];
  const kinds = ['cash', 'cash', 'cash', 'health', 'wrench', 'cash', 'health', 'cash'];
  for (let i = 0; i < 14; i += 1) {
    const x = 300 + rng.next() * (WORLD.width - 600);
    const y = 300 + rng.next() * (WORLD.height - 600);
    state.pickups.push({ x, y, kind: kinds[i % kinds.length], taken: false });
  }
}

/** Camera centre in world coords, matching the renderer. */
export function cameraFor(state) {
  const p = state.player;
  const fx = p.car ? p.car.x : p.x;
  const fy = p.car ? p.car.y : p.y;
  return {
    x: Math.max(640, Math.min(WORLD.width - 640, fx)),
    y: Math.max(360, Math.min(WORLD.height - 360, fy)),
  };
}

/** Convert a screen (CSS pixel) mouse position to world coords. */
export function screenToWorld(state, mx, my) {
  const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  const cam = cameraFor(state);
  return { x: cam.x - 640 + mx / scale, y: cam.y - 360 + my / scale };
}

/** One fixed simulation step. `controlPlayer` is false on the title screen. */
export function stepGame(state, input, dt, actions = 0, controlPlayer = true) {
  const p = state.player;
  state.time += dt;
  state.dayMinutes += dt * 0.5;
  const hh = Math.floor(state.dayMinutes / 60) % 24;
  const mm = Math.floor(state.dayMinutes % 60);
  state.clock = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + ' · SUNNY';
  if (state.messageT > 0) state.messageT -= dt;
  if (state.muzzle > 0) state.muzzle -= dt;
  if (p.shootCooldown > 0) p.shootCooldown -= dt;
  if (p.invulnT > 0) p.invulnT -= dt;
  if (p.hp < PLAYER.maxHp) p.hp = Math.min(PLAYER.maxHp, p.hp + dt * 1.5);

  // --- Player ---
  if (controlPlayer) {
    state.mouse = input.mouse;
    if (p.car) {
      const result = drivePlayerCar(state, p.car, input, dt);
      if (result.hitPed) {
        addHeat(state, 1.0, 'pedestrian hit');
        state.message = 'You hit a pedestrian! The cops noticed.';
        state.messageT = 3;
      }
      if (result.crashed) addHeat(state, 0.2, 'crash');
      if (p.car.hp <= 0) {
        explodeCar(state, p.car);
        p.car = null;
        p.hp = Math.max(1, p.hp - 25);
        p.x = Math.max(60, Math.min(WORLD.width - 60, p.x));
      }
      if (actions & ACTION_ENTER_CAR) exitCar(state);
    } else {
      const axes = input.axes();
      const speed = input.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
      const moving = axes.x !== 0 || axes.y !== 0;
      p.moving = moving;
      if (moving) {
        const len = Math.hypot(axes.x, axes.y);
        const nx = p.x + (axes.x / len) * speed * dt;
        const ny = p.y + (axes.y / len) * speed * dt;
        const pushed = collideBuildings(state.city, nx, ny, PLAYER.radius);
        p.x = Math.max(50, Math.min(WORLD.width - 50, pushed.x));
        p.y = Math.max(50, Math.min(WORLD.height - 50, pushed.y));
      }
      // Aim: face the mouse when it has moved recently or is held down.
      const aim = screenToWorld(state, state.mouse.x, state.mouse.y);
      const aimDist = Math.hypot(aim.x - p.x, aim.y - p.y);
      p.aiming = state.mouse.down || aimDist < 420;
      if (p.aiming) p.angle = Math.atan2(aim.y - p.y, aim.x - p.x);
      else if (moving) p.angle = Math.atan2(axes.y, axes.x);
      if (state.mouse.down || input.takeClick()) tryShoot(state, aim.x, aim.y);
      if (actions & ACTION_ENTER_CAR) enterCar(state);
    }
    if (actions & ACTION_MISSION) {
      if (!state.missions.active) {
        const m = startNextMission(state);
        if (!m) state.message = 'All six jobs done — Solmar Bay is yours.';
      }
    }
  }

  // --- Missions ---
  const missionResult = stepMission(state, dt);
  if (missionResult === 'complete' && state.missions.index >= MISSIONS.length) {
    state.allDone = true;
  }
  state.marker = currentMarker(state);

  // --- Traffic, pedestrians, police ---
  for (const car of state.cars) {
    if (car.traffic && !car.police && car !== p.car) stepTrafficCar(state, car, dt, state.rng);
  }
  maintainTraffic(state, state.rng);
  stepPeds(state, dt, state.rng);
  maintainPolice(state, state.rng);
  for (const car of state.cars) {
    if (car.police) stepPoliceCar(state, car, dt);
  }
  for (const cop of state.cops) stepFootCop(state, cop, dt);
  stepWanted(state, dt);
  stepCopFire(state, dt);
  stepBullets(state, dt);
  stepEnemyBullets(state, dt);

  // --- Pickups ---
  for (const pk of state.pickups) {
    if (pk.taken) continue;
    const d = Math.hypot(pk.x - p.x, pk.y - p.y);
    const cd = p.car ? Math.hypot(pk.x - p.car.x, pk.y - p.car.y) : Infinity;
    if (d < 30 || cd < 40) {
      pk.taken = true;
      if (pk.kind === 'cash') {
        const amount = 25 + Math.floor(Math.random() * 75);
        p.money += amount;
        state.message = `Found $${amount} on the street.`;
        state.messageT = 2.5;
      } else if (pk.kind === 'health') {
        p.hp = Math.min(PLAYER.maxHp, p.hp + 40);
        state.message = 'Patched up. +40 HP.';
        state.messageT = 2.5;
      } else if (pk.kind === 'wrench' && p.car) {
        p.car.hp = Math.min(100, p.car.hp + 50);
        state.message = 'Wrench: car repaired +50.';
        state.messageT = 2.5;
      }
      state.audio.pickup();
    }
  }
  state.pickupT += dt;
  if (state.pickupT > 18) {
    state.pickupT = 0;
    const taken = state.pickups.find((pk) => pk.taken);
    if (taken) {
      taken.taken = false;
      taken.x = 300 + Math.random() * (WORLD.width - 600);
      taken.y = 300 + Math.random() * (WORLD.height - 600);
    }
  }

  // --- Particles ---
  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);

  // --- Engine + siren ---
  const speedRatio = p.car ? Math.min(1, Math.abs(p.car.speed) / 600) : 0;
  state.audio.setEngine(speedRatio, !!p.car);
  state.audio.updateSiren(dt, state.wanted);

  // --- Autosave ---
  state.saveT += dt;
  if (state.saveT > 10) {
    state.saveT = 0;
    writeSave(state);
  }
  return missionResult;
}

function enterCar(state) {
  const p = state.player;
  const car = nearestEnterableCar(state, p.x, p.y, 90);
  if (!car) return;
  car.traffic = false;
  car.parked = false;
  car.driver = false;
  if (!car.stolen) {
    car.stolen = true;
    state.stats.carsStolen += 1;
    addHeat(state, 1.0, 'car stolen');
    state.message = `Stolen: ${car.model.name}. The owner will notice.`;
    state.messageT = 3;
  }
  p.car = car;
  p.x = car.x;
  p.y = car.y;
  completeStealStage(state, car);
}

function exitCar(state) {
  const p = state.player;
  const car = p.car;
  if (!car) return;
  p.car = null;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
  p.angle = car.angle;
  car.speed *= 0.3;
  car.parked = true;
}

function explodeCar(state, car) {
  for (let i = 0; i < 16; i += 1) {
    const a = Math.random() * Math.PI * 2;
    state.particles.push({ kind: 'spark', x: car.x, y: car.y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, life: 0.7, max: 0.7 });
    state.particles.push({ kind: 'smoke', x: car.x, y: car.y, vx: 0, vy: -40, life: 1.4, max: 1.4 });
  }
  car.speed = 0;
  car.parked = true;
  car.hp = 0;
  state.audio.crash();
  state.message = 'Your car is wrecked!';
  state.messageT = 3;
}

function respawn(state, reason) {
  const p = state.player;
  p.money = Math.max(0, p.money - 200);
  p.hp = PLAYER.maxHp;
  p.car = null;
  p.x = RESPAWN.x;
  p.y = RESPAWN.y;
  p.angle = -Math.PI / 2;
  state.wanted = 0;
  state.wantedHeat = 0;
  state.bustMeter = 0;
  state.missions.active = null;
  state.missions.stage = 0;
  state.missions.stageT = 0;
  state.cops = [];
  state.cars = state.cars.filter((c) => !c.police);
  state.message = reason;
  state.messageT = 4;
  state.audio.busted();
  writeSave(state);
}

function runShot(name) {
  const rng = createRandom(seed);
  const state = createState(rng);
  state.audio = createAudio();
  state.scripted = createScriptedInput();
  setupShot(name, state);
  const renderer = createRenderer(canvas);
  const scene = stageShot(name, state, (dt) => stepGame(state, state.scripted, dt, 0, true));
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, readSave());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  window.__solmar = { state, get screen() { return scene.screen; } };
  requestAnimationFrame(paint);
}

function runGame() {
  const rng = createRandom(seed);
  const save = readSave();
  const state = createState(rng, save);
  state.audio = createAudio();
  state.scripted = createScriptedInput();
  const input = createInput(canvas);
  const renderer = createRenderer(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  // Edge-triggered actions wait here until a simulation step consumes them:
  // a press that lands on a frame with no step must not be lost.
  let pendingActions = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    state.audio.unlock();
    screen = SCREEN_PLAY;
    announce('Playing Solmar Bay. Press M for your first job.');
  }

  function handleActions() {
    pendingActions |= input.takeActions();
    if (pendingActions & ACTION_CONFIRM) {
      pendingActions &= ~ACTION_CONFIRM;
      state.audio.unlock();
      if (screen === SCREEN_TITLE) startGame();
      else if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED || screen === SCREEN_DONE) {
        screen = SCREEN_PLAY;
        announce('Back on the streets.');
      }
    }
    if (pendingActions & ACTION_RESTART && (screen === SCREEN_BUSTED || screen === SCREEN_WASTED || screen === SCREEN_DONE)) {
      pendingActions &= ~ACTION_RESTART;
      screen = SCREEN_PLAY;
    }
    if (pendingActions & ACTION_PAUSE) {
      pendingActions &= ~ACTION_PAUSE;
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    const controlPlayer = screen === SCREEN_PLAY;
    let firstStep = true;
    while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
      // Edge-triggered actions belong to one step only: pass them to the first
      // step of the frame, or E would enter and exit the car in the same frame.
      // They were held in pendingActions until this step, so a press on a
      // stepless frame still lands.
      const stepActions = firstStep ? pendingActions : 0;
      pendingActions = 0;
      stepGame(state, input, STEP, stepActions, controlPlayer);
      firstStep = false;
      accumulator -= STEP;
      // Busted / wasted checks after each step.
      if (state.bustMeter >= 1 && screen === SCREEN_PLAY) {
        respawn(state, 'Busted — bail posted, $200 gone.');
        screen = SCREEN_BUSTED;
      } else if (state.player.hp <= 0 && screen === SCREEN_PLAY) {
        respawn(state, 'Wasted — Solmar General patches you up, $200 gone.');
        screen = SCREEN_WASTED;
      } else if (state.allDone && screen === SCREEN_PLAY) {
        screen = SCREEN_DONE;
      }
    }
    if (screen !== SCREEN_TITLE && screen !== SCREEN_PLAY) accumulator = 0;
    renderer.draw(state, screen, save);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  window.__solmar = {
    state,
    get screen() { return screen; },
    start: startGame,
  };
  announce('Solmar Bay. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
