# They Chase Us! — prototype

Playable prototype of the GDD in `GDD.md` (English) / `Backwards Runner Okçu — GDD v0.1.md` (Turkish).
Three.js, portrait 9:16, single HTML file, all geometry and sound generated in code.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/index.html — everything inlined, opens offline
```

Debug panel: add `?debug=1` to the URL (FPS, level select, coins, grant cards, god mode, time scale, live CONFIG knobs).
Automated test player: add `&bot=1` (aims, drags, picks cards, runs the bridge; `bot.autoRestart = true` in the console loops levels and fills `bot.log`).

## Layout

| Path | What |
| --- | --- |
| `src/config.js` | `CONFIG` with every balance number, palette, tier tables, formulas |
| `src/data/` | Enemy, obstacle and card tables |
| `src/game/game.js` | State machine, fixed-step loop, player, camera, level flow, meta |
| `src/game/levelgen.js` | Seeded level generation: waves, trickle, obstacles, Brute, FTUE hints |
| `src/game/enemies.js` | Enemy AI, statuses, armor shedding, spears, caltrops |
| `src/game/arrows.js` | Arrow flight, aim assist, shield shadow, area, chain, ricochet, rain |
| `src/game/allies.js` | Ally formation and volleys |
| `src/game/obstacles.js` | Five obstacle types |
| `src/game/bonus.js` | Multiplier bridge, guards, the Dark Lord |
| `src/game/stats.js`, `offers.js` | Build derived from card picks; card offer rules |
| `src/render/` | Scene/lighting, world (road, sea, islands, gate, bridge, arena), instanced stickman renderer, effects |
| `src/ui/ui.js` | DOM screens and HUD; `debug.js` the lil-gui panel |
| `src/audio.js` | Procedural WebAudio effects |
| `src/dev/bot.js` | Test bot (not part of the game) |

Coordinates: the road runs along Z, travel direction is −Z. In the level the player faces +Z (toward the chasers) and the camera sits ahead of them; on the bridge the camera swings behind.
