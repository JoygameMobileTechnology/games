# Mahjong Duel — Memory Collection

[Play Mahjong Duel](https://joygamemobiletechnology.github.io/games/mahjong-duel/)

A face-down memory duel with four launch themes, a wood-and-parchment interface, optional profiles and responsive phone/tablet layouts.

- **Duel:** play a preset simulated opponent on one shared 60-tile board. Match to earn 100 points and play again; miss to pass the turn. Settings offers Realistic (the new default), Modern and Original AI. Realistic slowly adapts to observed player performance, with variable recall, pace and streaks. Every AI learns only from visible flips and loses position memory on Shuffle.
- **Face down:** only overlapping tiles above block a flip. Both Eastern and Western editions require identical artwork. Settings controls the edition in both gameplay and Collection.
- **Finish the board:** 16 pairs secures the win, but all 30 pairs are played. A 15–15 result is a draw. Duels cannot be saved or continued after leaving or reloading.
- **Collection:** your matches unlock artwork and increase duplicate counts across 320 launch faces. Browse the full-screen gallery and inspect collected tiles for their cultural meaning. Phones show full-screen details; landscape tablets use an adjacent details pane.
- **Rarities:** Marble, Sapphire, Amethyst and Gold have gem icons beside their Collection labels. Revealed tiles use soft rarity glows, without borders or corner tags. Eagle Eye reveals hidden glows for ten seconds. Every board contains 16 Marble, 8 Sapphire, 4 Amethyst and 2 Gold pairs, with random artwork and positions. Rarity does not change scoring.
- **Progression:** accumulated daily rewards, trophy shelves grouping 100 milestones into 43 achievements, achievement banners, prominent match streaks and simulated leaderboards. All trophies appear on category shelves, with search and filter controls hidden. The menu prepares shared trophy artwork during idle time, and nearby shelves render first without moving the layout. Trophy artwork grows with each level, and later milestones award more points. Five avatar frames unlock at achievement-point milestones and can be equipped in the profile or achievement gallery. Rewarded ads run in test mode: double claims simulate completion without showing video.
- **Theme unlocks:** Play Duel opens four themed cards. Ming porcelain starts unlocked. Dancheong needs 14 Ming Marble and 7 Sapphire artworks at three matches each. Later gates require more low-rarity artworks from the previous theme and two matches of every high-rarity artwork from the theme before it. Partial copy progress appears in Collection, unlock details and match results. Eastern and Western progress separately. Theme selection also applies its matching board. Displayed populations are simulated session counts.
- **Matchmaking:** the final Play Duel button starts a random 2–4 second search among 1,000 preset players. Finding an opponent starts a 2.5-second face-off: portrait reveal, gold VS accent, portraits travelling into the scoreboard, and a “You play first” cue. Tiles settle on the visible board before input opens. Cancel restores theme selection during the search. The matched identity stays throughout the duel.
- **Player identity:** you stay on the left in blue and the opponent on the right in red. Portraits, turn labels and scoring feedback carry those colors. Both players have equal scoreboard space, with Pause in the center. Matches send +100 to the correct score; opponent flips have a restrained red accent. Player-only streaks keep turn ownership visible. Equipped frames use circular artwork inside the team rims, and portrait and rim move together.
- **Loading:** the autumn opening screen has an illustrated logo and a carousel of distinct tiles from one collection. Tiles slide gently from right to the glowing center, then left, with a 2px lift. Artwork does not repeat during a loading screen, and the next launch selects a different tile theme. Startup artwork is prepared before Daily Rewards and Quests; reduced motion uses a short, still screen.
- **Daily welcome:** the first visit each UTC day opens an animated seven-visit journey with today’s rewards, a day medallion and nonrepeating encouragement. Progress advances to today and rewards appear in sequence; reduced motion shows the final state immediately. The full Daily Rewards calendar remains available from the menu.
- **Daily Quests:** three quests per UTC day, with an initial Easy and Medium guarantee, one reroll into a different difficulty, and Coin rewards with Gems on selected Medium and all Hard quests. Each completed quest offers a standard claim or a rewarded Claim 2×, once; ads are simulated without video. The illustrated page follows the daily welcome, with an OK button beneath the reroll note that appears only during login.
- **Shop and currencies:** earn 100 Coins for a win, 20 for a loss or 50 for a draw. Coins and Gems sit beside the profile. The illustrated Shop offers five currency packages, four individual boosters and three larger combinations, each with a Gem-based or more expensive Coin-only payment choice. Currency purchases are explicitly simulated for testing; no real payment is taken.
- **Boosters:** Shuffle, Hint, Freeze and Eagle Eye draw from the player’s persistent earned or purchased inventory. Every profile receives a once-only sampler of two of each booster. The first 30 login days grant 845 Coins and 26 boosters, or 1,690 Coins and 52 boosters with doubled claims. Only the player uses boosters.
- **Rank gains:** victories start with larger jumps and taper as the player approaches first place; draws and losses hold rank.
- **Menu:** each launch randomly chooses bamboo doors, a moonlit lantern garden or an autumn bridge, excluding the previous launch. Leaves and fireflies animate each scene. The former doors/sun/moon flash is removed from match entry, which now connects the face-off directly to the board. Effects pause when hidden; reduced motion is supported.

First launch assigns a default profile. Name, preset avatar and country flag can be edited at any time. There are no accounts, backend or live multiplayer. Profiles, settings, collection, rewards, achievements, currencies, quests and purchase receipts stay on the current browser/device. Audio starts after interaction.

## Publishing and local preview

`index.html` is the complete standalone game, containing 346 images and 16 font files alongside its code and styles. It supports offline play and requires no external assets or game server. The hosted game installs no service worker.

From the repository root:

```sh
node scripts/build-hub.mjs
python3 -m http.server -d _site 8080
```

Open `http://localhost:8080/mahjong-duel/`. Pages publishes this folder at `/games/mahjong-duel/` using the existing hub workflow.

Editable [source](source/README.md), runtime artwork, lockfile, tests and tile-lore references are included under `source/`. Run `npm ci`, `npm test` and `npm run build` there; copy `source/output/mahjong-duel-web.html` over this folder’s `index.html` for future releases.

## Release provenance

Updated from development `main`, source checkpoint `0c229a66995461a16aa24ef4f6012dab541afa48`. Previous releases remain in Git history. Collection counts and earned achievement unlocks are preserved: Bamboo becomes Marble, Granite becomes Sapphire, and Celestial joins Gold. Rarity-dependent achievement progress uses the four current tiers. Previously earned achievement points retain their original values through per-unlock receipts; increased rewards apply only to future unlocks.

The four launch themes are Ming porcelain, Dancheong, Stained Glass and Dutch Golden Age. Other themes have no in-game enable switch and their artwork is excluded from the runtime build. Hidden-theme collection progress remains stored; unavailable theme selections fall back to Ming porcelain. Legacy duel snapshots are discarded. Existing progression remains intact, including previously offered reward amounts; new currency balances and quest state initialize safely when missing. Shop artwork provenance is included in `source/output/shop-art/prompts.md`.

Build SHA-256: `f433a86deec107643b58a49cd1329d9a74f9503545f9963c88ecc863bc8531c5`.

See [third-party notices](THIRD_PARTY_NOTICES.md) for bundled library and font licenses.
