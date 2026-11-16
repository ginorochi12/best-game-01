// NEON DRIFT — wave composition. Each wave spends a budget on enemies; the
// mix unlocks new types as waves progress, and the budget grows so later
// waves field more — and tougher — enemies.

import { ENEMIES, WAVE_BUDGET_BASE, WAVE_BUDGET_PER, WAVE_UNLOCKS } from './config.js';

/** Enemy types available at a wave number. */
export function unlockedTypes(wave) {
  return WAVE_UNLOCKS.filter((u) => u.wave <= wave).map((u) => u.type);
}

/** Budget (points) for a wave. */
export function waveBudget(wave) {
  return Math.round(WAVE_BUDGET_BASE + (wave - 1) * WAVE_BUDGET_PER);
}

/**
 * Build the spawn queue for a wave: a shuffled list of enemy types whose
 * total cost fits the budget. Bulwarks are capped so a wave never becomes a
 * wall of tanks; the first wave is drifters only, by design.
 * @param {number} wave
 * @param {object} random — seeded RNG
 * @returns {string[]}
 */
export function buildWaveQueue(wave, random) {
  const types = unlockedTypes(wave);
  let budget = waveBudget(wave);
  const queue = [];
  let bulwarks = 0;
  const maxBulwarks = wave >= 8 ? 3 : wave >= 5 ? 2 : 0;
  // Guard against an infinite loop if the budget cannot afford the cheapest type.
  let guard = 0;
  while (budget >= 1 && guard < 200) {
    guard += 1;
    const affordable = types.filter((t) => ENEMIES[t].cost <= budget);
    if (affordable.length === 0) break;
    // Weight cheap types higher early; later waves lean heavier.
    const weighted = [];
    for (const t of affordable) {
      const weight = t === 'bulwark'
        ? (bulwarks >= maxBulwarks ? 0 : 2)
        : t === 'drifter'
          ? 4
          : 3;
      for (let i = 0; i < weight; i += 1) weighted.push(t);
    }
    if (weighted.length === 0) break;
    const pick = random.pick(weighted);
    if (pick === 'bulwark') bulwarks += 1;
    queue.push(pick);
    budget -= ENEMIES[pick].cost;
  }
  // Shuffle so the wave's mix arrives in random order.
  for (let i = queue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random.next() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  return queue;
}

/** Total enemies in a wave queue (minis from splitters excluded — they spawn on death). */
export function waveEnemyCount(queue) {
  return queue.length;
}
