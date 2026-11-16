// NEON DRIFT — screenshot staging. ?shot=start|play|levelup|end (with &seed=N)
// arranges a fixed scene instead of running the loop, paints it twice and sets
// window.__shotReady so a screenshot script knows the frame is settled.
// The scenes are built from the same world and renderer as the live game, so
// the screenshots show the real game, not a mock-up.

import { ARENA_W, ARENA_H } from './config.js';
import { createEnemy, createGem, createParticle, createFloater } from './entities.js';
import { createWorld, PHASE_COMBAT, PHASE_LEVELUP, PHASE_OVER } from './world.js';
import { rollOffers } from './upgrades.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_LEVELUP, SCREEN_OVER } from './render.js';

/**
 * Build a staged scene.
 * @param {string} name — start | play | levelup | end
 * @param {object} random — seeded RNG
 * @returns {{ world: object, screen: string, best: number, isNewBest: boolean }}
 */
export function stageShot(name, random) {
  const world = createWorld(random);

  if (name === 'start') {
    // Title screen over a quiet starfield with a few drifting sparks.
    for (let i = 0; i < 12; i += 1) {
      world.particles.push(createParticle(
        random.range(60, ARENA_W - 60), random.range(60, ARENA_H - 60),
        random.pick(['#35f0d0', '#ff5d8f', '#ffd166']), random, 20,
      ));
    }
    return { world, screen: SCREEN_TITLE, best: 12450, isNewBest: false };
  }

  if (name === 'play') {
    // Mid-combat, wave 3: a busy arena with several enemy types, bullets,
    // gems and sparks, a healthy combo and a half-full XP bar.
    world.wave = 3;
    world.phase = PHASE_COMBAT;
    world.score = 2840;
    world.kills = 31;
    world.combo = 9;
    world.comboTimer = 2.1;
    world.bestCombo = 12;
    world.level = 3;
    world.xp = 7;
    world.player.hp = 78;
    world.player.shield = 26;
    world.player.x = 470;
    world.player.y = 330;
    world.player.angle = -0.6;
    world.spawnQueue = ['drifter', 'drifter', 'stinger', 'splitter'];
    world.waveTotal = 12;
    const placements = [
      ['drifter', 180, 140], ['drifter', 760, 180], ['drifter', 700, 470],
      ['stinger', 820, 300], ['splitter', 240, 430], ['dasher', 620, 120],
      ['bulwark', 150, 300],
    ];
    for (const [type, x, y] of placements) {
      const e = createEnemy(type, random, 3, x, y);
      e.angle = Math.atan2(world.player.y - y, world.player.x - x);
      if (type === 'bulwark') e.hp = Math.round(e.maxHp * 0.55);
      if (type === 'splitter') e.hp = Math.round(e.maxHp * 0.7);
      world.enemies.push(e);
    }
    // Player bullets mid-flight toward the upper-right cluster.
    for (let i = 0; i < 4; i += 1) {
      world.bullets.push({
        x: 520 + i * 46, y: 300 - i * 22,
        vx: 480, vy: -220, radius: 4, damage: 10, pierce: 0, life: 1, hit: new Set(),
      });
    }
    // An enemy bullet inbound.
    world.enemyBullets.push({
      x: 700, y: 320, vx: -200, vy: 40, radius: 5, damage: 10, life: 4,
    });
    // Gems and sparks scattered around.
    for (let i = 0; i < 6; i += 1) {
      world.gems.push(createGem(random.range(200, 800), random.range(120, 500), 1, random));
    }
    world.gems.push(createGem(360, 250, 5, random));
    burstAt(world, 640, 200, '#ff5d8f', 10);
    burstAt(world, 300, 380, '#7dff6a', 8);
    world.floaters.push(createFloater(640, 180, '+120', '#ffd166'));
    world.floaters.push(createFloater(300, 360, '+80', '#ffd166'));
    return { world, screen: SCREEN_PLAY, best: 12450, isNewBest: false };
  }

  if (name === 'levelup') {
    // Level-up overlay over a live combat scene.
    world.wave = 4;
    world.phase = PHASE_LEVELUP;
    world.score = 5120;
    world.kills = 48;
    world.combo = 0;
    world.level = 5;
    world.xp = 2;
    world.player.hp = 64;
    world.player.shield = 40;
    world.player.x = 480;
    world.player.y = 500;
    world.taken.set('rapid', 1);
    world.taken.set('hull', 1);
    world.offers = rollOffers(random, world.taken);
    const placements = [
      ['drifter', 140, 120], ['stinger', 830, 140], ['dasher', 700, 420],
    ];
    for (const [type, x, y] of placements) {
      world.enemies.push(createEnemy(type, random, 4, x, y));
    }
    for (let i = 0; i < 4; i += 1) {
      world.gems.push(createGem(random.range(200, 760), random.range(120, 420), 1, random));
    }
    return { world, screen: SCREEN_LEVELUP, best: 12450, isNewBest: false };
  }

  // 'end' — game over with a new best score.
  world.wave = 7;
  world.phase = PHASE_OVER;
  world.score = 18930;
  world.kills = 104;
  world.bestCombo = 23;
  world.level = 8;
  world.xp = 11;
  world.player.hp = 0;
  world.player.shield = 0;
  world.player.dead = true;
  world.player.x = 480;
  world.player.y = 300;
  burstAt(world, 480, 300, '#35f0d0', 30, 260);
  const placements = [
    ['drifter', 200, 160], ['bulwark', 760, 380], ['stinger', 700, 150],
  ];
  for (const [type, x, y] of placements) {
    world.enemies.push(createEnemy(type, random, 7, x, y));
  }
  return { world, screen: SCREEN_OVER, best: 18930, isNewBest: true };
}

function burstAt(world, x, y, color, count, speed = 170) {
  for (let i = 0; i < count; i += 1) {
    world.particles.push(createParticle(x, y, color, world.random, speed));
  }
}
