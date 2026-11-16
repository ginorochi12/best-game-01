// NEON DRIFT — keyboard and mouse state. The world reads this every frame;
// the main loop turns edges (pressed this frame) into actions.

export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_MUTE = 'mute';
export const ACTION_RESTART = 'restart';

/**
 * Create the input state for a canvas. Mouse coordinates are converted to the
 * canvas's logical space (the canvas is scaled by CSS, so client pixels are
 * mapped back through its bounding rect).
 * @param {HTMLCanvasElement} canvas
 */
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 480, y: 300, down: false, clicked: false, clickX: 0, clickY: 0 };

  function toLogical(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function onKeyDown(event) {
    const key = event.key.toLowerCase();
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      event.preventDefault();
    }
    if (!keys.has(key)) pressed.add(key);
    keys.add(key);
  }

  function onKeyUp(event) {
    keys.delete(event.key.toLowerCase());
  }

  function onMouseMove(event) {
    const p = toLogical(event);
    mouse.x = p.x;
    mouse.y = p.y;
  }

  function onMouseDown(event) {
    if (event.button !== 0) return;
    const p = toLogical(event);
    mouse.down = true;
    mouse.clicked = true;
    mouse.clickX = p.x;
    mouse.clickY = p.y;
  }

  function onMouseUp(event) {
    if (event.button === 0) mouse.down = false;
  }

  function onBlur() {
    keys.clear();
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    /** Held movement vector, normalized (x right, y down). */
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('arrowleft')) x -= 1;
      if (keys.has('d') || keys.has('arrowright')) x += 1;
      if (keys.has('w') || keys.has('arrowup')) y -= 1;
      if (keys.has('s') || keys.has('arrowdown')) y += 1;
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.SQRT2;
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },
    firing() {
      return mouse.down || keys.has(' ');
    },
    mouse() {
      return mouse;
    },
    /** True if the key went down since the last endFrame(). */
    wasPressed(key) {
      return pressed.has(key.toLowerCase());
    },
    /** True if the mouse was clicked since the last endFrame(). */
    wasClicked() {
      return mouse.clicked;
    },
    /** Named action edges, for menus. */
    actionPressed(action) {
      if (action === ACTION_CONFIRM) return pressed.has('enter') || mouse.clicked;
      if (action === ACTION_PAUSE) return pressed.has('p') || pressed.has('escape');
      if (action === ACTION_MUTE) return pressed.has('m');
      if (action === ACTION_RESTART) return pressed.has('r') || pressed.has('enter');
      return false;
    },
    /** Digit keys 1-9 pressed this frame (for upgrade choices). */
    digitPressed() {
      for (let d = 1; d <= 9; d += 1) {
        if (pressed.has(String(d))) return d;
      }
      return 0;
    },
    /** Clear per-frame edges. Call once per frame, after the world reads them. */
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    },
  };
}
