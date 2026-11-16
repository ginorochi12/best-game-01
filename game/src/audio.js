// NEON DRIFT — synthesized sound effects. Everything is WebAudio oscillators
// and filtered noise; no audio files, no network. The context is created lazily
// on the first user gesture (browsers refuse audio before one).

/** All sound effect names the game can play. */
const NAMES = [
  'shoot', 'enemyHit', 'explosion', 'bigExplosion', 'pickup', 'levelup',
  'hurt', 'waveClear', 'waveStart', 'gameOver', 'click', 'upgrade',
];

/**
 * Create the sound engine. Call `unlock()` from a user gesture (click/key)
 * before playing anything; calls before unlock are ignored, never errors.
 */
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
    return ctx;
  }

  /** Resume/create the context. Safe to call on every gesture. */
  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') void c.resume();
  }

  function tone({ type = 'sine', from = 440, to = null, dur = 0.12, vol = 0.5, at = 0 }) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime + at;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise({ dur = 0.2, vol = 0.4, freq = 1200, q = 0.8, at = 0 }) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime + at;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter).connect(g).connect(master);
    src.start(t0);
  }

  const fns = {
    shoot() {
      tone({ type: 'square', from: 720 + Math.random() * 120, to: 240, dur: 0.07, vol: 0.16 });
    },
    enemyHit() {
      noise({ dur: 0.06, vol: 0.2, freq: 2600 });
    },
    explosion() {
      noise({ dur: 0.28, vol: 0.5, freq: 700 });
      tone({ type: 'sine', from: 160, to: 40, dur: 0.3, vol: 0.5 });
    },
    bigExplosion() {
      noise({ dur: 0.5, vol: 0.6, freq: 420 });
      tone({ type: 'sine', from: 120, to: 30, dur: 0.5, vol: 0.6 });
      tone({ type: 'sawtooth', from: 90, to: 28, dur: 0.4, vol: 0.25 });
    },
    pickup() {
      tone({ type: 'sine', from: 880, to: 1320, dur: 0.09, vol: 0.25 });
    },
    levelup() {
      [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.16, vol: 0.3, at: i * 0.07 }));
    },
    hurt() {
      tone({ type: 'sawtooth', from: 180, to: 55, dur: 0.25, vol: 0.5 });
      noise({ dur: 0.18, vol: 0.35, freq: 300 });
    },
    waveClear() {
      [660, 880].forEach((f, i) => tone({ type: 'sine', from: f, dur: 0.18, vol: 0.3, at: i * 0.1 }));
    },
    waveStart() {
      tone({ type: 'triangle', from: 220, to: 440, dur: 0.18, vol: 0.3 });
      tone({ type: 'triangle', from: 440, to: 660, dur: 0.14, vol: 0.25, at: 0.1 });
    },
    gameOver() {
      [392, 330, 262, 196].forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.3, vol: 0.32, at: i * 0.16 }));
    },
    click() {
      tone({ type: 'sine', from: 980, to: 760, dur: 0.05, vol: 0.2 });
    },
    upgrade() {
      [784, 988, 1175].forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.12, vol: 0.28, at: i * 0.05 }));
    },
  };

  return {
    unlock,
    /** Play a named effect; unknown names are ignored. */
    play(name) {
      if (NAMES.includes(name)) fns[name]();
    },
    setMuted(value) { muted = Boolean(value); },
    isMuted() { return muted; },
  };
}
