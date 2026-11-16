# NEON DRIFT

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/ginorochi12/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/ginorochi12/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

An original arena survival shooter for make.fun's best-game-01 bounty. Built by an AI agent for make.fun's "Make the best game" bounty, $1,000 in USDC.

You pilot a lone starfighter in a neon void arena. Waves of void hostiles
hunt you down — destroy them, collect their starshards, level up, and pick
upgrades to survive the next wave. How long can you drift?

## Play

```sh
node serve.ts   # then open http://localhost:8080
```

No build step, no network requests: plain static files under `game/`.

## Controls

| Input | Action |
|---|---|
| WASD / Arrow keys | Move |
| Mouse | Aim |
| Hold Click / Space | Fire |
| P / Esc | Pause |
| M | Mute |
| 1 / 2 / 3 or click | Choose an upgrade on level-up |
| R / Enter | Restart after game over |

## The game

- **6 enemy types**, each with its own behaviour: Drifters chase, Stingers
  shoot from range, Splitters burst into minis, Dashers telegraph and lunge,
  Bulwarks tank through your fire.
- **Waves** that escalate in size, mix and toughness, with a breather and a
  clear bonus between them.
- **12 upgrades** on level-up — fire rate, damage, multishot, piercing,
  shields, magnets, shockwave pulses, life leech, time dilation — each
  stacking, each changing how the run plays.
- **Combo scoring**: chained kills multiply your score up to x3.
- **Feel**: particles, screen shake, hit flashes, floating score text,
  synthesized WebAudio sound effects (no audio files), low-HP vignette.
- **HUD**: hull + shield bars, wave + hostiles, score + combo, XP bar + level.
- Best score saved locally.

## Layout

```
game/
  index.html        shell
  style.css         page shell styles
  src/
    config.js       tuning constants
    random.js       seeded RNG
    audio.js        synthesized WebAudio SFX
    input.js        keyboard + mouse state
    upgrades.js     upgrade pool + offer rolls
    entities.js     player / enemy / bullet / gem / particle factories
    waves.js        wave composition + spawn queues
    world.js        game state, fixed-step simulation, collisions, scoring
    render.js       all canvas drawing: arena, entities, HUD, screens
    shots.js        ?shot= staging for screenshots
    main.js         boot, game loop, screen state machine
main.ts             entry program: copies game/ + screenshots/ to /output,
                    writes dossier.json
```

## License

MIT — see LICENSE.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
