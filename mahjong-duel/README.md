# Mahjong Duel — Memory Collection

[Play Mahjong Duel](https://joygamemobiletechnology.github.io/games/mahjong-duel/)

A face-down memory duel with four launch themes, a wood-and-parchment interface, optional profiles and responsive phone/tablet layouts.

- **Duel:** play a preset simulated opponent on one shared 60-tile board. Match to earn 100 points and play again; miss to pass the turn. Settings offers Realistic (the new default), Modern and Original AI. Realistic slowly adapts to observed player performance, with variable recall, pace and streaks. Every AI learns only from visible flips and loses position memory on Shuffle.
- **Face down:** only overlapping tiles above block a flip. Matching requires identical artwork. Ming Porcelain and Dancheong use Eastern tiles; Stained Glass and Dutch Golden Age use Western tiles. Each theme chooses its edition automatically.
- **Finish the board:** 16 pairs secures the win, but all 30 pairs are played. A 15–15 result is a draw. Duels cannot be saved or continued after leaving or reloading.
- **Collection:** your matches unlock artwork and increase duplicate counts across 160 playable faces. Browse the full-screen gallery and inspect collected tiles for their cultural meaning. Phones show full-screen details; landscape tablets use an adjacent details pane. Saved copies from retired editions convert within the same theme and rarity, while original counts and earned theme unlocks remain preserved.
- **Rarities:** Marble, Sapphire, Amethyst and Gold have gem icons beside their Collection labels. Revealed tiles use soft rarity glows, without borders or corner tags. Eagle Eye reveals hidden glows for ten seconds. Every board contains 16 Marble, 8 Sapphire, 4 Amethyst and 2 Gold pairs, with random artwork and positions. Rarity does not change scoring.
- **Progression:** accumulated daily rewards, trophy shelves grouping 74 milestones into 43 achievements, achievement banners, prominent match streaks and simulated leaderboards. Long achievement tracks have four increasingly demanding levels. All 27 one-time achievements have distinct challenge-specific trophies, and duplicate milestone artwork has been replaced. Locked trophies are gray; earned trophies gradually gain color and decoration. All reward ladders use 50 / 100 / 150 / 200 AP, stopping at their final level. One-time feats pay 50–200 AP by difficulty, for a 7,500 AP fresh-profile catalogue. Avatar frames unlock at 500 / 1,500 / 3,000 / 5,000 / 6,500 AP. Historical AP and unlocked frames remain earned. The menu prepares first-shelf artwork during idle time, and nearby shelves render first without moving the layout. Rewarded ads run in test mode without video.
- **Theme unlocks:** Play Duel opens four themed cards. Ming Porcelain starts unlocked. Dancheong needs 14 Ming Marble and 7 Sapphire artworks at three matches each. Later gates require more low-rarity artworks from the previous theme and two matches of every high-rarity artwork from the theme before it. Partial copy progress appears in Collection, unlock details and match results. Progress follows one shared theme path using each theme’s fixed edition. Theme selection applies its matching board. Displayed populations are simulated session counts.
- **Matchmaking:** the final Play Duel button starts a random 2–4 second search among 1,000 preset players. Finding an opponent starts a 2.5-second face-off: portrait reveal, gold VS accent, portraits travelling into the scoreboard, and a “You play first” cue. Tiles settle on the visible board before input opens. Cancel restores theme selection during the search. The matched identity stays throughout the duel. Each selected theme supplies a gentle paper background and blue/red portrait ink, with a shared gold VS ornament.
- **Player identity:** you stay on the left in blue and the opponent on the right in red. Portraits, turn labels and scoring feedback carry those colors. Both players have equal scoreboard space, with Pause in the center. Matches send +100 to the correct score; opponent flips have a restrained red accent. Player-only streaks keep turn ownership visible. Portraits fly from their circular matchmaking rims into the scoreboard, then reveal their equipped rounded profile frames with a gentle settle and gold glint. The equipped frames remain visible during play.
- **Loading:** the forest opening screen shares its garden background and bamboo-leaf effects with the main menu. It has an illustrated logo and a carousel of distinct tiles from one collection. Tiles slide gently from right to the glowing center, then left, with a 2px lift. Artwork does not repeat during a loading screen, and the next launch selects a different tile theme. Startup artwork is prepared before Daily Rewards and Quests; reduced motion uses a short, still screen.
- **Daily welcome:** the first visit each UTC day opens an animated seven-visit journey with today’s rewards, a day medallion and nonrepeating encouragement. Progress advances to today and rewards appear in sequence; reduced motion shows the final state immediately. The full Daily Rewards calendar remains available from the menu.
- **Daily Quests:** three quests per UTC day, with an initial Easy and Medium guarantee, one reroll into a different difficulty, and Coin rewards with Gems on selected Medium and all Hard quests. Each completed quest offers a standard claim or a rewarded Claim 2×, once; ads are simulated without video. The illustrated page follows the daily welcome, with an OK button beneath the reroll note that appears only during login.
- **Shop and currencies:** earn 100 Coins for a win, 20 for a loss or 50 for a draw. Coins and Gems sit beside the profile. The illustrated Shop offers five currency packages, four individual boosters and three larger combinations, each with a Gem-based or more expensive Coin-only payment choice. Currency purchases are explicitly simulated for testing; no real payment is taken.
- **Boosters:** Shuffle, Hint, Freeze and Eagle Eye draw from the player’s persistent earned or purchased inventory. Every profile receives a once-only sampler of two of each booster. The first 30 login days grant 845 Coins and 26 boosters, or 1,690 Coins and 52 boosters with doubled claims. Only the player uses boosters.
- **Rank gains:** victories start with larger jumps and taper as the player approaches first place; draws and losses hold rank.
- **Menu:** the green bamboo garden is the only enabled menu and loading background. Green leaves accompany the scene, which carries unchanged into the menu. Autumn and spring backgrounds and effects are retained behind the engineer flag `ENABLE_SEASONAL_MENU_BACKGROUNDS` in `source/src/menu-backgrounds.js`. Retired doors, night and winter scenes no longer appear. Effects pause when hidden; reduced motion is supported.

First launch assigns a default profile. Name, preset avatar and country flag can be edited at any time. There are no accounts, backend or live multiplayer. Profiles, settings, collection, rewards, achievements, currencies, quests and purchase receipts stay on the current browser/device. Audio starts after interaction.

## Publishing and local preview

`index.html` is the complete standalone game, containing 386 images and 16 font files alongside its code and styles. It supports offline play and requires no external assets or game server. The hosted game installs no service worker.

From the repository root:

```sh
node scripts/build-hub.mjs
python3 -m http.server -d _site 8080
```

Open `http://localhost:8080/mahjong-duel/`. Pages publishes this folder at `/games/mahjong-duel/` using the existing hub workflow.

Editable [source](source/README.md), runtime artwork, lockfile, tests and tile-lore references are included under `source/`. Run `npm ci`, `npm test` and `npm run build` there; copy `source/output/mahjong-duel-web.html` over this folder’s `index.html` for future releases.

## Release provenance

Updated from development `main`, source checkpoint `aed8d3ce987cae6714eb82b93d23a4425324709e`. Previous releases remain in Git history. Collection counts and earned achievement unlocks are preserved: Bamboo becomes Marble, Granite becomes Sapphire, and Celestial joins Gold. Rarity-dependent achievement progress uses the four current tiers. Previously earned achievement points retain their original values through per-unlock receipts. The revised rewards apply only to future unlocks, and previously earned avatar frames remain available. Versioned backups preserve the original save before achievement and fixed-edition migrations.

The four launch themes are Ming porcelain, Dancheong, Stained Glass and Dutch Golden Age. Other themes have no in-game enable switch and their artwork is excluded from the runtime build. Hidden-theme collection progress remains stored; unavailable theme selections fall back to Ming porcelain. Legacy duel snapshots are discarded. Existing progression remains intact, including previously offered reward amounts; new currency balances and quest state initialize safely when missing. Shop artwork provenance is included in `source/output/shop-art/prompts.md`.

Build SHA-256: `9a31586e779ec66a3ccc2167d7427ae3c99b1b465cf4d254bd14ab36c89757ab`.

See [third-party notices](THIRD_PARTY_NOTICES.md) for bundled library and font licenses.
