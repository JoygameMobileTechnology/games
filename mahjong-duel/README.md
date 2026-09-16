# Mahjong Duel — Memory edition

[Play Mahjong Duel](https://joygamemobiletechnology.github.io/games/mahjong-duel/)

A portrait Mahjong memory game with nine illustrated themes, Eastern and Western matching, three difficulty levels, touch and mouse controls, ceramic tile sounds, and responsive phone/tablet layouts.

All tiles start face down. Flip two uncovered tiles: matching pairs leave the board; mismatched faces turn back down after a short viewing period. Only a tile on top blocks another tile. Horizontal neighbors do not block flips.

- **Duel:** share one80-tile board with Lin, a local AI. You start; a match earns100points and another attempt. A mismatch passes the turn. Highest score after the board is cleared wins, with equal scores drawing. Lin remembers faces revealed by either player. No countdown.
- **Solo:** clear the board at your own pace, with combo scoring and Undo.
- **Eastern:** identical faces match; seasons match other seasons and flowers match other flowers.
- **Western:** exact-picture pairs only.
- **Tools:** three Peeks per game and Shuffle. Duel automatically reshuffles a blocked board without changing scores or the active player. Sound, gentle motion and rank pips are configurable.

## Publishing and local preview

`index.html` is the complete game: all756 artwork images,14 font files, CSS and JavaScript are embedded. It needs no external assets, package installation or separate game server. The repository's existing hub builder discovers this folder and reads `game.json`; Pages deploys it at `/games/mahjong-duel/`.

From the repository root:

```sh
node scripts/build-hub.mjs
python3 -m http.server -d _site8080
```

Open `http://localhost:8080/mahjong-duel/`. You can also download `index.html` and open it directly for offline play. The hosted page does not install a service worker or claim an offline cache.

Progress and settings are stored in this browser under `porcelain:` keys; a different browser or origin has separate progress. Audio starts after interaction. Solo and new shared-board Duel saves are supported; older two-board race saves need a fresh Duel.

## Build provenance

This is the unchanged self-contained publication build of the face-down development version, source commit `ae8ecac`, branch `codex/fullscreen-board-ui`. To publish a future update, replace `index.html` with the regenerated standalone build and rerun the repository hub builder. Keep the game folder slug stable so links and browser progress continue to work.

Build SHA-256: `4558d69eb8bec1a782b6fdf379d081c6ec0164537d1aa60ef3103395ed76945f`.

See [third-party notices](THIRD_PARTY_NOTICES.md) for the bundled library and font licenses.
