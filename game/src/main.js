// NEON DRIFT — boot and the one loop. The world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), the renderer paints
// what is there, and this file owns the screen state machine: title, play,
// paused, level-up choice and game over.
//
// ?seed=N fixes the run's randomness. ?shot=start|play|levelup|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.

import { BEST_KEY, STEP, SLOWMO } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createWorld, updateWorld, chooseUpgrade, PHASE_COMBAT, PHASE_LEVELUP, PHASE_OVER } from './world.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_LEVELUP, SCREEN_OVER } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const audio = createAudio();
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, random);
  let painted = 0;
  function paint() {
    renderer.draw(scene.world, scene.screen, scene.best, scene.isNewBest, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let world = createWorld(random);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let isNewBest = false;
  let muted = false;
  let accumulator = 0;
  let last = performance.now();

  function startRun() {
    world = createWorld(random);
    screen = SCREEN_PLAY;
    isNewBest = false;
    audio.play('click');
  }

  function finishRun() {
    if (world.score > best) {
      best = world.score;
      isNewBest = true;
      saveBest(best);
    }
  }

  /** Upgrade card hit-boxes, matching render.js drawLevelUp layout. */
  function offerAt(x, y) {
    const offers = world.offers ?? [];
    if (offers.length === 0) return -1;
    const cardW = 250;
    const cardH = 190;
    const gap = 24;
    const total = offers.length * cardW + (offers.length - 1) * gap;
    const startX = (960 - total) / 2;
    const cardY = 200;
    if (y < cardY || y > cardY + cardH) return -1;
    for (let i = 0; i < offers.length; i += 1) {
      const cx = startX + i * (cardW + gap);
      if (x >= cx && x <= cx + cardW) return i;
    }
    return -1;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > MAX_FRAME) dt = MAX_FRAME;
    if (dt < 0) dt = 0;

    // Unlock audio on any gesture; mute toggle works on every screen.
    if (input.wasClicked() || input.wasPressed('enter') || input.wasPressed(' ')) audio.unlock();
    if (input.actionPressed(ACTION_MUTE)) {
      muted = !muted;
      audio.setMuted(muted);
    }

    if (screen === SCREEN_TITLE) {
      if (input.actionPressed(ACTION_CONFIRM)) startRun();
      // Idle starfield drift behind the title.
      updateWorld(world, input, dt * 0.2);
    } else if (screen === SCREEN_PLAY) {
      if (input.actionPressed(ACTION_PAUSE)) {
        screen = SCREEN_PAUSED;
        audio.play('click');
      } else if (input.actionPressed(ACTION_RESTART)) {
        startRun();
      } else {
        // Slow-mo scales the simulation when active.
        const scale = world.slowmoTimer > 0 ? SLOWMO.scale : 1;
        accumulator += dt * scale;
        while (accumulator >= STEP) {
          updateWorld(world, input, STEP);
          accumulator -= STEP;
          for (const event of world.events) audio.play(event);
          if (world.phase === PHASE_LEVELUP) {
            screen = SCREEN_LEVELUP;
            accumulator = 0;
            break;
          }
          if (world.phase === PHASE_OVER) {
            screen = SCREEN_OVER;
            finishRun();
            accumulator = 0;
            break;
          }
        }
      }
    } else if (screen === SCREEN_PAUSED) {
      if (input.actionPressed(ACTION_PAUSE)) {
        screen = SCREEN_PLAY;
        audio.play('click');
      } else if (input.actionPressed(ACTION_RESTART)) {
        startRun();
      }
    } else if (screen === SCREEN_LEVELUP) {
      const digit = input.digitPressed();
      let picked = -1;
      if (digit >= 1 && digit <= (world.offers ?? []).length) picked = digit - 1;
      if (input.wasClicked()) {
        const mouse = input.mouse();
        picked = offerAt(mouse.clickX, mouse.clickY);
      }
      if (picked >= 0) {
        chooseUpgrade(world, world.offers[picked]);
        if (world.phase === PHASE_COMBAT) screen = SCREEN_PLAY;
        // If another level is queued, chooseUpgrade re-opened the overlay;
        // the screen stays on level-up and the new offers show next frame.
        for (const event of world.events) audio.play(event);
      }
      updateWorld(world, input, dt * 0.25);
    } else if (screen === SCREEN_OVER) {
      if (input.actionPressed(ACTION_RESTART)) startRun();
      updateWorld(world, input, dt * 0.25);
    }

    renderer.draw(world, screen, best, isNewBest, muted);
    if (status) {
      status.textContent = screen === SCREEN_PLAY
        ? `Wave ${world.wave}, score ${world.score}, hull ${Math.ceil(world.player.hp)}`
        : screen;
    }
    input.endFrame();
  }

  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
