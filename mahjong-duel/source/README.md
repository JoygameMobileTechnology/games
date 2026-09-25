# Mahjong Duel source

Editable source for the Memory Collection release on `main`.

## Develop and build

```sh
npm ci
npm run dev
```

The Vite server exposes port 5173 on the local network for phone testing.

```sh
npm test
npm run build
```

The build creates `dist/` and a self-contained `output/mahjong-duel-web.html` with all runtime images, fonts, styles and JavaScript embedded. Replace `../index.html` with that file to publish an update; the repository hub builder deploys the parent game folder.

Runtime artwork is included in `public/`; original art-production atlases, the full art catalogue and generated QA captures are maintained in the development workspace and are not required to rebuild this game.

## Verification

`npm test` runs 78 tests covering matching, legal flips, formations, ghost memory, boosters, collection persistence and all 720 cultural tile notes.

Browser checks require a separate Playwright installation with browser binaries. Set `PLAYWRIGHT_MODULE` to that installation and `GAME_URL` to the running game. Current checks include `tests/progression-check.cjs`, `tests/pacing-check.cjs`, `tests/tile-binder-check.cjs`, `tests/tile-inspector-check.cjs` and `tests/viewport-compat-check.cjs`; use `--webkit` where supported. Older browser scripts retain earlier UI expectations. Tests write captures under the ignored `output/` directory.

## Game behavior

One shared face-down board, 40 pairs, one approachable difficulty and your profile's AI ghost. Both editions require identical artwork. Matching keeps your turn; missing passes it. Only tiles above block a flip. A 21-pair lead secures the win, and play continues until the board is empty.

Your ghost remembers faces observed during the last two completed attempts and the current attempt. It uses known matches and otherwise guesses without seeing hidden faces. Profile creation is optional. Profiles, progress and collection counts stay in browser storage.

The player receives three each of Shuffle, Hint, Freeze and Eagle Eye per match. Only player matches add to the binder. Cosmetic rarity does not alter draw odds or scoring. Collected tiles open a larger preview with their cultural or thematic meaning; supporting references and interpretation boundaries are in `docs/tile-lore-*-sources.md`.

See [third-party notices](../THIRD_PARTY_NOTICES.md) for bundled library and font licenses.
