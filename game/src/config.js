// NEON DRIFT — tuning constants. One place for every number that shapes how
// the game feels, so balance changes never mean hunting through the logic.

/** Logical canvas size. The arena is the whole canvas. */
export const ARENA_W = 960;
export const ARENA_H = 600;

/** Fixed simulation step (seconds). */
export const STEP = 1 / 60;

/** localStorage key for the best score. */
export const BEST_KEY = 'neon-drift-best';

/** How long a kill chain stays alive (seconds) before the combo resets. */
export const COMBO_WINDOW = 2.5;
/** Combo multiplier caps here (1 + combo * COMBO_PER, capped). */
export const COMBO_PER = 0.05;
export const COMBO_MAX = 3;

/** Seconds of calm between waves. */
export const WAVE_BREATHER = 2.5;

/** Player base stats. Upgrades multiply from these. */
export const PLAYER = {
  radius: 14,
  speed: 265,
  maxHp: 100,
  maxShield: 40,
  shieldRechargeDelay: 5, // seconds after the last hit before the shield refills
  shieldRechargeRate: 14, // shield per second once recharging
  fireRate: 6, // shots per second
  bulletSpeed: 540,
  bulletDamage: 10,
  bulletRadius: 4,
  bulletLife: 1.1, // seconds before a bullet fades
  pickupRadius: 70, // gems drift toward the player inside this radius
  gemMagnetSpeed: 340,
  invulnerableAfterHit: 0.6, // seconds of mercy invulnerability
};

/** XP needed to reach the next level: base + per-level growth. */
export const XP_BASE = 8;
export const XP_PER_LEVEL = 4;

/** Enemy type table. cost = wave-budget points; score = base points on kill. */
export const ENEMIES = {
  drifter: {
    name: 'Drifter', hp: 20, speed: 92, radius: 14, damage: 12, cost: 1,
    score: 50, xp: 1, color: '#ff5d8f', shape: 'tri',
  },
  stinger: {
    name: 'Stinger', hp: 15, speed: 72, radius: 12, damage: 10, cost: 2,
    score: 80, xp: 1, color: '#ffb02e', shape: 'dia',
    range: 270, shotCooldown: 2.3, shotSpeed: 240,
  },
  splitter: {
    name: 'Splitter', hp: 32, speed: 76, radius: 19, damage: 14, cost: 3,
    score: 120, xp: 2, color: '#7dff6a', shape: 'hex', minis: 3,
  },
  mini: {
    name: 'Mini', hp: 8, speed: 135, radius: 8, damage: 8, cost: 0,
    score: 25, xp: 1, color: '#a8ff9e', shape: 'tri',
  },
  dasher: {
    name: 'Dasher', hp: 26, speed: 82, radius: 13, damage: 16, cost: 3,
    score: 140, xp: 2, color: '#35d5f0', shape: 'arrow',
    telegraph: 0.55, dashSpeed: 520, dashTime: 0.32, dashCooldown: 2.4,
  },
  bulwark: {
    name: 'Bulwark', hp: 130, speed: 46, radius: 26, damage: 22, cost: 6,
    score: 300, xp: 5, color: '#b678ff', shape: 'sq',
  },
};

/** Wave budget: points to spend on enemies. Grows with the wave number. */
export const WAVE_BUDGET_BASE = 5;
export const WAVE_BUDGET_PER = 3.5;
/** Which enemy types a wave may use (unlock order). */
export const WAVE_UNLOCKS = [
  { wave: 1, type: 'drifter' },
  { wave: 2, type: 'stinger' },
  { wave: 3, type: 'splitter' },
  { wave: 4, type: 'dasher' },
  { wave: 5, type: 'bulwark' },
];
/** Enemy hp/speed scaling per wave past the first (multiplicative). */
export const WAVE_HP_SCALE = 0.09;
export const WAVE_SPEED_SCALE = 0.02;
/** Seconds between spawn ticks inside a wave. */
export const SPAWN_INTERVAL = 0.7;
/** Max enemies alive at once (spawning pauses past this). */
export const MAX_ALIVE = 26;

/** Shockwave pulse (upgrade): radius, damage, cooldown. */
export const SHOCKWAVE = { radius: 150, damage: 18, cooldown: 9 };
/** Nova on level-up (upgrade): damage to every enemy on screen. */
export const NOVA_DAMAGE = 25;
/** Slow-mo (upgrade): time scale + duration when HP drops under the line. */
export const SLOWMO = { threshold: 0.3, scale: 0.45, duration: 2.2, cooldown: 20 };
