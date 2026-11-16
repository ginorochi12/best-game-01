// NEON DRIFT — the upgrade pool. On every level-up the player picks one of
// three random cards. Each upgrade has a stacking effect on the player's stats
// and a max stack count; the pool only offers upgrades the player can still
// take.

/**
 * @typedef {Object} UpgradeDef
 * @property {string} id
 * @property {string} name
 * @property {string} icon — one glyph drawn on the card
 * @property {string} blurb — one-line description
 * @property {number} max — max stacks
 * @property {(stats: object) => void} apply — mutates the player's derived stats
 */

export const UPGRADES = [
  {
    id: 'rapid', name: 'Rapid Fire', icon: '»', blurb: '+18% fire rate', max: 5,
    apply: (s) => { s.fireRate *= 1.18; },
  },
  {
    id: 'heavy', name: 'Heavy Rounds', icon: '◆', blurb: '+25% bullet damage', max: 5,
    apply: (s) => { s.bulletDamage *= 1.25; },
  },
  {
    id: 'twin', name: 'Twin Cannons', icon: '‖', blurb: '+1 projectile per shot', max: 3,
    apply: (s) => { s.projectiles += 1; },
  },
  {
    id: 'swift', name: 'Swift Thrusters', icon: '≫', blurb: '+12% move speed', max: 4,
    apply: (s) => { s.speed *= 1.12; },
  },
  {
    id: 'hull', name: 'Reinforced Hull', icon: '▣', blurb: '+25 max HP, heal 25 now', max: 5,
    apply: (s) => { s.maxHp += 25; s.healNow += 25; },
  },
  {
    id: 'aegis', name: 'Aegis Shield', icon: '◉', blurb: '+20 max shield, faster recharge', max: 4,
    apply: (s) => { s.maxShield += 20; s.shieldRechargeRate *= 1.3; },
  },
  {
    id: 'magnet', name: 'Magnet Coil', icon: '◎', blurb: '+60% shard pickup radius', max: 3,
    apply: (s) => { s.pickupRadius *= 1.6; },
  },
  {
    id: 'pierce', name: 'Piercing Rounds', icon: '→', blurb: 'Bullets pierce +1 enemy', max: 3,
    apply: (s) => { s.pierce += 1; },
  },
  {
    id: 'overdrive', name: 'Overdrive', icon: '⚡', blurb: '+12% bullet speed, +8% damage', max: 4,
    apply: (s) => { s.bulletSpeed *= 1.12; s.bulletDamage *= 1.08; },
  },
  {
    id: 'shockwave', name: 'Shockwave Core', icon: '✳', blurb: 'Emit a damaging pulse every 9s', max: 3,
    apply: (s) => { s.shockwaveLevel += 1; },
  },
  {
    id: 'leech', name: 'Life Leech', icon: '♥', blurb: 'Kills restore 1 HP', max: 3,
    apply: (s) => { s.leech += 1; },
  },
  {
    id: 'slowmo', name: 'Time Dilation', icon: '◷', blurb: 'Time slows when HP is critical', max: 1,
    apply: (s) => { s.slowmo = true; },
  },
];

/**
 * Roll three distinct upgrade offers the player can still take.
 * @param {object} random — seeded RNG
 * @param {Map<string, number>} taken — id -> stacks already held
 * @returns {UpgradeDef[]}
 */
export function rollOffers(random, taken) {
  const available = UPGRADES.filter((u) => (taken.get(u.id) ?? 0) < u.max);
  const pool = [...available];
  const offers = [];
  while (offers.length < 3 && pool.length > 0) {
    const i = Math.floor(random.next() * pool.length);
    offers.push(pool.splice(i, 1)[0]);
  }
  // If everything is maxed (very late game), fall back to a heal card.
  while (offers.length < 3) {
    offers.push({
      id: 'repair', name: 'Field Repair', icon: '+', blurb: 'Restore 40 HP now', max: 99,
      apply: (s) => { s.healNow += 40; },
    });
  }
  return offers;
}
