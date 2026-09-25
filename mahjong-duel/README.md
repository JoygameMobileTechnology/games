# Mahjong Duel — Memory Collection

[Play Mahjong Duel](https://joygamemobiletechnology.github.io/games/mahjong-duel/)

A portrait memory duel with nine illustrated themes, a wood-and-parchment interface, ceramic collision sounds, optional profiles and responsive phone/tablet layouts.

- **Duel:** play your own simulated ghost on one shared 80-tile board. Match to earn 100 points and play again; miss to pass the turn. The ghost learns from visible flips over the last two completed attempts and otherwise guesses.
- **Face down:** only an overlapping tile above blocks a flip; horizontal neighbors do not. Both Eastern and Western editions require identical artwork.
- **Finish the board:** 21 pairs secures the win, but all 40 pairs are played. A 20–20 result is a draw.
- **Collection:** your matches unlock binder entries and increase duplicate counts across 720 faces. Tap a found tile for a larger view and a note about its cultural or thematic meaning. Rarity is cosmetic.
- **Boosters:** three each of Shuffle, Hint, Freeze and Eagle Eye per match, for the player only.
- **Variety:** twelve formations with no consecutive repeat, plus independent tile and background selection across nine themes.

First launch assigns a default profile. Name, preset avatar and country flag can be edited at any time. There are no accounts, backend or live multiplayer. Profiles, settings, collection and resumable duels are stored on the current browser/device. Audio starts after interaction; gentle motion is available.

## Publishing and local preview

`index.html` is the complete standalone game, containing 750 images and 16 font files alongside its code and styles. It can be downloaded for offline play and requires no external assets or game server. The hosted game installs no service worker.

From the repository root:

```sh
node scripts/build-hub.mjs
python3 -m http.server -d _site 8080
```

Open `http://localhost:8080/mahjong-duel/`. Pages publishes this folder at `/games/mahjong-duel/` using the existing hub workflow.

The editable [source](source/README.md), runtime artwork, lockfile, tests and tile-lore references are included under `source/`. Run `npm ci`, `npm test` and `npm run build` there; copy `source/output/mahjong-duel-web.html` over this folder’s `index.html` for future releases.

## Release provenance

Promoted from the development remake to local `main`, source checkpoint `a6e1a3e48d8fb289619ff0b140efeae3f73f69cb`. The previously published game remains in Git history. Existing compatible Duel saves and preferences are retained; retired wildcard boards and Solo saves are not offered for continuation.

Build SHA-256: `7edb0d459147b3562ab35bba54e3c079619476b073500c2ae87d090a51561670`.

See [third-party notices](THIRD_PARTY_NOTICES.md) for bundled library and font licenses.
