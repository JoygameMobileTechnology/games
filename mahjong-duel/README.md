# Mahjong Duel — Memory Collection

[Play Mahjong Duel](https://joygamemobiletechnology.github.io/games/mahjong-duel/)

A face-down memory duel with four launch themes, a wood-and-parchment interface, optional profiles and responsive phone/tablet layouts.

- **Duel:** play your profile’s simulated ghost on one shared 80-tile board. Match to earn 100 points and play again; miss to pass the turn. Settings switches between Modern AI, which learns from visible flips over the last two completed attempts, and Original AI, which uses probabilistic recall and memory decay after each attempt. Neither sees hidden tile identities; Shuffle clears their memory.
- **Face down:** only overlapping tiles above block a flip. Both Eastern and Western editions require identical artwork. Settings controls the edition in both gameplay and Collection.
- **Finish the board:** 21 pairs secures the win, but all 40 pairs are played. A 20–20 result is a draw. Duels cannot be saved or continued after leaving or reloading.
- **Collection:** your matches unlock artwork and increase duplicate counts across 320 launch faces. Browse the full-screen gallery and inspect collected tiles for their cultural meaning. Phones show full-screen details; landscape tablets use an adjacent details pane.
- **Rarities:** Marble, Sapphire, Amethyst and Gold have gem icons beside their Collection labels. Revealed tiles use soft rarity glows, without borders or corner tags. Eagle Eye reveals hidden glows for ten seconds. Rarity does not affect draw odds or scoring.
- **Progression:** accumulated daily rewards, trophy shelves grouping 100 milestones into 43 achievements, achievement banners, prominent match streaks and simulated leaderboards. All trophies appear on category shelves, with search and filter controls hidden. The menu prepares shared trophy artwork during idle time, and nearby shelves render first without moving the layout. Trophy artwork grows with each level, and later milestones award more points. Five avatar frames unlock at achievement-point milestones and can be equipped in the profile or achievement gallery. Rewarded ads run in test mode: double claims simulate completion without showing video.
- **Theme unlocks:** Play Duel opens four themed cards. Ming porcelain starts unlocked; collecting each required artwork unlocks Dancheong, Stained Glass and Dutch Golden Age. Eastern and Western progress separately. Theme selection also applies its matching board. Displayed populations are simulated session counts.
- **Daily Quests:** three quests per UTC day, with an initial Easy and Medium guarantee, one reroll into a different difficulty, and claimable Gems or Gems plus Coins. The illustrated page follows Daily Rewards at the first visit each day.
- **Shop and currencies:** earn 100 Coins for a win, 20 for a loss or 50 for a draw. Coins and Gems sit beside the profile. The illustrated Shop offers five currency packages, four booster packs and three combinations. Currency purchases are explicitly simulated for testing; no real payment is taken.
- **Boosters:** Shuffle, Hint, Freeze and Eagle Eye draw from the player’s persistent earned or purchased inventory. Only the player uses boosters.
- **Menu:** each launch randomly chooses bamboo doors, a moonlit lantern garden or an autumn bridge, excluding the previous launch. Leaves and fireflies animate each scene; reduced motion is supported.

First launch assigns a default profile. Name, preset avatar and country flag can be edited at any time. There are no accounts, backend or live multiplayer. Profiles, settings, collection, rewards, achievements, currencies, quests and purchase receipts stay on the current browser/device. Audio starts after interaction.

## Publishing and local preview

`index.html` is the complete standalone game, containing 345 images and 16 font files alongside its code and styles. It supports offline play and requires no external assets or game server. The hosted game installs no service worker.

From the repository root:

```sh
node scripts/build-hub.mjs
python3 -m http.server -d _site 8080
```

Open `http://localhost:8080/mahjong-duel/`. Pages publishes this folder at `/games/mahjong-duel/` using the existing hub workflow.

Editable [source](source/README.md), runtime artwork, lockfile, tests and tile-lore references are included under `source/`. Run `npm ci`, `npm test` and `npm run build` there; copy `source/output/mahjong-duel-web.html` over this folder’s `index.html` for future releases.

## Release provenance

Updated from development `main`, source checkpoint `d7928447d7ddcfc4690b853c66e0010871da2e33`. Previous releases remain in Git history. Collection counts and earned achievement unlocks are preserved: Bamboo becomes Marble, Granite becomes Sapphire, and Celestial joins Gold. Rarity-dependent achievement progress uses the four current tiers. Previously earned achievement points retain their original values through per-unlock receipts; increased rewards apply only to future unlocks.

The four launch themes are Ming porcelain, Dancheong, Stained Glass and Dutch Golden Age. Other themes have no in-game enable switch and their artwork is excluded from the runtime build. Hidden-theme collection progress remains stored; unavailable theme selections fall back to Ming porcelain. Legacy duel snapshots are discarded. Existing progression remains intact; new currency balances and quest state initialize safely when missing. Shop artwork provenance is included in `source/output/shop-art/prompts.md`.

Build SHA-256: `58443c13b1a87ac3b4ac4d39f15560ce63a6933d72e75f536c8a1121c069709b`.

See [third-party notices](THIRD_PARTY_NOTICES.md) for bundled library and font licenses.
