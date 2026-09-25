# They Chase Us! — v2 (auto-attack)

Alternative build of the prototype. Same world, enemies, cards, bridge and boss as v1; the core input changed.

| | v1 | v2 |
| --- | --- | --- |
| Input | Hold to aim (depth), drag for lane, release to fire | Drag/swipe left-right only |
| Shooting | Manual, range set by hold time | Automatic volleys at the closest chaser within reach |
| Reach | 1.5–14 m by hold | `CONFIG.player.autoRange` (8 m) + Attack Range upgrade, × Long Range cards (up to 6 picks); shown as a faint dashed arc clipped to the road |
| Fire rate | Draw time 1.2 s (min 0.6 s) | `attackInterval` 0.65 s (min 0.3 s); Gauntlets −15% |
| Main-screen upgrades | Health / Move Speed / Attack Speed | Health (+5) / Attack Speed (−1.2% interval) / Damage (+0.3) / Attack Range (+0.2 m) |
| Hordes | GDD budget | Budget × 2.6 (ramped in over the first levels), lower average tiers, waves up to 28 units, 120 enemies on screen |

Full Draw became **Far Shot** (targets beyond 90% of reach take +60%). Everything else is shared with v1; balance knobs live in `src/config.js`.

## Run

```bash
# from this folder; node_modules are resolved from the parent project
npx vite --port 5174
npx vite build        # -> v2/dist/index.html
```

`?debug=1` opens the debug panel, `&bot=1` installs the automated test player.
