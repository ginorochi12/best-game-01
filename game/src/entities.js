// NEON DRIFT — entity factories. Every moving thing in the arena is a plain
// object made here; the world updates them, the renderer draws them.

import { ARENA_W, ARENA_H, ENEMIES, PLAYER } from './config.js';

/** Fresh player state at the center of the arena. */
export function createPlayer() {
  return {
    x: ARENA_W / 2,
    y: ARENA_H / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    hp: PLAYER.maxHp,
    shield: PLAYER.maxShield,
    fireTimer: 0,
    invulnerable: 0,
    sinceHit: 99,
    trail: [],
    dead: false,
  };
}

/** Base derived stats; upgrades mutate a copy of these. */
export function baseStats() {
  return {
    speed: PLAYER.speed,
    maxHp: PLAYER.maxHp,
    maxShield: PLAYER.maxShield,
    shieldRechargeRate: PLAYER.shieldRechargeRate,
    fireRate: PLAYER.fireRate,
    bulletSpeed: PLAYER.bulletSpeed,
    bulletDamage: PLAYER.bulletDamage,
    projectiles: 1,
    pierce: 0,
    pickupRadius: PLAYER.pickupRadius,
    shockwaveLevel: 0,
    leech: 0,
    slowmo: false,
    healNow: 0,
  };
}

/**
 * Spawn an enemy of the given type at the arena edge (or a given point).
 * @param {string} type — key of ENEMIES
 * @param {object} random — seeded RNG
 * @param {number} wave — current wave, for hp/speed scaling
 * @param {number} [x] [y] — override position
 */
export function createEnemy(type, random, wave, x, y) {
  const def = ENEMIES[type];
  const hpScale = 1 + (wave - 1) * 0.09;
  const speedScale = 1 + (wave - 1) * 0.02;
  let px = x;
  let py = y;
  if (px === undefined || py === undefined) {
    // Spawn just outside a random edge, away from the player.
    const edge = random.int(0, 3);
    const margin = 30;
    if (edge === 0) { px = random.range(0, ARENA_W); py = -margin; }
    else if (edge === 1) { px = ARENA_W + margin; py = random.range(0, ARENA_H); }
    else if (edge === 2) { px = random.range(0, ARENA_W); py = ARENA_H + margin; }
    else { px = -margin; py = random.range(0, ARENA_H); }
  }
  return {
    type,
    def,
    x: px,
    y: py,
    vx: 0,
    vy: 0,
    angle: random.range(0, Math.PI * 2),
    radius: def.radius,
    hp: Math.round(def.hp * hpScale),
    maxHp: Math.round(def.hp * hpScale),
    speed: def.speed * speedScale * random.range(0.9, 1.1),
    flash: 0, // hit-flash timer (seconds)
    shotTimer: random.range(0.6, 1.8),
    dashState: 'chase', // dasher: chase | telegraph | dash | recover
    dashTimer: random.range(1, 2),
    dashDirX: 0,
    dashDirY: 0,
    wobble: random.range(0, Math.PI * 2),
  };
}

/** A bullet fired by the player. */
export function createBullet(x, y, angle, stats) {
  return {
    x, y,
    vx: Math.cos(angle) * stats.bulletSpeed,
    vy: Math.sin(angle) * stats.bulletSpeed,
    radius: PLAYER.bulletRadius,
    damage: stats.bulletDamage,
    pierce: stats.pierce,
    life: PLAYER.bulletLife,
    hit: new Set(), // enemy ids already pierced by this bullet
  };
}

/** An enemy bullet (stingers). */
export function createEnemyBullet(x, y, angle, speed, damage) {
  return {
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 5,
    damage,
    life: 4,
  };
}

/** A starshard (XP gem) dropped by a dead enemy. */
export function createGem(x, y, value, random) {
  const a = random.range(0, Math.PI * 2);
  const sp = random.range(40, 120);
  return {
    x, y,
    vx: Math.cos(a) * sp,
    vy: Math.sin(a) * sp,
    value,
    radius: value >= 5 ? 8 : 5,
    age: 0,
  };
}

/** A spark particle. */
export function createParticle(x, y, color, random, speed = 160) {
  const a = random.range(0, Math.PI * 2);
  const sp = random.range(speed * 0.3, speed);
  return {
    x, y,
    vx: Math.cos(a) * sp,
    vy: Math.sin(a) * sp,
    radius: random.range(1.5, 3.5),
    color,
    life: random.range(0.3, 0.7),
    maxLife: 0.7,
  };
}

/** Floating score/damage text. */
export function createFloater(x, y, text, color) {
  return { x, y, text, color, life: 0.9, maxLife: 0.9 };
}

/** A shockwave ring (visual + damage already applied by the world). */
export function createRing(x, y, radius, color) {
  return { x, y, radius, color, life: 0.45, maxLife: 0.45 };
}
