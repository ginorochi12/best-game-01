// NEON DRIFT — the renderer. Everything the player sees is drawn here on one
// canvas: the starfield arena, the ship, enemies, bullets, gems, particles,
// the HUD, and the title / pause / level-up / game-over screens. It reads the
// world and never mutates it.

import { ARENA_W, ARENA_H } from './config.js';
import { comboMultiplier, enemiesLeft, xpForLevel, PHASE_BREATHER } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_LEVELUP = 'levelup';
export const SCREEN_OVER = 'over';

const FONT = (px, weight = 600) => `${weight} ${px}px "Segoe UI", system-ui, sans-serif`;
const MONO = (px) => `${px}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;

/**
 * Create the renderer for a canvas.
 * @param {HTMLCanvasElement} canvas
 */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function drawBackground(world) {
    // Deep-space gradient.
    const grad = ctx.createLinearGradient(0, 0, 0, ARENA_H);
    grad.addColorStop(0, '#070d1d');
    grad.addColorStop(0.55, '#050a14');
    grad.addColorStop(1, '#0a0618');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    // Faint grid.
    ctx.strokeStyle = 'rgba(53, 240, 208, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= ARENA_W; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, ARENA_H); }
    for (let y = 0; y <= ARENA_H; y += 60) { ctx.moveTo(0, y); ctx.lineTo(ARENA_W, y); }
    ctx.stroke();
    // Parallax stars with a slow twinkle.
    for (const layer of world.stars) {
      for (const s of layer.stars) {
        const a = 0.35 + 0.3 * Math.sin(s.tw);
        ctx.fillStyle = `rgba(190, 230, 255, ${a.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Arena border glow.
    ctx.strokeStyle = 'rgba(53, 240, 208, 0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, ARENA_W - 2, ARENA_H - 2);
  }

  function drawShape(shape, x, y, angle, radius, color, flash) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = flash > 0 ? '#ffffff' : color;
    ctx.strokeStyle = flash > 0 ? '#ffffff' : color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = flash > 0 ? 18 : 10;
    ctx.beginPath();
    if (shape === 'tri') {
      ctx.moveTo(radius, 0);
      ctx.lineTo(-radius * 0.8, radius * 0.75);
      ctx.lineTo(-radius * 0.4, 0);
      ctx.lineTo(-radius * 0.8, -radius * 0.75);
      ctx.closePath();
    } else if (shape === 'dia') {
      ctx.moveTo(radius, 0);
      ctx.lineTo(0, radius * 0.8);
      ctx.lineTo(-radius, 0);
      ctx.lineTo(0, -radius * 0.8);
      ctx.closePath();
    } else if (shape === 'hex') {
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        const px = Math.cos(a) * radius;
        const py = Math.sin(a) * radius;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else if (shape === 'sq') {
      ctx.rect(-radius * 0.85, -radius * 0.85, radius * 1.7, radius * 1.7);
    } else if (shape === 'arrow') {
      ctx.moveTo(radius * 1.2, 0);
      ctx.lineTo(-radius * 0.7, radius * 0.8);
      ctx.lineTo(-radius * 0.3, 0);
      ctx.lineTo(-radius * 0.7, -radius * 0.8);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer(world) {
    const p = world.player;
    if (p.dead) return;
    // Engine trail.
    for (const t of p.trail) {
      const a = Math.max(0, t.life / 0.22) * 0.35;
      ctx.fillStyle = `rgba(53, 240, 208, ${a.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, p.radius * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    // Shield ring.
    if (p.shield > 0) {
      ctx.strokeStyle = `rgba(80, 180, 255, ${0.25 + 0.45 * (p.shield / world.stats.maxShield)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Mercy blink.
    if (p.invulnerable > 0 && Math.floor(p.invulnerable * 16) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    }
    drawShape('arrow', p.x, p.y, p.angle, p.radius + 3, '#35f0d0', 0);
    // Cockpit dot.
    ctx.fillStyle = '#eafffb';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 5, p.y + Math.sin(p.angle) * 5, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawEnemies(world) {
    for (const e of world.enemies) {
      // Dasher telegraph: a bright line along the dash path.
      if (e.type === 'dasher' && e.dashState === 'telegraph') {
        ctx.strokeStyle = 'rgba(53, 213, 240, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + e.dashDirX * 170, e.y + e.dashDirY * 170);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      drawShape(e.def.shape, e.x, e.y, e.angle, e.radius, e.def.color, e.flash);
      // Health bar for hurt or bulky enemies.
      if (e.hp < e.maxHp && e.maxHp >= 20) {
        const w = e.radius * 2;
        const ratio = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(e.x - w / 2, e.y - e.radius - 10, w, 4);
        ctx.fillStyle = ratio > 0.5 ? '#7dff6a' : ratio > 0.25 ? '#ffd166' : '#ff5d5d';
        ctx.fillRect(e.x - w / 2, e.y - e.radius - 10, w * ratio, 4);
      }
    }
  }

  function drawBullets(world) {
    for (const b of world.bullets) {
      ctx.fillStyle = '#ffe066';
      ctx.shadowColor = '#ffe066';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    for (const b of world.enemyBullets) {
      ctx.fillStyle = '#ff8a3d';
      ctx.shadowColor = '#ff8a3d';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  function drawGems(world) {
    for (const g of world.gems) {
      const pulse = 1 + 0.18 * Math.sin(g.age * 6);
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = g.value >= 5 ? '#ffd166' : '#7dffd4';
      ctx.shadowColor = g.value >= 5 ? '#ffd166' : '#7dffd4';
      ctx.shadowBlur = 10;
      const s = g.radius * pulse;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    }
    ctx.shadowBlur = 0;
  }

  function drawFx(world) {
    for (const pt of world.particles) {
      const a = Math.max(0, pt.life / pt.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const r of world.rings) {
      const t = 1 - r.life / r.maxLife;
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = (1 - t) * 0.8;
      ctx.lineWidth = 3 * (1 - t) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius * (0.3 + 0.7 * t), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (const f of world.floaters) {
      ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
      ctx.font = FONT(14, 700);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  function bar(x, y, w, h, ratio, fill, back = 'rgba(255,255,255,0.12)') {
    ctx.fillStyle = back;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), h);
  }

  function drawHud(world, best) {
    const p = world.player;
    const stats = world.stats;
    // Top-left: hull + shield.
    ctx.textAlign = 'left';
    ctx.font = FONT(12, 700);
    ctx.fillStyle = '#9fb3c8';
    ctx.fillText('HULL', 18, 24);
    bar(18, 30, 190, 12, p.hp / stats.maxHp, p.hp / stats.maxHp < 0.3 ? '#ff5d5d' : '#35f0d0');
    ctx.fillStyle = '#eafffb';
    ctx.font = MONO(11);
    ctx.fillText(`${Math.ceil(p.hp)} / ${stats.maxHp}`, 212, 40);
    ctx.fillStyle = '#9fb3c8';
    ctx.font = FONT(12, 700);
    ctx.fillText('SHIELD', 18, 58);
    bar(18, 64, 190, 8, p.shield / stats.maxShield, '#50b4ff');
    // Top-center: wave + hostiles.
    ctx.textAlign = 'center';
    ctx.font = FONT(20, 800);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(world.wave === 0 ? 'GET READY' : `WAVE ${world.wave}`, ARENA_W / 2, 30);
    ctx.font = MONO(12);
    ctx.fillStyle = '#9fb3c8';
    ctx.fillText(
      world.phase === PHASE_BREATHER ? 'next wave incoming…' : `${enemiesLeft(world)} hostiles`,
      ARENA_W / 2, 48,
    );
    // Top-right: score + combo + best.
    ctx.textAlign = 'right';
    ctx.font = FONT(20, 800);
    ctx.fillStyle = '#ffd166';
    ctx.fillText(world.score.toLocaleString('en-US'), ARENA_W - 18, 30);
    ctx.font = MONO(12);
    ctx.fillStyle = world.combo >= 5 ? '#ff9f43' : '#9fb3c8';
    ctx.fillText(
      world.combo >= 2 ? `COMBO x${comboMultiplier(world).toFixed(2)} (${world.combo})` : `BEST ${best.toLocaleString('en-US')}`,
      ARENA_W - 18, 48,
    );
    // Bottom: XP bar + level.
    const need = xpForLevel(world.level);
    ctx.textAlign = 'left';
    ctx.font = FONT(12, 700);
    ctx.fillStyle = '#9fb3c8';
    ctx.fillText(`LEVEL ${world.level}`, 18, ARENA_H - 26);
    bar(86, ARENA_H - 36, ARENA_W - 172, 10, world.xp / need, '#b678ff');
    ctx.textAlign = 'right';
    ctx.font = MONO(11);
    ctx.fillStyle = '#c9b8ff';
    ctx.fillText(`${world.xp} / ${need} XP`, ARENA_W - 18, ARENA_H - 26);
    // Low-HP vignette.
    if (p.hp / stats.maxHp < 0.3 && !p.dead) {
      const pulse = 0.1 + 0.06 * Math.sin(world.time * 6);
      const vg = ctx.createRadialGradient(
        ARENA_W / 2, ARENA_H / 2, ARENA_H * 0.35,
        ARENA_W / 2, ARENA_H / 2, ARENA_H * 0.75,
      );
      vg.addColorStop(0, 'rgba(255, 40, 60, 0)');
      vg.addColorStop(1, `rgba(255, 40, 60, ${pulse.toFixed(2)})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    }
  }

  function drawBanner(world) {
    if (!world.banner) return;
    const t = world.banner.timer;
    const alpha = t > 1.6 ? (2 - t) / 0.4 : t < 0.5 ? t / 0.5 : 1;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.textAlign = 'center';
    ctx.font = FONT(44, 900);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#35f0d0';
    ctx.shadowBlur = 24;
    ctx.fillText(world.banner.text, ARENA_W / 2, ARENA_H / 2 - 30);
    ctx.shadowBlur = 0;
    ctx.font = FONT(16);
    ctx.fillStyle = '#9fb3c8';
    ctx.fillText(world.banner.sub, ARENA_W / 2, ARENA_H / 2 + 2);
    ctx.globalAlpha = 1;
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(4, 10, 20, 0.88)';
    ctx.strokeStyle = 'rgba(53, 240, 208, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12);
    ctx.fill();
    ctx.stroke();
  }

  function drawTitle(world, best, muted) {
    ctx.fillStyle = 'rgba(3, 6, 13, 0.55)';
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    ctx.textAlign = 'center';
    ctx.font = FONT(64, 900);
    const titleGrad = ctx.createLinearGradient(0, 150, 0, 230);
    titleGrad.addColorStop(0, '#35f0d0');
    titleGrad.addColorStop(1, '#50b4ff');
    ctx.fillStyle = titleGrad;
    ctx.shadowColor = '#35f0d0';
    ctx.shadowBlur = 30;
    ctx.fillText('NEON DRIFT', ARENA_W / 2, 205);
    ctx.shadowBlur = 0;
    ctx.font = FONT(17);
    ctx.fillStyle = '#c7d8e8';
    ctx.fillText('Survive the void. Collect starshards. Level up. Don\'t stop moving.', ARENA_W / 2, 240);
    panel(ARENA_W / 2 - 250, 272, 500, 118);
    ctx.font = MONO(14);
    ctx.fillStyle = '#9fb3c8';
    const lines = [
      'WASD / Arrows — move        Mouse — aim',
      'Hold Click / Space — fire   P — pause    M — mute',
      'Destroy hostiles, grab shards, pick an upgrade each level.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, ARENA_W / 2, 302 + i * 26));
    const blink = 0.6 + 0.4 * Math.sin(world.time * 4);
    ctx.globalAlpha = blink;
    ctx.font = FONT(20, 800);
    ctx.fillStyle = '#ffd166';
    ctx.fillText('PRESS ENTER OR CLICK TO LAUNCH', ARENA_W / 2, 440);
    ctx.globalAlpha = 1;
    if (best > 0) {
      ctx.font = MONO(14);
      ctx.fillStyle = '#9fb3c8';
      ctx.fillText(`BEST SCORE  ${best.toLocaleString('en-US')}`, ARENA_W / 2, 478);
    }
    ctx.font = MONO(12);
    ctx.fillStyle = '#5d7a94';
    ctx.fillText(muted ? 'SOUND OFF  (M to unmute)' : 'SOUND ON  (M to mute)', ARENA_W / 2, 560);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(3, 6, 13, 0.6)';
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    ctx.textAlign = 'center';
    ctx.font = FONT(44, 900);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('PAUSED', ARENA_W / 2, ARENA_H / 2 - 10);
    ctx.font = FONT(16);
    ctx.fillStyle = '#9fb3c8';
    ctx.fillText('P or Esc to resume  ·  M to mute  ·  R to restart', ARENA_W / 2, ARENA_H / 2 + 26);
  }

  function drawLevelUp(world) {
    ctx.fillStyle = 'rgba(3, 6, 13, 0.72)';
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    ctx.textAlign = 'center';
    ctx.font = FONT(34, 900);
    ctx.fillStyle = '#ffd166';
    ctx.shadowColor = '#ffd166';
    ctx.shadowBlur = 18;
    ctx.fillText(`LEVEL ${world.level} — CHOOSE AN UPGRADE`, ARENA_W / 2, 150);
    ctx.shadowBlur = 0;
    const offers = world.offers ?? [];
    const cardW = 250;
    const cardH = 190;
    const gap = 24;
    const total = offers.length * cardW + (offers.length - 1) * gap;
    const startX = (ARENA_W - total) / 2;
    const y = 200;
    offers.forEach((offer, i) => {
      const x = startX + i * (cardW + gap);
      const stacks = world.taken.get(offer.id) ?? 0;
      panel(x, y, cardW, cardH);
      ctx.fillStyle = '#35f0d0';
      ctx.font = FONT(40, 900);
      ctx.fillText(offer.icon, x + cardW / 2, y + 62);
      ctx.fillStyle = '#ffffff';
      ctx.font = FONT(19, 800);
      ctx.fillText(offer.name, x + cardW / 2, y + 100);
      ctx.fillStyle = '#9fb3c8';
      ctx.font = FONT(14);
      ctx.fillText(offer.blurb, x + cardW / 2, y + 128);
      ctx.font = MONO(12);
      ctx.fillStyle = '#5d7a94';
      const maxText = offer.max >= 99 ? '' : `  ·  owned ${stacks}/${offer.max}`;
      ctx.fillText(`[${i + 1}] or click${maxText}`, x + cardW / 2, y + 162);
    });
    ctx.font = FONT(14);
    ctx.fillStyle = '#9fb3c8';
    ctx.fillText('Press 1, 2 or 3 — or click a card.', ARENA_W / 2, 440);
  }

  function drawGameOver(world, best, isNewBest) {
    ctx.fillStyle = 'rgba(10, 3, 8, 0.68)';
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    ctx.textAlign = 'center';
    ctx.font = FONT(52, 900);
    ctx.fillStyle = '#ff5d8f';
    ctx.shadowColor = '#ff5d8f';
    ctx.shadowBlur = 26;
    ctx.fillText('SHIP DESTROYED', ARENA_W / 2, 170);
    ctx.shadowBlur = 0;
    if (isNewBest) {
      ctx.font = FONT(18, 800);
      ctx.fillStyle = '#ffd166';
      ctx.fillText('★ NEW BEST SCORE ★', ARENA_W / 2, 205);
    }
    panel(ARENA_W / 2 - 220, 235, 440, 190);
    ctx.font = MONO(16);
    const rows = [
      ['SCORE', world.score.toLocaleString('en-US')],
      ['WAVE REACHED', String(world.wave)],
      ['KILLS', String(world.kills)],
      ['BEST COMBO', `x${(1 + world.bestCombo * 0.05).toFixed(2)} (${world.bestCombo})`],
      ['LEVEL', String(world.level)],
      ['BEST', best.toLocaleString('en-US')],
    ];
    rows.forEach(([label, value], i) => {
      const y = 268 + i * 26;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#9fb3c8';
      ctx.fillText(label, ARENA_W / 2 - 190, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(value, ARENA_W / 2 + 190, y);
    });
    const blink = 0.6 + 0.4 * Math.sin(world.time * 4);
    ctx.globalAlpha = blink;
    ctx.textAlign = 'center';
    ctx.font = FONT(19, 800);
    ctx.fillStyle = '#35f0d0';
    ctx.fillText('PRESS R OR ENTER TO FLY AGAIN', ARENA_W / 2, 470);
    ctx.globalAlpha = 1;
  }

  /**
   * Draw the whole frame.
   * @param {object} world
   * @param {string} screen — one of the SCREEN_* constants
   * @param {number} best — best score
   * @param {boolean} isNewBest
   * @param {boolean} muted
   */
  function draw(world, screen, best, isNewBest, muted) {
    ctx.save();
    // Screen shake: offset the whole scene by a decaying random vector.
    if (world.shake > 0.2) {
      const s = world.shake;
      ctx.translate((Math.random() * 2 - 1) * s, (Math.random() * 2 - 1) * s);
    }
    drawBackground(world);
    if (screen !== SCREEN_TITLE) {
      drawGems(world);
      drawEnemies(world);
      drawPlayer(world);
      drawBullets(world);
      drawFx(world);
    } else {
      drawFx(world);
    }
    ctx.restore();

    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_LEVELUP || screen === SCREEN_OVER) {
      drawHud(world, best);
    }
    if (screen === SCREEN_PLAY) drawBanner(world);
    if (screen === SCREEN_TITLE) drawTitle(world, best, muted);
    if (screen === SCREEN_PAUSED) drawPaused();
    if (screen === SCREEN_LEVELUP) drawLevelUp(world);
    if (screen === SCREEN_OVER) drawGameOver(world, best, isNewBest);
  }

  return { draw };
}
