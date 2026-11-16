// NEON DRIFT — the world: game state and the fixed-step simulation. The main
// loop calls update() with the input state; the world moves everything,
// resolves collisions, scores kills, runs waves and level-ups, and records
// sound events for the main loop to play. It draws nothing.

import {
  ARENA_W, ARENA_H, COMBO_WINDOW, COMBO_PER, COMBO_MAX, MAX_ALIVE,
  PLAYER, SHOCKWAVE, SLOWMO, SPAWN_INTERVAL, WAVE_BREATHER, XP_BASE,
  XP_PER_LEVEL,
} from './config.js';
import {
  baseStats, createBullet, createEnemy, createEnemyBullet, createFloater,
  createGem, createParticle, createPlayer, createRing,
} from './entities.js';
import { buildWaveQueue, waveEnemyCount } from './waves.js';
import { rollOffers } from './upgrades.js';

export const PHASE_BREATHER = 'breather';
export const PHASE_COMBAT = 'combat';
export const PHASE_LEVELUP = 'levelup';
export const PHASE_OVER = 'over';

/** XP needed to go from `level` to `level + 1`. */
export function xpForLevel(level) {
  return XP_BASE + (level - 1) * XP_PER_LEVEL;
}

/**
 * Create a fresh world.
 * @param {object} random — seeded RNG
 */
export function createWorld(random) {
  const world = {
    random,
    player: createPlayer(),
    stats: baseStats(),
    taken: new Map(), // upgrade id -> stacks
    enemies: [],
    bullets: [],
    enemyBullets: [],
    gems: [],
    particles: [],
    floaters: [],
    rings: [],
    stars: makeStars(random),
    wave: 0,
    phase: PHASE_BREATHER,
    phaseTimer: 1.2, // short breather before wave 1
    spawnQueue: [],
    spawnTimer: 0,
    waveTotal: 0,
    score: 0,
    kills: 0,
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    level: 1,
    xp: 0,
    pendingLevels: 0, // level-ups waiting for their choice overlay
    offers: null, // pending level-up offers (null outside PHASE_LEVELUP)
    shockwaveTimer: 0,
    slowmoTimer: 0,
    slowmoCooldown: 0,
    shake: 0,
    time: 0,
    events: [], // sound/event names for the main loop to play, drained per frame
    banner: null, // { text, sub, timer } center-screen announcement
    waveClearBonus: 0,
  };
  return world;
}

/** Three parallax star layers for the background. */
function makeStars(random) {
  const layers = [];
  for (let layer = 0; layer < 3; layer += 1) {
    const stars = [];
    const count = 40 + layer * 25;
    for (let i = 0; i < count; i += 1) {
      stars.push({
        x: random.range(0, ARENA_W),
        y: random.range(0, ARENA_H),
        r: 0.6 + layer * 0.5 + random.next() * 0.7,
        tw: random.range(0, Math.PI * 2),
      });
    }
    layers.push({ stars, speed: 4 + layer * 7 });
  }
  return layers;
}

function emit(world, name) {
  world.events.push(name);
}

function addShake(world, amount) {
  world.shake = Math.min(14, world.shake + amount);
}

function burst(world, x, y, color, count, speed = 170) {
  for (let i = 0; i < count; i += 1) {
    world.particles.push(createParticle(x, y, color, world.random, speed));
  }
}

function startWave(world) {
  world.wave += 1;
  world.spawnQueue = buildWaveQueue(world.wave, world.random);
  world.waveTotal = waveEnemyCount(world.spawnQueue);
  world.phase = PHASE_COMBAT;
  world.spawnTimer = 0.4;
  world.banner = { text: `WAVE ${world.wave}`, sub: `${world.waveTotal} hostiles inbound`, timer: 2 };
  emit(world, 'waveStart');
}

function killEnemy(world, enemy, index) {
  world.enemies.splice(index, 1);
  world.kills += 1;
  world.combo += 1;
  world.comboTimer = COMBO_WINDOW;
  world.bestCombo = Math.max(world.bestCombo, world.combo);
  const mult = Math.min(COMBO_MAX, 1 + world.combo * COMBO_PER);
  const gained = Math.round(enemy.def.score * mult);
  world.score += gained;
  world.floaters.push(createFloater(enemy.x, enemy.y - 14, `+${gained}`, '#ffd166'));
  burst(world, enemy.x, enemy.y, enemy.def.color, enemy.type === 'bulwark' ? 26 : 12);
  world.rings.push(createRing(enemy.x, enemy.y, enemy.radius * 2.4, enemy.def.color));
  // Starshards.
  for (let i = 0; i < enemy.def.xp; i += 1) {
    world.gems.push(createGem(enemy.x, enemy.y, 1, world.random));
  }
  if (enemy.type === 'bulwark') {
    world.gems.push(createGem(enemy.x, enemy.y, 5, world.random));
  }
  // Splitters burst into minis.
  if (enemy.type === 'splitter') {
    for (let i = 0; i < (enemy.def.minis ?? 0); i += 1) {
      const a = (i / (enemy.def.minis ?? 1)) * Math.PI * 2;
      const mini = createEnemy(
        'mini', world.random, world.wave,
        enemy.x + Math.cos(a) * 16, enemy.y + Math.sin(a) * 16,
      );
      world.enemies.push(mini);
    }
  }
  // Life leech.
  if (world.stats.leech > 0) {
    world.player.hp = Math.min(world.stats.maxHp, world.player.hp + world.stats.leech);
  }
  emit(world, enemy.type === 'bulwark' ? 'bigExplosion' : 'explosion');
  if (enemy.type === 'bulwark') addShake(world, 6);
}

function hurtPlayer(world, damage) {
  const p = world.player;
  if (p.invulnerable > 0 || p.dead) return;
  let rest = damage;
  if (p.shield > 0) {
    const absorbed = Math.min(p.shield, rest);
    p.shield -= absorbed;
    rest -= absorbed;
  }
  p.hp -= rest;
  p.invulnerable = PLAYER.invulnerableAfterHit;
  p.sinceHit = 0;
  world.combo = 0;
  world.comboTimer = 0;
  addShake(world, 8);
  burst(world, p.x, p.y, '#ff5d5d', 14, 200);
  emit(world, 'hurt');
  if (p.hp <= 0) {
    p.hp = 0;
    p.dead = true;
    world.phase = PHASE_OVER;
    burst(world, p.x, p.y, '#35f0d0', 40, 260);
    world.rings.push(createRing(p.x, p.y, 90, '#35f0d0'));
    addShake(world, 12);
    emit(world, 'gameOver');
    return;
  }
  // Slow-mo trigger: time dilates when the hull is critical.
  if (world.stats.slowmo && world.slowmoCooldown <= 0 && p.hp / world.stats.maxHp < SLOWMO.threshold) {
    world.slowmoTimer = SLOWMO.duration;
    world.slowmoCooldown = SLOWMO.cooldown;
  }
}

function gainXp(world, amount) {
  world.xp += amount;
  let need = xpForLevel(world.level);
  while (world.xp >= need) {
    world.xp -= need;
    world.level += 1;
    world.pendingLevels += 1;
    need = xpForLevel(world.level);
  }
  // Level-up opens the choice overlay once per level gained (one at a time).
  if (world.pendingLevels > 0 && world.phase === PHASE_COMBAT) {
    world.pendingLevels -= 1;
    world.offers = rollOffers(world.random, world.taken);
    world.phase = PHASE_LEVELUP;
    emit(world, 'levelup');
  }
}

/** Apply a chosen upgrade and resume combat. */
export function chooseUpgrade(world, offer) {
  if (!offer) return;
  world.taken.set(offer.id, (world.taken.get(offer.id) ?? 0) + 1);
  offer.apply(world.stats);
  const p = world.player;
  if (world.stats.healNow > 0) {
    p.hp = Math.min(world.stats.maxHp, p.hp + world.stats.healNow);
    world.stats.healNow = 0;
  }
  p.shield = Math.min(world.stats.maxShield, p.shield + (offer.id === 'aegis' ? 20 : 0));
  world.offers = null;
  world.phase = PHASE_COMBAT;
  emit(world, 'upgrade');
  // A queued level-up (gained while the overlay was open) gets its own overlay.
  if (world.pendingLevels > 0) {
    world.pendingLevels -= 1;
    world.offers = rollOffers(world.random, world.taken);
    world.phase = PHASE_LEVELUP;
    emit(world, 'levelup');
  }
}

/**
 * Advance the world one fixed step.
 * @param {object} world
 * @param {object} input — createInput() handle
 * @param {number} dt — step seconds (already time-scaled by the caller)
 */
export function updateWorld(world, input, dt) {
  world.time += dt;
  world.events.length = 0;

  // Banner + shake decay always run.
  if (world.banner) {
    world.banner.timer -= dt;
    if (world.banner.timer <= 0) world.banner = null;
  }
  world.shake = Math.max(0, world.shake - dt * 30);
  if (world.slowmoCooldown > 0) world.slowmoCooldown -= dt;
  if (world.slowmoTimer > 0) world.slowmoTimer -= dt;

  // Particles, floaters and rings animate even on the level-up screen.
  updateFx(world, dt);

  if (world.phase === PHASE_LEVELUP || world.phase === PHASE_OVER) return;

  if (world.phase === PHASE_BREATHER) {
    world.phaseTimer -= dt;
    updatePlayerDrift(world, input, dt);
    if (world.phaseTimer <= 0) startWave(world);
    return;
  }

  // --- Combat ---
  const p = world.player;
  const stats = world.stats;

  // Combo decay.
  if (world.comboTimer > 0) {
    world.comboTimer -= dt;
    if (world.comboTimer <= 0) world.combo = 0;
  }

  // Movement.
  const mv = input.moveVector();
  p.vx = mv.x * stats.speed;
  p.vy = mv.y * stats.speed;
  p.x = Math.max(p.radius, Math.min(ARENA_W - p.radius, p.x + p.vx * dt));
  p.y = Math.max(p.radius, Math.min(ARENA_H - p.radius, p.y + p.vy * dt));
  p.trail.push({ x: p.x, y: p.y, life: 0.22 });
  if (p.trail.length > 14) p.trail.shift();
  for (const t of p.trail) t.life -= dt;
  while (p.trail.length > 0 && p.trail[0].life <= 0) p.trail.shift();

  // Aim at the mouse.
  const mouse = input.mouse();
  p.angle = Math.atan2(mouse.y - p.y, mouse.x - p.x);

  // Timers.
  p.fireTimer -= dt;
  p.invulnerable = Math.max(0, p.invulnerable - dt);
  p.sinceHit += dt;
  if (p.sinceHit > PLAYER.shieldRechargeDelay && p.shield < stats.maxShield) {
    p.shield = Math.min(stats.maxShield, p.shield + stats.shieldRechargeRate * dt);
  }

  // Firing.
  if (input.firing() && p.fireTimer <= 0 && !p.dead) {
    p.fireTimer = 1 / stats.fireRate;
    const n = stats.projectiles;
    const spread = 0.09;
    for (let i = 0; i < n; i += 1) {
      const offset = (i - (n - 1) / 2) * spread;
      const bx = p.x + Math.cos(p.angle) * (p.radius + 6);
      const by = p.y + Math.sin(p.angle) * (p.radius + 6);
      world.bullets.push(createBullet(bx, by, p.angle + offset, stats));
    }
    burst(world, p.x + Math.cos(p.angle) * (p.radius + 4), p.y + Math.sin(p.angle) * (p.radius + 4), '#ffe066', 2, 90);
    emit(world, 'shoot');
  }

  // Shockwave pulse.
  if (stats.shockwaveLevel > 0) {
    world.shockwaveTimer -= dt;
    if (world.shockwaveTimer <= 0) {
      world.shockwaveTimer = SHOCKWAVE.cooldown;
      const radius = SHOCKWAVE.radius + (stats.shockwaveLevel - 1) * 25;
      const dmg = SHOCKWAVE.damage + (stats.shockwaveLevel - 1) * 8;
      world.rings.push(createRing(p.x, p.y, radius, '#35f0d0'));
      for (let i = world.enemies.length - 1; i >= 0; i -= 1) {
        const e = world.enemies[i];
        if (Math.hypot(e.x - p.x, e.y - p.y) <= radius + e.radius) {
          e.hp -= dmg;
          e.flash = 0.12;
          if (e.hp <= 0) killEnemy(world, e, i);
        }
      }
      emit(world, 'explosion');
    }
  }

  // Spawning.
  if (world.spawnQueue.length > 0 && world.enemies.length < MAX_ALIVE) {
    world.spawnTimer -= dt;
    if (world.spawnTimer <= 0) {
      world.spawnTimer = SPAWN_INTERVAL * world.random.range(0.7, 1.3);
      const type = world.spawnQueue.shift();
      world.enemies.push(createEnemy(type, world.random, world.wave));
    }
  }

  updateEnemies(world, dt);
  updateBullets(world, dt);
  updateGems(world, dt);

  // Wave cleared?
  if (world.spawnQueue.length === 0 && world.enemies.length === 0) {
    const bonus = 100 + world.wave * 50;
    world.score += bonus;
    world.waveClearBonus = bonus;
    world.banner = { text: `WAVE ${world.wave} CLEAR`, sub: `+${bonus} bonus`, timer: 2 };
    world.phase = PHASE_BREATHER;
    world.phaseTimer = WAVE_BREATHER;
    emit(world, 'waveClear');
  }
}

/** Player still drifts (no firing) during the breather. */
function updatePlayerDrift(world, input, dt) {
  const p = world.player;
  const mv = input.moveVector();
  p.x = Math.max(p.radius, Math.min(ARENA_W - p.radius, p.x + mv.x * world.stats.speed * dt));
  p.y = Math.max(p.radius, Math.min(ARENA_H - p.radius, p.y + mv.y * world.stats.speed * dt));
  const mouse = input.mouse();
  p.angle = Math.atan2(mouse.y - p.y, mouse.x - p.x);
}

function updateFx(world, dt) {
  for (let i = world.particles.length - 1; i >= 0; i -= 1) {
    const pt = world.particles[i];
    pt.life -= dt;
    if (pt.life <= 0) { world.particles.splice(i, 1); continue; }
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.96;
    pt.vy *= 0.96;
  }
  for (let i = world.floaters.length - 1; i >= 0; i -= 1) {
    const f = world.floaters[i];
    f.life -= dt;
    f.y -= 26 * dt;
    if (f.life <= 0) world.floaters.splice(i, 1);
  }
  for (let i = world.rings.length - 1; i >= 0; i -= 1) {
    const r = world.rings[i];
    r.life -= dt;
    if (r.life <= 0) world.rings.splice(i, 1);
  }
  for (const layer of world.stars) {
    for (const s of layer.stars) {
      s.y += layer.speed * dt;
      s.tw += dt * 2;
      if (s.y > ARENA_H + 2) { s.y = -2; s.x = world.random.range(0, ARENA_W); }
    }
  }
}

function updateEnemies(world, dt) {
  const p = world.player;
  for (let i = world.enemies.length - 1; i >= 0; i -= 1) {
    const e = world.enemies[i];
    e.flash = Math.max(0, e.flash - dt);
    e.wobble += dt * 3;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;

    if (e.type === 'stinger') {
      // Keep a firing distance; shoot when in range.
      const want = e.def.range;
      const move = dist > want + 30 ? 1 : dist < want - 60 ? -1 : 0;
      const strafe = Math.sin(e.wobble) * 0.6;
      e.vx = (nx * move + -ny * strafe) * e.speed;
      e.vy = (ny * move + nx * strafe) * e.speed;
      e.angle = Math.atan2(dy, dx);
      e.shotTimer -= dt;
      if (e.shotTimer <= 0 && dist < e.def.range + 120) {
        e.shotTimer = e.def.shotCooldown;
        world.enemyBullets.push(createEnemyBullet(e.x, e.y, e.angle, e.def.shotSpeed, e.def.damage));
        burst(world, e.x, e.y, e.def.color, 3, 80);
      }
    } else if (e.type === 'dasher') {
      updateDasher(world, e, dt, nx, ny, dist);
    } else {
      // Chasers (drifter, splitter, mini, bulwark): seek with a wobble.
      const wob = Math.sin(e.wobble) * 0.35;
      e.vx = (nx + -ny * wob) * e.speed;
      e.vy = (ny + nx * wob) * e.speed;
      e.angle = Math.atan2(e.vy, e.vx);
    }

    e.x += e.vx * dt;
    e.y += e.vy * dt;
    // Soft steering back inside the arena.
    if (e.x < -40) e.x = -40;
    if (e.x > ARENA_W + 40) e.x = ARENA_W + 40;
    if (e.y < -40) e.y = -40;
    if (e.y > ARENA_H + 40) e.y = ARENA_H + 40;

    // Touch damage.
    if (!p.dead && dist < e.radius + p.radius) {
      hurtPlayer(world, e.def.damage);
      // Knock the enemy back so it does not chew the player every frame.
      e.x -= nx * 26;
      e.y -= ny * 26;
    }
  }
}

function updateDasher(world, e, dt, nx, ny, dist) {
  e.dashTimer -= dt;
  if (e.dashState === 'chase') {
    e.vx = nx * e.speed;
    e.vy = ny * e.speed;
    e.angle = Math.atan2(ny, nx);
    if (e.dashTimer <= 0 && dist < 340) {
      e.dashState = 'telegraph';
      e.dashTimer = e.def.telegraph;
      e.dashDirX = nx;
      e.dashDirY = ny;
    }
  } else if (e.dashState === 'telegraph') {
    e.vx = 0;
    e.vy = 0;
    e.angle = Math.atan2(e.dashDirY, e.dashDirX);
    if (e.dashTimer <= 0) {
      e.dashState = 'dash';
      e.dashTimer = e.def.dashTime;
      e.vx = e.dashDirX * e.def.dashSpeed;
      e.vy = e.dashDirY * e.def.dashSpeed;
    }
  } else if (e.dashState === 'dash') {
    if (e.dashTimer <= 0) {
      e.dashState = 'recover';
      e.dashTimer = 0.7;
      e.vx = 0;
      e.vy = 0;
    }
  } else {
    if (e.dashTimer <= 0) {
      e.dashState = 'chase';
      e.dashTimer = e.def.dashCooldown * world.random.range(0.8, 1.2);
    }
  }
}

function updateBullets(world, dt) {
  // Player bullets.
  for (let i = world.bullets.length - 1; i >= 0; i -= 1) {
    const b = world.bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.life <= 0 || b.x < -20 || b.x > ARENA_W + 20 || b.y < -20 || b.y > ARENA_H + 20) {
      world.bullets.splice(i, 1);
      continue;
    }
    for (let j = world.enemies.length - 1; j >= 0; j -= 1) {
      const e = world.enemies[j];
      if (b.hit.has(e)) continue;
      if (Math.hypot(e.x - b.x, e.y - b.y) < e.radius + b.radius) {
        b.hit.add(e);
        e.hp -= b.damage;
        e.flash = 0.1;
        burst(world, b.x, b.y, '#ffe066', 3, 110);
        emit(world, 'enemyHit');
        if (e.hp <= 0) {
          killEnemy(world, e, j);
        }
        if (b.pierce > 0) {
          b.pierce -= 1;
        } else {
          world.bullets.splice(i, 1);
        }
        break;
      }
    }
  }
  // Enemy bullets.
  const p = world.player;
  for (let i = world.enemyBullets.length - 1; i >= 0; i -= 1) {
    const b = world.enemyBullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.life <= 0 || b.x < -20 || b.x > ARENA_W + 20 || b.y < -20 || b.y > ARENA_H + 20) {
      world.enemyBullets.splice(i, 1);
      continue;
    }
    if (!p.dead && Math.hypot(p.x - b.x, p.y - b.y) < p.radius + b.radius) {
      world.enemyBullets.splice(i, 1);
      hurtPlayer(world, b.damage);
    }
  }
}

function updateGems(world, dt) {
  const p = world.player;
  const stats = world.stats;
  for (let i = world.gems.length - 1; i >= 0; i -= 1) {
    const g = world.gems[i];
    g.age += dt;
    const dx = p.x - g.x;
    const dy = p.y - g.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < stats.pickupRadius) {
      const pull = PLAYER.gemMagnetSpeed * (1.6 - dist / stats.pickupRadius);
      g.vx += (dx / dist) * pull * dt * 6;
      g.vy += (dy / dist) * pull * dt * 6;
    } else {
      g.vx *= 0.92;
      g.vy *= 0.92;
    }
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    if (dist < p.radius + g.radius + 4) {
      world.gems.splice(i, 1);
      gainXp(world, g.value);
      burst(world, g.x, g.y, '#7dffd4', 4, 90);
      emit(world, 'pickup');
    }
  }
}

/** Current combo multiplier (for the HUD). */
export function comboMultiplier(world) {
  return Math.min(COMBO_MAX, 1 + world.combo * COMBO_PER);
}

/** Enemies left in the current wave (alive + queued). */
export function enemiesLeft(world) {
  return world.enemies.length + world.spawnQueue.length;
}
