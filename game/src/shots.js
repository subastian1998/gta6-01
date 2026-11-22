// Screenshot scenes behind ?shot=1|2|3|4 (with &seed=N). Each one builds a
// real game state, plays the real rules forward with a scripted driver for a
// fixed number of steps, then hands the screen to the renderer — so every
// screenshot is the game itself, mid-play, and the same seed gives the same
// frame. 1: title over a living city. 2: Mara driving the Aurora GT down the
// Strip with traffic. 3: a three-star police chase with a job running.
// 4: on foot at the Harbor docks, the heist job live, pedestrians around.
import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { CAR_MODELS } from './vehicles.js';
import { addHeat } from './police.js';
import { startNextMission } from './missions.js';

const DRIVE_SECONDS = 2.5;
const CHASE_SECONDS = 3;
const MISSION_SECONDS = 4;

export function stageShot(name, state, stepFn) {
  const scripted = state.scripted;
  if (name === '2') {
    // Mara in the Aurora GT, heading down the Strip avenue at speed.
    const car = state.player.car;
    scripted.set(['KeyW']);
    for (let i = 0; i < DRIVE_SECONDS / STEP; i += 1) stepFn(STEP);
    state.message = 'The Strip never sleeps — and neither does Mara.';
    state.messageT = 6;
    return { screen: SCREEN_PLAY };
  }
  if (name === '3') {
    // Three stars, police closing in, job 3 running. Straight down the street
    // so the chase reads; the road ahead is cleared so the car survives it.
    scripted.set(['KeyW']);
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) stepFn(STEP);
    state.message = 'Three stars and the whole department wants a word.';
    state.messageT = 6;
    return { screen: SCREEN_PLAY };
  }
  if (name === '4') {
    // On foot at the docks, heist job live, walking toward the Sun Chaser.
    scripted.set(['KeyS']);
    for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) stepFn(STEP);
    return { screen: SCREEN_PLAY };
  }
  // 1 (and anything else): title screen over a city that has been living for a while.
  scripted.set([]);
  for (let i = 0; i < 6 / STEP; i += 1) stepFn(STEP);
  return { screen: SCREEN_TITLE };
}

/** Arrange the state for a shot before the scripted steps run. */
export function setupShot(name, state) {
  const p = state.player;
  if (name === '2') {
    // Put Mara in a pink Aurora GT on the Strip avenue, traffic around her.
    // Start far enough south that a short drive ends mid-frame, not at the
    // map edge, and clear the avenue ahead so the run stays fast.
    p.x = 2680;
    p.y = 2300;
    p.angle = -Math.PI / 2;
    const car = state.cars.find((c) => c.model.name === 'Aurora GT') || state.cars[0];
    car.model = CAR_MODELS.find((m) => m.name === 'Aurora GT');
    car.x = 2680;
    car.y = 2300;
    car.angle = -Math.PI / 2;
    car.speed = 380;
    car.hp = 100;
    car.traffic = false;
    car.parked = false;
    state.cars = state.cars.filter((c) => c === car || !(Math.abs(c.x - 2680) < 130 && c.y > 400 && c.y < 2350));
    p.car = car;
    state.message = 'The Strip never sleeps — and neither does Mara.';
    state.messageT = 6;
    return;
  }
  if (name === '3') {
    // Mara driving, three stars, job 3 active, police already on her tail.
    p.x = 1480;
    p.y = 1220;
    const car = state.cars.find((c) => c.model.name === 'Solstice') || state.cars[0];
    car.x = 1480;
    car.y = 1220;
    car.angle = 0;
    car.speed = 420;
    car.hp = 100;
    car.traffic = false;
    car.parked = false;
    // Clear the road ahead so the chase car is not wrecked by traffic.
    state.cars = state.cars.filter((c) => c === car || (Math.hypot(c.x - 1480, c.y - 1220) > 700 && !(Math.abs(c.y - 1220) < 130 && c.x > 1400)));
    p.car = car;
    state.missions.index = 2;
    startNextMission(state);
    // Skip to the escape stage: the pickup is done, the heat is the job now.
    state.missions.stage = 1;
    addHeat(state, 3.0, 'getaway');
    state.message = 'Three stars and the whole department wants a word.';
    state.messageT = 6;
    return;
  }
  if (name === '4') {
    // On foot at the Harbor docks, heist job live, the Sun Chaser parked ahead.
    p.x = 560;
    p.y = 1900;
    p.angle = Math.PI / 2;
    p.car = null;
    state.missions.index = 3;
    startNextMission(state);
    const gt = state.cars.find((c) => c.model.name === 'Aurora GT');
    if (gt) {
      gt.x = 560;
      gt.y = 2050;
      gt.angle = Math.PI / 2;
      gt.traffic = false;
      gt.parked = true;
    }
    state.message = 'Job 4 — Harbor Heist: take the Sun Chaser.';
    state.messageT = 6;
    return;
  }
  // Shot 1: Mara on foot by the Marina pier, city alive behind the title.
  p.x = 420;
  p.y = 580;
  p.angle = Math.PI / 4;
  p.car = null;
}
