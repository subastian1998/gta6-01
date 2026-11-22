// Keyboard + mouse input. WASD/arrows move and drive, Shift sprints, E enters
// and leaves cars, Space is the handbrake, mouse aims and click shoots, M starts
// the next mission, P pauses, R restarts after Busted/Wasted. Keys are tracked
// as a live set; edge-triggered actions (pressed once) are consumed by takeActions.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_MISSION = 8;
export const ACTION_RESTART = 16;
export const ACTION_HANDBRAKE = 32;
export const ACTION_SPRINT = 64;

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  Space: ACTION_CONFIRM,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyE: ACTION_ENTER_CAR,
  KeyM: ACTION_MISSION,
  KeyR: ACTION_RESTART,
};

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseClicked = false;

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (!event.repeat) {
      const action = KEY_ACTIONS[event.code];
      if (action) actions |= action;
    }
    keys.add(event.code);
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  }
  function onMouseDown(event) {
    onMouseMove(event);
    mouseDown = true;
    mouseClicked = true;
    if (event.button === 0) actions |= ACTION_CONFIRM;
  }
  function onMouseUp() {
    mouseDown = false;
  }
  function onBlur() {
    keys.clear();
    mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    /** Move axes from WASD/arrows: x right, y down, each -1, 0 or 1. */
    axes() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      return { x, y };
    },
    isDown(code) {
      return keys.has(code);
    },
    get sprint() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    get handbrake() {
      return keys.has('Space');
    },
    get mouse() {
      return { x: mouseX, y: mouseY, down: mouseDown };
    },
    /** True once per click; consumed by the caller. */
    takeClick() {
      const clicked = mouseClicked;
      mouseClicked = false;
      return clicked;
    },
    /** Edge-triggered actions since the last call, as a bitmask. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}

/** A scripted input source for screenshots and tests: drives like a held key set. */
export function createScriptedInput() {
  const keys = new Set();
  return {
    set(list) {
      keys.clear();
      for (const k of list) keys.add(k);
    },
    axes() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA')) x -= 1;
      if (keys.has('KeyD')) x += 1;
      if (keys.has('KeyW')) y -= 1;
      if (keys.has('KeyS')) y += 1;
      return { x, y };
    },
    isDown(code) { return keys.has(code); },
    get sprint() { return keys.has('ShiftLeft'); },
    get handbrake() { return keys.has('Space'); },
    get mouse() { return { x: 640, y: 300, down: false }; },
    takeClick() { return false; },
    takeActions() { return 0; },
  };
}
