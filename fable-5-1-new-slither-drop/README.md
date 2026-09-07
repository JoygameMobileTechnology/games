# Fable 5.1 New Slither Drop — 3D puzzle prototype

Portrait-only mobile puzzle prototype built from `SlitherDrop_GDD_TR.md`. Colored holes move like snakes
(drag either end, the body follows) and swallow stickmen of their own color. A hole vanishes when it has
swallowed as many stickmen as it has cells. Clear every stickman and every hole before the timer runs out.

Art direction follows Gecko Out: near top-down tilted camera, pale lavender background, slate board in a
white rounded frame, candy-saturated colors, soft shadows, chunky rounded UI.

## Play it

* **Hub:** https://joygamemobiletechnology.github.io/games/fable-5-1-new-slither-drop/
* **Desktop:** open `index.html` directly (single self-contained file, no server or internet needed).
  It renders inside a phone-shaped frame.
* **Phone:** open the hub link in Chrome. The fullscreen button (top right) hides the browser bar and locks
  portrait on Android. Landscape shows a rotate prompt.

Controls: touch a hole on one of its **ends** and drag. The grabbed end leads and chases your finger along the
shortest legal route. Other colors, other holes and the board edge block movement. Grab the other end to back out.

## Project layout

| Path | Purpose |
| --- | --- |
| `index.html` | Built deliverable (Three.js, font, CSS and game code inlined) |
| `src/core.js` | Pure rules: grid state, movement validation, swallowing, win check, path finding, BFS solver |
| `src/levels.js` | 12 handcrafted levels with verification scripts (2 tutorial, 3 easy, 3 medium, 2 hard, 2 expert) |
| `src/game.js` | Three.js scene, board, stickmen, hole rendering, input, HUD, timer, synthesized audio |
| `src/index.html`, `src/style.css` | Page shell and UI styling |
| `tools/build.js` | `node tools/build.js index.html` rebuilds the single file |
| `tools/verify.js` | `node tools/verify.js` checks every level (capacity vs stickmen, connectivity, replay of the solution, BFS on small boards) |
| `tools/serve.js` | Tiny static server for phone testing over Wi-Fi |
| `vendor/` | Three.js r170 (MIT) and the Baloo 2 font (OFL) that get inlined |

## Editing levels

Levels live in `src/levels.js`. `map` rows use `.` for empty cells and `R B G Y P O` for stickmen.
Each hole lists its cells end to end; capacity equals the number of cells. Every level carries a `solution`
so `node tools/verify.js` can prove it is solvable. Rebuild afterwards with `node tools/build.js index.html`.
