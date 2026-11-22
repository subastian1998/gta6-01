// Missions and the story of Solmar Bay. Mara Voss, 28, drove delivery vans
// until the company folded; now she runs jobs for Dario Kestrel, a fixer who
// works out of a garage in Old Town and pays in cash, no questions. Six jobs
// take her across the city — a fare, a delivery, a getaway, a heist, a heat
// wave and a final run that decides whether she owns the Bay or owes it.
// Each mission is a list of stages; a stage completes when the player reaches
// its marker, enters the right car, or survives its timer. Press M (or the
// prompt) to start the next job; finishing one pays cash and unlocks the next.
export const MISSIONS = [
  {
    id: 'fare',
    title: 'Job 1 — First Fare',
    giver: 'Dario Kestrel',
    brief: 'Dario needs wheels and a driver. Steal any car on the street and bring it to the garage in Old Town.',
    reward: 400,
    stages: [
      { kind: 'stealCar', text: 'Steal a car — walk up to one and press E', marker: null },
      { kind: 'reach', text: 'Drive to Dario\u2019s garage in Old Town', x: 1080, y: 900, radius: 90 },
    ],
  },
  {
    id: 'delivery',
    title: 'Job 2 — Hot Delivery',
    giver: 'Dario Kestrel',
    brief: 'A package for the Marina, and the buyer does not wait. Pick it up at the garage, then deliver it to the lighthouse pier within 90 seconds.',
    reward: 650,
    stages: [
      { kind: 'reach', text: 'Pick up the package at Dario\u2019s garage', x: 1080, y: 900, radius: 90 },
      { kind: 'reach', text: 'Deliver to the Marina pier — 90 seconds!', x: 180, y: 260, radius: 90, timer: 90 },
    ],
  },
  {
    id: 'getaway',
    title: 'Job 3 — The Getaway',
    giver: 'Lena Sol',
    brief: 'Lena Sol lifted a ledger from the Strip and the police are already rolling. Pick her up at the Neon Tower, then lose the heat and reach the Uptown safehouse.',
    reward: 900,
    stages: [
      { kind: 'reach', text: 'Pick up Lena Sol at the Neon Tower', x: 2820, y: 360, radius: 100 },
      { kind: 'heat', text: 'The police are on you — lose them!', heat: 2.0 },
      { kind: 'reach', text: 'Reach the Uptown safehouse', x: 2500, y: 1900, radius: 110 },
    ],
  },
  {
    id: 'heist',
    title: 'Job 4 — Harbor Heist',
    giver: 'Dario Kestrel',
    brief: 'The Aurora GT “Sun Chaser” sits in the Harbor District under one sleepy guard. Take it — quietly or loudly — and bring it to the garage.',
    reward: 1400,
    stages: [
      { kind: 'reach', text: 'Reach the Harbor District docks', x: 560, y: 2050, radius: 110 },
      { kind: 'stealModel', text: 'Steal the Aurora GT “Sun Chaser”', model: 'Aurora GT' },
      { kind: 'reach', text: 'Bring the Sun Chaser to Dario\u2019s garage', x: 1080, y: 900, radius: 90 },
    ],
  },
  {
    id: 'heatwave',
    title: 'Job 5 — Heat Wave',
    giver: 'Lena Sol',
    brief: 'Three stars and the whole department wants a word. Survive the heat for 60 seconds — drive fast, use the alleys, do not get boxed in.',
    reward: 1200,
    stages: [
      { kind: 'heat', text: 'Get the police on your tail — cause some trouble!', heat: 3.0 },
      { kind: 'survive', text: 'Survive the heat — stay free for 60 seconds', timer: 60 },
    ],
  },
  {
    id: 'king',
    title: 'Job 6 — King of Solmar',
    giver: 'Dario Kestrel',
    brief: 'One last run: three drops across the Bay — the Strip, the Marina, the Harbor — then back to the garage before sunrise. Finish this and the city is yours.',
    reward: 2500,
    stages: [
      { kind: 'reach', text: 'Drop 1 of 3 — the Strip, Neon Tower', x: 2820, y: 360, radius: 100 },
      { kind: 'reach', text: 'Drop 2 of 3 — the Marina pier', x: 180, y: 260, radius: 100 },
      { kind: 'reach', text: 'Drop 3 of 3 — the Harbor docks', x: 560, y: 2050, radius: 100 },
      { kind: 'reach', text: 'Return to Dario\u2019s garage — finish the run', x: 1080, y: 900, radius: 90 },
    ],
  },
];

export const GARAGE = { x: 1080, y: 900 };

/** Fresh mission runtime state. */
export function createMissions() {
  return { index: 0, done: [], active: null, stage: 0, stageT: 0, message: '' };
}

/** Start the next uncompleted mission. Returns the mission or null when all are done. */
export function startNextMission(state) {
  const m = state.missions;
  if (m.index >= MISSIONS.length) return null;
  const mission = MISSIONS[m.index];
  m.active = mission;
  m.stage = 0;
  m.stageT = 0;
  state.message = `${mission.title} — ${mission.brief}`;
  state.messageT = 6;
  state.audio.mission();
  return mission;
}

/** The marker the HUD and minimap should point at, or null. */
export function currentMarker(state) {
  const m = state.missions;
  if (!m.active) return null;
  const stage = m.active.stages[m.stage];
  if (!stage) return null;
  if (stage.kind === 'reach') return { x: stage.x, y: stage.y, radius: stage.radius };
  if (stage.kind === 'stealModel') return { x: 560, y: 2050, radius: 140 };
  return null;
}

/**
 * Advance the active mission one step. Returns 'complete' when the mission
 * finishes, 'stage' when a stage finishes, or null. Handles timers, heat
 * goals and reach goals; steal goals are completed by the main loop calling
 * completeStealStage when the player enters the right car.
 */
export function stepMission(state, dt) {
  const m = state.missions;
  if (!m.active) return null;
  const stage = m.active.stages[m.stage];
  if (!stage) return null;
  const p = state.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;

  if (stage.kind === 'reach') {
    if (stage.timer !== undefined) {
      if (m.stageT === 0) m.stageT = stage.timer;
      m.stageT -= dt;
      if (m.stageT <= 0) {
        failMission(state, 'Too slow — the buyer walked away.');
        return 'failed';
      }
    }
    const d = Math.hypot(px - stage.x, py - stage.y);
    if (d < stage.radius) return advanceStage(state);
  } else if (stage.kind === 'heat') {
    if (state.wantedHeat >= stage.heat) return advanceStage(state);
  } else if (stage.kind === 'survive') {
    if (state.wanted <= 0) {
      failMission(state, 'The heat died too soon — the job needs a real chase.');
      return 'failed';
    }
    if (m.stageT === 0) m.stageT = stage.timer;
    m.stageT -= dt;
    if (m.stageT <= 0) return advanceStage(state);
  } else if (stage.kind === 'stealCar') {
    if (p.car) return advanceStage(state);
  }
  return null;
}

/** Called when the player enters a car during a stealModel stage. */
export function completeStealStage(state, car) {
  const m = state.missions;
  if (!m.active) return false;
  const stage = m.active.stages[m.stage];
  if (!stage) return false;
  if (stage.kind === 'stealModel' && car.model.name === stage.model) {
    advanceStage(state);
    return true;
  }
  return false;
}

function advanceStage(state) {
  const m = state.missions;
  m.stage += 1;
  m.stageT = 0;
  if (m.stage >= m.active.stages.length) {
    const mission = m.active;
    m.done.push(mission.id);
    state.player.money += mission.reward;
    state.stats.missionsDone += 1;
    state.message = `${mission.title} complete — $${mission.reward} in the pocket.`;
    state.messageT = 5;
    state.audio.mission();
    m.active = null;
    m.index += 1;
    return 'complete';
  }
  const next = m.active.stages[m.stage];
  state.message = next.text;
  state.messageT = 4;
  return 'stage';
}

function failMission(state, reason) {
  const m = state.missions;
  state.message = `${m.active.title} failed — ${reason} Press M to retry.`;
  state.messageT = 6;
  m.active = null;
  m.stage = 0;
  m.stageT = 0;
}
