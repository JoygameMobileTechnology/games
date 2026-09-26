# Mahjong Duel — Memory Collection

[Play Mahjong Duel](https://joygamemobiletechnology.github.io/games/mahjong-duel/)

A portrait memory duel with four launch themes, a wood-and-parchment interface, ceramic collision sounds, optional profiles and responsive phone/tablet layouts.

- **Duel:** play your own simulated ghost on one shared 80-tile board. Match to earn 100 points and play again; miss to pass the turn. The ghost learns from visible flips over the last two completed attempts and otherwise guesses.
- **Face down:** only an overlapping tile above blocks a flip; horizontal neighbors do not. Both Eastern and Western editions require identical artwork.
- **Finish the board:** 21 pairs secures the win, but all 40 pairs are played. A 20–20 result is a draw.
- **Collection:** your matches unlock binder entries and increase duplicate counts across 320 faces. Tap a found tile for a larger view and a note about its cultural or thematic meaning. Five cosmetic tiers—Bamboo, Granite, Amethyst, Gold and Celestial—use soft glows and bottom-left codes on revealed tiles. Face-down rarity stays hidden unless Eagle Eye is active.
- **Boosters:** 20 each of Shuffle, Hint, Freeze and Eagle Eye per fresh match for testing, for the player only.
- **Variety:** twelve formations with no consecutive repeat, plus independent tile and background selection across four launch themes.

First launch assigns a default profile. Name, preset avatar and country flag can be edited at any time. There are no accounts, backend or live multiplayer. Profiles, settings, collection and resumable duels are stored on the current browser/device. Audio starts after interaction; gentle motion is available.

## Publishing and local preview

`index.html` is the complete standalone game, containing 335 images and 16 font files alongside its code and styles. It can be downloaded for offline play and requires no external assets or game server. The hosted game installs no service worker.

From the repository root:

```sh
node scripts/build-hub.mjs
python3 -m http.server -d _site 8080
```

Open `http://localhost:8080/mahjong-duel/`. Pages publishes this folder at `/games/mahjong-duel/` using the existing hub workflow.

The editable [source](source/README.md), runtime artwork, lockfile, tests and tile-lore references are included under `source/`. Run `npm ci`, `npm test` and `npm run build` there; copy `source/output/mahjong-duel-web.html` over this folder’s `index.html` for future releases.

## Release provenance

Updated from development `main`, source checkpoint `8f72f463f9f2514a4fd3e025658dd679f40a2b08`. The previously published game remains in Git history. Existing compatible Duel saves and preferences are retained. The four launch themes are Ming porcelain, Dancheong, Stained Glass and Dutch Golden Age; other themes have no in-game enable switch and their artwork is excluded from the runtime build. Hidden-theme collection progress remains stored, while unavailable theme selections fall back to Ming porcelain. Retired wildcard boards, Solo saves and unavailable-theme duels are not offered for continuation. Existing saved matches retain their remaining booster charges; fresh matches start with 20 each.

Build SHA-256: `d1af1f7900a5dff421ad0c3993c0fe9c74a84a3ca5cea5ac5dcce4cec37cc1d9`.

See [third-party notices](THIRD_PARTY_NOTICES.md) for bundled library and font licenses.
