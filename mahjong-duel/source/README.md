# Mahjong Duel — Memory Collection

A portrait web memory Duel with four launch tile collections: Ming porcelain, Dancheong, Stained Glass and Dutch Golden Age. The game has a wood-and-parchment interface, sliding doors, optional profiles, ceramic collision effects and a golden result celebration. Matchmaking selects a simulated opponent from 1,000 preset players. A tile binder, rarity-weighted deals, four boosters, twelve formations and borderless themed playfields add collection progress and variety.

## Play

- Open **output/mahjong-duel-web.html** directly in a modern browser. The self-contained file includes all artwork, fonts, styles, and code and works offline.
- The latest remake build is **output/mahjong-duel-web.html**. Upload the contents of **dist/** to a static website host. Older ZIP archives are snapshots and do not contain this remake.
- Open **output/catalogue/index.html** to review all nine collections, their shared tile backs, and five board formats: Original, Tall phone, Phone, Tablet, and Square. Full images and optimized WebP downloads are included.
- **output/mahjong-duel-art-catalogue-2026-09-25.zip** packages the revised catalogue, artwork, manifests, runtime sprites, and offline game. Extract the whole archive before opening its `index.html`.

```sh
npm install
npm run dev
```

Open http://localhost:5173. The first eligible visit each UTC day opens a focused daily welcome, followed by Daily Quests. The welcome has a day medallion, an animated seven-visit progress strip, today’s rewards and a fresh encouraging message; the full Daily Rewards calendar stays available from the menu. Claim or close the login rewards, then tap the login-only OK button beneath the Daily Quests reroll note when ready and press Play Duel to choose an unlocked theme or Random Match. The final Play Duel button opens matchmaking for that theme's tiles and matching board background. Eastern/Western selection and Rules are available in Settings. First launch automatically assigns a default Player profile, preset avatar and Global flag; profile editing is optional. Use the portrait button to change the name, choose from eight avatars, select a country flag, and equip an unlocked avatar frame at any time. Equipped frames follow your avatar into player cards.

App launch opens an autumn loading screen with the illustrated Mahjong Duel logo and a three-slot tile carousel. Distinct artwork from one collection slides from right to the glowing center, then out left, with only a gentle 2px lift. Its shuffled sequence never repeats an artwork during a loading screen. Each launch randomly previews one of the four active tile themes and excludes the previous loading theme, saved separately from gameplay and menu scenery. Startup artwork is prepared before the daily-login flow begins; a warm launch shows one full cycle and a short fade. Failed artwork cannot block entry indefinitely. Gentle motion and system reduced motion use a still, shortened loading screen. This appears only at launch, so it adds no extra transition between matchmaking and the board.

The main menu presents Play Duel, Collection and Shop below center. Coins and Gems appear beside the profile, in that order; Daily Quests sits opposite Leaderboards beside the title. The theme toolbar button is hidden and the remaining Daily Rewards, Achievements and Settings buttons align to the right. The hidden tile fan and retired theme popup remain in the source. A phone on the same Wi-Fi can use the Network URL printed by Vite. Phones use a portrait layout; tablets scale the board, and short landscape phones put match controls beside it. Tablets retain the full-width top scoreboard.

Matchmaking lasts a fresh random 2–4 seconds. A counterclockwise portrait orbit and sequential dots show the search. Cancel returns to the same theme choice and scroll position while searching. Finding an opponent removes the search controls and begins a 2.5-second face-off: a 600ms portrait/name reveal, a 600ms gold VS accent, an 800ms portrait transfer into the visible scoreboard, then a 500ms “You play first” cue before input opens. Random Match resolves its theme once, before showing the search card. The roster uses 1,000 unique handles and the eight existing portraits, avoids the player's name and portrait, and excludes the previous opponent within the visit. The selected identity stays fixed through the duel and result.

Each launch theme has its own gentle paper illustration and blue/red portrait ink, with a shared gold VS ornament. During the last 240ms of portrait transfer, the circular matchmaking rim gives way to the equipped rounded profile frame with a small settle and gold glint. The frame stays visible in the scoreboard.

The previous doors/sun/moon flash transition is no longer part of match entry. Blue enamel belongs to you on the left; red enamel belongs to your opponent on the right. Equal scoreboard panels show large portraits and scores, with a separate central Pause control. Pair progress, First to 16 and the active turn label sit underneath. Both players’ matches send +100 to their own score; turn changes transfer the active rim and play a distinct cue. Opponent reveals have a restrained red edge. Player-only streak celebrations appear below the always-visible turn ribbon.

Match-entry timers and animations pause while the tab is hidden. Gentle motion and system reduced motion keep the ordered sequence with crossfades instead of moving portraits/tiles. Sound respects Settings; the face-off requests a brief haptic where the browser supports it. Gameplay remains locked until the board has visibly settled. Normal gameplay still auto-pauses when backgrounded.

```sh
npm run build
npm test
```

The build produces `dist/` and the standalone HTML, including all launch runtime artwork. There is no backend or online multiplayer: matchmaking chooses a preset identity for the local AI. Profiles, settings, themes, binder, earned boosters, currency balances, daily quests, achievements, simulated standings and formation history are saved on this browser/device. Duels are held only in memory and cannot be saved or continued after leaving or reloading.

Each app launch randomly chooses one of three main-menu scenes, excluding the previous launch's choice: the original bamboo doors, a moonlit lantern garden, or an autumn bridge. The choice stays fixed through menu navigation and duels. Bamboo leaves, softly glowing fireflies, and tumbling maple leaves accompany their respective scenes; effects pause behind dialogs or when the page is hidden, and Gentle motion or system reduced motion hides them. The two supplied alternatives are preserved unchanged in `public/assets/remake/lantern-night.png` and `autumn-daylight.png`, and are embedded in the standalone build. Menu scenery does not change the selected in-match board theme.

## Memory rules

- Every live stone begins face down with the same back as all other stones in its theme.
- **Only another stone overlapping above it prevents a flip. Horizontal neighbors do not matter.** Removing upper stones unlocks the layer below.
- Flip two stones. A matching pair stays visible for 240 ms, then flies together and makes contact after 160 ms with a shared ceramic clack. The next move is available at contact while the effect finishes. A mismatched pair stays visible for 0.9 seconds, then turns face down again. A third flip waits until the pair resolves. Realistic varies its thinking and flip delays; Modern and Original start after 280 ms and pause 260 ms between flips.
- Pausing or hiding the browser pauses in-progress reveals, collisions and booster effects. Continue returns to the same live duel. Leave duel ends it after confirmation; reloading also discards it. Settings and Rules return through their parent dialogs. Changing the ruleset during a match applies to the next duel only. There is no visible match timer.
- Hidden stones' accessible names give only their position and availability. Eagle Eye additionally announces rarity. Face names are announced only when exposed.

## Theme progression

Eastern and Western each have their own unlock path, derived from their existing saved collection counts. One successful player pair counts as one match of that artwork; opponent matches do not count. Progress is permanent on this device and is never spent. Each required artwork must reach its own match threshold; the first two gates allow a quota of low-rarity artworks:

| Theme | Requirements in the selected edition |
| --- | --- |
| Ming porcelain | Available from the start |
| Dancheong | 14 of 22 Ming Marble and 7 of 10 Sapphire artworks, each matched 3 times |
| Stained Glass | 18 of 22 Dancheong Marble and 8 of 10 Sapphire artworks, each matched 3 times, plus every Ming Amethyst and Gold artwork matched 2 times |
| Dutch Golden Age | Every Stained Glass Marble and Sapphire artwork matched 3 times, plus every Dancheong Amethyst and Gold artwork matched 2 times |

Each previous theme must also be unlocked. There are 22 Marble, 10 Sapphire, 5 Amethyst and 3 Gold artworks per theme and edition. Existing collection counts contribute immediately, without resetting either edition. Bars count partial copies (1/3, 2/3), capped at the required number of best-progress artworks. Collection and match results show progress toward the same next unlock. The model targets median unlocks around 10, 26 and 51 total duels, assuming 15 randomly sampled personal pairs per duel; these are estimates, not guaranteed unlock times. Locked cards are darkened; tapping one opens its requirements and per-artwork match counts. Random Match chooses only from unlocked themes, and the deal entry point rechecks availability before starting. Restarting a duel returns to theme selection.

The card player counts are cosmetic simulated populations, not real network activity. Each theme starts at a random 18,000–130,000 players. Counts persist in tab session storage across navigation and reloads, change at most 2% every three minutes, and stay within the same range. Returning after a long absence applies one nearby update rather than replaying missed intervals.

## Boosters and collection

Only the player uses boosters. **Daily Rewards and Shop purchases grant a persistent inventory**, with no per-duel refill or 20-item cap. Every profile gets a once-only sampler of **2 of each booster (8 total)**, including existing profiles once on update. The introduction lists its contents; earned inventory remains intact:

- **Shuffle:** rearranges surviving stones into a solvable board and clears position memory. Automatic deadlock rescue remains free.
- **Hint:** a legal matching pair glows and pulses for 1.5 seconds without flipping or teaching the opponent its identities.
- **Freeze:** queues one skipped opponent turn. It stays ready through your matches; your next miss consumes it and you play again. It cannot stack.
- **Eagle Eye:** hidden stones reveal their rarity-colored glows for ten seconds. This does not teach the opponent face identities.

The main menu's **Collection** opens a full-screen parchment page with the four launch themes and both editions (320 faces in total), a theme selector, collection progress and filters for Marble, Sapphire, Amethyst and Gold. The displayed Eastern or Western edition follows the choice in Settings; Collection has no separate edition switch. Phones show two columns of artwork; portrait tablets show three. Landscape tablets keep a three-column collection beside a persistent tile-details pane. The header stays available while browsing. In portrait and on larger screens, the artwork grid scrolls beneath the filters; short landscape phones scroll the controls and gallery together to leave enough room for full tiles.

Tap a collected tile to see its larger artwork, a one-sentence note on its cultural symbolism or theme-specific meaning, rarity and duplicate match count. Phones and portrait tablets open a full-screen details page; landscape tablets update the adjacent pane. Previous and Next browse collected tiles within the active rarity filter. Back returns to the same collection scroll position and restores focus to the selected tile. Uncollected artwork stays visible in a muted, locked state and cannot be inspected.

Art curation assigns 22 Marble (ivory-white), 10 Sapphire (blue), 5 Amethyst (purple) and 3 Gold faces in each 40-face edition. The former Bamboo and Granite tiers become Marble and Sapphire; the former Celestial showpieces join Gold. The balancing build draws fixed rarity counts per board; rarity does not change matching rules or points. Face-up tiles have a soft glow in their rarity color, with no colored border or corner tag. Every tier gently pulses; reduced motion keeps a steady glow. Face-down tiles conceal the glow unless Eagle Eye is active.

Existing collected faces, duplicate counts and earned achievement unlocks remain intact. “Every Rarity” requires the four current tiers; its progress is recalculated from collected artwork when saved progress loads. “A Rare Find” now requires a Gold match during Eagle Eye. Its existing saved counter is retained because current Gold covers the same artwork as the former Gold and Celestial tiers.

Inspector notes distinguish documented iconography from interpretations written for the collection, especially the fictional Neon Shrine and Brass Meridian themes. Museum and cultural references are recorded in `docs/tile-lore-*-sources.md`.

Only your successful matches collect tiles. Each match increases that artwork's `Matched ×N` total by one; opponent matches do not count. Collection identity includes theme, edition and face. A unique duel ID and physical pair receipt prevent duplicate collection awards. Collection counts and receipts persist together on this device. No online account, purchase or trading system is included.

## Eastern and Western

The supplied HTML informed the family system; senior feedback of 25 September 2026 supersedes its original inventory and wildcard recommendations. `output/<theme>/tile-manifest.json` defines the current art identities and match keys. The user's memory-mode instruction replaces the former horizontal-side restriction.

- **Both full sets:** 40 unique faces × 4 copies = 160 physical tiles per version. Every pair requires identical artwork; season and flower wildcards are retired.
- **Eastern:** six counts, six tiers/phases, six unframed symbols, six related silhouettes, and sixteen anchors. Only counts and tiers are ordered; symbols, kin, and anchors are unranked pictures.
- **Western:** forty independent pictures, with no ranked families.
- **Each playable round:** a subset of 15 kinds × 4 copies = 60 stones, in either version. The full catalogue size does not change the round layout.
- **Fixed rarity mix:** 16 Marble pairs (32 tiles / 8 artworks), 8 Sapphire pairs (16 tiles / 4 artworks), 4 Amethyst pairs (8 tiles / 2 artworks), and 2 Gold pairs (4 tiles / 1 artwork). Each deal chooses random artwork within each tier, with four copies of every selected face. Positions remain random, with no rarity-to-layer preference. Both editions use this mix and every catalogue face remains obtainable. The accepted Calm/Balanced/Intricate identifiers all use these quotas in this experiment; the former family-based draw quotas are replaced.
- Optional corner pips are actual 1–6 dot clusters, shown only on revealed count and tier faces.

All nine themes use the same family structure. Twelve formations retain their base outlines, bounds and 2–5 layers, with upper tiers thinned to 60 tiles: Crown, Terrace, Turtle, Diamond, Twin towers, Moon gate, Crossroads, Hourglass, Serpent, Lotus, Bridge and Fan. New games exclude the preceding formation, including across reloads. Every new deal and shuffle includes a verified complete solution. Player choices can still leave a blocked arrangement; Shuffle creates a new solvable arrangement without changing surviving faces.

## Duels and scores

Duel uses one shared 60-tile board against the local AI selected during matchmaking. You play first. Each matching pair earns 100 points and another attempt; a mismatch turns the stones back down and passes the turn unless Freeze is queued. A shared progress bar beneath the scores shows both players' pairs. **16 pairs secures the win, but play continues until all 30 pairs are cleared.** Equal scores at 15 pairs each draw.

Choose **Realistic**, **Modern AI** or **Original AI** under **Settings → Opponent AI**. The preference is saved on this device and applies when starting a new duel; changing it mid-match leaves the current opponent unchanged. This update selects Realistic for everyone once, then preserves subsequent choices. All three modes use the matched preset player's name and avatar, learn from both players' actual reveals, and obey the player's uncovered-tile rules.

- **Realistic:** learns your level gradually from completed, unassisted play on this device. It remembers only actual reveals, has limited and fallible memory, varies both flip delays, and has independent match form and focus. Full rules, probabilities, timing and persistence are documented in [realistic-ai.md](realistic-ai.md).
- **Modern AI:** retains the last two completed pair attempts, plus faces revealed during the current attempt. Every resolved pair advances this window, including matches that let the same player go again. Seeing a face again refreshes its memory. It always uses an available pair or partner it remembers.
- **Original AI:** logs every revealed tile without a fixed memory window. Before choosing tiles, it has a 40% chance of recalling an available known pair. Otherwise it picks a random uncovered first tile, then has a 35% chance of recalling a known uncovered partner. Failed recall falls back to all legal choices, including accidental matches. After **every completed two-tile attempt by either player**, including matches and Freeze-retained turns, each surviving memory independently has a 25% chance of deletion. Reveals, pauses and animations do not cause extra decay.

Neither opponent inspects unselected hidden faces or the solution. The four current boosters replace Peek. Hint and Eagle Eye do not teach face identities. Input and boosters wait during the opponent's turn. A board with no legal pairs automatically reshuffles without changing scores or turns; **manual and automatic Shuffle completely clear every opponent's position memory**.

AI roadmap (not implemented): difficulty tiers per realm, with recall rates increasing by Era, and tournament AI profiles.

This branch is Duel-only with one Calm setting. There is no Continue duel entry or save action. Startup removes the legacy `porcelain:session` snapshot; no match state is written back to storage. In-match pausing preserves the board only for the current visit. Leaving or restarting ends that match, while already-earned binder progress and player preferences remain.

## Rewards, achievements and standings

The menu utility row is Daily Rewards → Achievements → Settings, aligned right. Daily Quests and Leaderboards sit on the left and right of the Mahjong title. Theme selection follows Play Duel, with Collection and Shop beneath it.

- **Daily Rewards:** accumulated visits, one per UTC day, with a repeating seven-day reward cycle: Hint; 25 Coins + Shuffle; 30 Coins + Eagle Eye; 40 Coins; 50 Coins + Hint; 60 Coins; Freeze. Every 30 visits adds one of each booster. The first 30 visits give 845 Coins + 26 boosters, or 1,690 Coins + 52 boosters with all claims doubled, excluding the eight-booster sampler. First login uses a separate welcome screen: the progress line advances to today, the current day stamps into place, and rewards appear in sequence. Gentle motion and system reduced motion show the final state immediately. Saved accumulated login days select 4,096 distinct two-line greetings, followed by unique day-specific greetings; missed days and reloads never restart the sequence. A single 30-day calendar, current rewards, grand-reward progress and both claim actions fit on one screen without scrolling. Missed days retain progress; unclaimed entitlements remain available. Claiming opens today’s Daily Quests if they have not been presented yet; otherwise it returns to the menu. It never changes standings.
- **Rewarded ads in this testing build:** Claim rewards 2x instantly simulates successful ad completion without showing a video. `src/rewarded-ad.js` isolates the provider and test configuration. Production mode requires a provider that reports completed/cancelled/failed/unavailable; it is not a live ad SDK. Entitlements are snapshotted before the request, and only confirmed completion doubles that snapshot, once.
- **Achievements:** 43 trophy families preserve all 100 milestone IDs, A001–A100. Six shelves—Duels, Memory, Comebacks, Collection, Boosters and Rituals—show every trophy; search and status/category filters are hidden. The 16 families with multiple levels group milestones that share the same qualifying counter; each later level has a strictly larger AP reward and a more decorated trophy. Detail pages let you preview every level's appearance, exact condition and reward. The other 27 trophies retain individual locked/unlocked details without invented levels. Returning from a detail preserves focus and list position. The menu prepares the shared trophy artwork during idle time; nearby shelves render first, and offscreen artwork activates before scrolling into view without changing card sizes. Offline packaging uses one short, reusable image URL instead of repeating the embedded image on every card. Newly earned milestones appear in a top banner with their own chime; simultaneous unlocks are grouped and queued, pause holds the queue, and reload never replays existing unlocks.
- **Achievement Points:** a new profile can earn 3,730 AP across all milestones. Saved unlock IDs, timestamps, counters and already earned AP remain intact. A per-unlock `awardedPoints` ledger records historical rewards, while future unlocks receive the new rewards; a save with all original achievements already earned retains its 1,465 AP. Details distinguish the amount earned from the reward available on a locked milestone.
- **Avatar frames:** lifetime AP unlocks Bronze Laurel at 100, Porcelain Crest at 250, Jade Guardian at 500, Golden Triumph at 1,000 and Celestial Glory at 1,400. The Point milestones page shows every frame and its requirement. Equip an unlocked frame there or in the profile editor; the selection persists and appears on your player cards. AP is never spent, and frames do not change gameplay or booster inventory.
- **Leaderboards:** stable fictional competitors and local simulated positions, starting at 10,000. Every completed win moves up by `round(1500 × (position / 10000)^1.5)` places: 1,500 at #10,000, 530 at #5,000, 47 at #1,000 and 2 at #100. Gains taper smoothly, with at least one place below first and no movement past #1; loss/draw holds. Existing saved positions are preserved, and the curve applies to future wins. Bronze, Silver, Gold, Jade, Master and Grandmaster begin at 0/10/30/75/150/300 completed wins. Profile edits and reloads do not reroll opponents or standings.
- **Required result route:** clear all 30 pairs → existing result screen → Continue → Leaderboards → main menu. Completion persists before the result appears. The highlighted player row lifts above its neighbors, climbs and lands over two seconds, followed by a 1.5-second league promotion when earned. Manual reopening or cold reload does not replay the presentation.
- **Player streaks:** local matches build a chain from Double through Phenomenal; above 15 the count continues without replaying the peak flourish. Local mismatches reset it, including Freeze-protected misses. Opponent attempts, shuffles and pauses do not reset it. Large porcelain-and-gold celebrations appear below the scores, temporarily over the board without shrinking tiles or intercepting input. Eight contextual Turning Points retain distinct portrait seals; there are no opponent streaks or score multipliers.

`src/progression.js` owns the versioned `porcelain:progression` envelope: counters, sets, booster wallet, currencies, daily quests, rewards, achievement unlocks, awarded AP, ranking, collection and receipts are committed together. `src/achievement-milestones.js` defines the trophy families without changing their underlying unlock conditions. The existing collection key is mirrored after the authoritative write. Existing collection evidence can backfill collection achievements only; unsupported win/chain/history counters start at zero. The 16th local pair freezes conditional-win facts, but only a completed board awards the win. Abandoning a duel keeps already earned pairs while discarding its live tracker. No active duel is saved.

Reward quantities, day policy and simulated-rank values are small configuration objects in `daily-rewards.js` and `leaderboards.js`. Daily, booster, physical-pair and completion receipts prevent repeat grants. Storage failures fall back to the current visit without crashing.

## Coins, Gems, daily quests and Shop

- Balances start at zero. A completed duel pays **100 Coins for a win, 20 for a loss and 50 for a draw**, once per game. Securing 16 pairs alone or abandoning a game does not pay Coins. Older completed duels are not paid again during migration.
- Every UTC day offers **three quests from a 33-quest pool**. The first two provide one Easy and one Medium; the third has a random difficulty. Selected objectives avoid duplicate metrics. Progress counts only the player’s accepted actions after the quest starts; opponent actions and replayed events cannot advance it.
- Daily Quests uses illustrated objective cards with difficulty labels, progress bars, separate reward rows and wooden reroll controls. All 33 quests have artwork across 13 objective families. Phone cards stack vertically; landscape tablets show three columns. Short screens and enlarged text scroll without shrinking touch targets.
- **One free reroll per day** replaces an unfinished quest with a different difficulty and resets that slot’s progress. The initial Easy/Medium guarantee need not survive a reroll. Claimed or completed quests cannot be rerolled. Selection, progress, claims and the used reroll survive reloading.
- Quest payouts: Easy **20–40 Coins**; Medium **40–60 Coins**, plus **2 Gems** on five skill/effort objectives; Hard **80–100 Coins + 4–6 Gems**. The initial three quests average 126.26 Coins + 2.74 Gems if all are completed. Gems have no login or duel payout. Previously assigned quests keep their original rewards; rerolls and future days use the new schedule.
- Completed quests offer **Claim** or **Claim 2×**, with the doubled amount previewed. The test ad succeeds without video. Each quest settles once; pending snapshots can finish after midnight without claiming a new quest. Failed or interrupted ads grant nothing and preserve valid standard claims. Reload never resumes an abandoned ad request.
- Every booster offers a separate Gem and Coin route: **Hint 6 Gems or 1,200 Coins; Shuffle 8 or 1,600; Freeze 10 or 2,000; Eagle Eye 4 or 800**. Focused Mind (3 Hints + Freeze + Eagle Eye): **300 Coins + 20 Gems or 5,200 Coins**. Duel Kit (3 of each): **1,200 Coins + 40 Gems or 12,800 Coins**. Master’s Kit (6 of each): **2,400 Coins + 70 Gems or 23,600 Coins**. Confirmation charges only the chosen route and grants inventory atomically.
- **IAP is simulated in this testing build. No real money is charged.** Packages grant 1,000 Coins for $0.99, 20 Gems for $0.99, 1,000 Coins + 50 Gems for $2.99, 2,000 Coins + 90 Gems for $4.99, or 4,500 Coins + 190 Gems for $9.99. USD prices are prototype tuning; no store SDK, billing backend or verified real-money receipts are connected.
- Shop keeps balances visible while scrolling, presents five illustrated currency packs with a wide Imperial Chest card, and separates individual boosters from combo packs. Purchase confirmation preserves list position and keyboard focus. The five transparent illustrations are delivered as optimized WebP assets; originals and generation prompts are in `output/shop-art/`.
- `src/economy.js` owns prices and exchange quantities; `src/daily-quests.js` owns the quest pool, selection and progress. Existing saves acquire the new fields without resetting collections, achievements, inventory or standings. Balances and receipts remain local to this browser/device.

## Theme assets and catalogue

The art catalogue’s Collection dropdown groups **Launch:** Dancheong, Ming porcelain, Stained Glass, and Dutch Golden Age; **Later:** Guo Xi, Xia Gui, Dunhuang, Brass Meridian, and Neon Shrine. Only the four Launch themes are available in the game, with no in-game option to enable Later themes. All nine remain in the separate art catalogue. Later-theme artwork is omitted from production game builds; stored collection progress for those themes is preserved for future use. Previously selected Later themes fall back to Ming porcelain. Together they contain 720 active face designs. `output/guo-xi/index.html` redirects to the shared catalogue while preserving version and board-format choices.

Each of the nine `output/<theme>/` folders contains:

- Original supplied front-face artwork and matching manifest.
- `tile-back.png`: the full-resolution 1086 × 1448 tile back.
- `tile-back.webp`: the 384 × 512 game-optimized back.
- A `back` record in the manifest and updated design notes.
- `board-source.jpg` and `board.webp`: the original landscape board from the supplied PDF.
- `board-tall`, `board-portrait`, `board-tablet`, and `board-square` PNG/WebP pairs: naturally recomposed board artwork for tall phones, phones, tablets, and square windows. Each has a `-provenance.json` recording its references, prompt, native dimensions, and generation method.

The nine balanced backs were generated using built-in ImageGen, individually inspected on stacked game boards, and optimized for the game. Each has one medium-sized theme motif, a quiet light surface, and a fine pale frame. The earlier ornate and sparse versions are archived in `output/tile-backs/ornate-v1/` and `output/tile-backs/quiet-v2/`. Every stone within a theme uses one identical back across both rulesets. No back reveals face identity or rank. Exact prompts and source-image provenance: `output/tile-backs/prompts.json`.

The original board artwork comes from pages 3–11 of `output/catalogue/Mahjong-Duel-Theme-Proposal.pdf`. Built-in ImageGen reference editing produced four additional aspect variants per theme, 36 new images in total, preserving the original palette, materials, and characteristic motifs. The original landscape images remain intact. PNGs retain the generator's native output; these are approximately 1.57-megapixel images, not 4K upscales. Exact dimensions are recorded in each provenance file.

The game chooses the whole board image closest to the viewport's aspect ratio and scales it uniformly to fill the screen. There are no sliced corners, joined image blocks, repeated edge strips, or stretched motifs. Some perimeter cropping is expected when the screen and source proportions differ. The catalogue displays every image in full at its natural proportions. `public/assets/boards/` contains runtime copies. Compare every theme with tiles face down and face up in `output/boards/review.html`; source provenance and the art-pass notes are in `output/boards/`. This pass is applied to the memory branch only.

`public/assets/backs/` contains runtime copies. `public/assets/tiles/` contains all 720 front-face sprites, cropped at their recorded atlas bounds. Original art sheets remain intact; the manifest identifies current crops. Superseded framed symbols may remain beside unchanged kin artwork on older mixed sheets, while active symbols use `east-symbols-v2.png`.

```sh
node scripts/prepare-game-assets.mjs
python3 scripts/build_catalogue_viewer.py
npm run build
python3 scripts/package-art-catalogue.py
```

Sprite regeneration uses Python/Pillow. The catalogue generator reads `scripts/catalogue-base.html` and preserves the shared-back preview, five board formats, and download controls. The catalogue works offline and retains its Eastern/Western inventories, grouped theme menu, size, grayscale, pips, labels, and face inspector. Run the packager after manifests, sprites, the standalone game, and review exports are current; it verifies SHA-256 checksums and ZIP CRCs, retains the previous extracted catalogue, and refreshes `tmp/art-catalogue-package/extracted` from staging.

## Implementation and verification

React, Vite, Motion, Phosphor icons, self-hosted Manrope and Cormorant Garamond. Web Audio synthesizes dry 145 ms ceramic impacts locally; the tile fan and matching collisions use the same sound. Gesture unlocking, voice limits, mute, and reduced motion are supported. There are no remote fonts or runtime services.

Unit tests cover uncovered-only flips, overhead blocking, exact-picture matching, retired-save rejection, difficulty draws, all themes, 400 solved seeded deals, 120 rescue shuffles, human reveal timing, immutable moves, and memory-AI discovery. Getter-based tests verify that AI does not read hidden identities before selecting a flip.

`tests/gameplay-check.cjs` is a historical browser check for the earlier game flow. Set `PLAYWRIGHT_MODULE` to your installed Playwright module when it is not on the normal module path. It retains retired Peek, Undo and saved-round expectations and is not the current UI acceptance gate.

`tests/ui-polish-check.cjs` checks mouse/touch sound gestures and matching motion in Chromium and WebKit. `tests/audio-check.cjs` checks synthesized output, headroom, rate limits, and safe browser fallbacks.

The original face-up build was checkpointed before these changes as **1fa6123** (`feat: add portrait Mahjong Duel web build`).

## Full-screen board UI branch

`codex/fullscreen-board-ui` extends the memory game with a single board backdrop across the entire viewport, from the main menu into play. The original framed memory presentation is checkpointed on `master` at `196da34`. All nine themes have on-art text, translucent controls, dialog surfaces, focus colors, and readable selected/disabled states. The large centered title and interactive tile fan are retained. Presentation changes live in `src/fullscreen-board.css` and `src/theme-ui.js`; game rules and timing are unchanged.

The complete artwork fills the screen using the nearest available aspect variant. UI can sit over the edge artwork while the tile stack retains its available play space. Tablets use larger menu artwork and controls, centered dialogs, a taller portrait board, and a compact control column in landscape. Rotating an active game preserves its progress and current reveal. Theme-specific surfaces keep dialogs, controls, and text readable on both pale and dark boards. Game rules, matching, scoring, and memory timings are unchanged by this art pass.

`output/boards/review.html` compares each theme's menu, face-down board, and face-up art reference.

Labels and controls use theme-colored backings to stay legible over the artwork. Match captions, dialog text, and disabled states have been checked across all nine themes; small controls provide 44 px touch areas while retaining the board's proportions. Readability review notes are in `output/boards/ART-PASS.md`.

`tests/duel-check.cjs` verifies shared-board turns, scoring, visible AI attempts, input locks, pause/resume, saved turns, reshuffles, final outcomes and responsive Duel controls. Set `GAME_URL` to the running preview and `PLAYWRIGHT_MODULE` to an installed Playwright package; add `--webkit` for WebKit.

## Remake verification

- `npm test`: engine, catalogue, formations, shared Duel, ghost memory, inventory, rarity, collection, all 100 achievement IDs, family coverage, increasing milestone rewards, historical AP migration, sparse saved unlocks, avatar-frame eligibility and profile persistence, reward receipts, ranking, winning snapshots, memory observations, streak crossings and booster follow-through tests.
- `PLAYWRIGHT_MODULE=/path/to/playwright node tests/opponent-settings-check.cjs` (add `--webkit`): phone/tablet AI controls, saved preference, next-duel changes, mode-specific Rules, and real turns with all three modes. Unit tests also check Realistic adaptation and visibility limits, Original recall/decay rates, and unchanged Modern decisions.
- `PLAYWRIGHT_MODULE=/path/to/playwright node tests/game-balance-check.cjs` (add `--webkit`): all eight launch theme/edition combinations, exact 30-pair rarity quotas, phone/tablet formations, 16-pair victory threshold, a full real-pointer win and 15–15 draw with correct one-time rewards.
- `PLAYWRIGHT_MODULE=/path/to/playwright node tests/realistic-ai-check.cjs` (add `--webkit`): actual variable thinking and second-flip delays, pause/resume and hidden-tab timer continuity, completed-duel learning and persistence.
- `PLAYWRIGHT_MODULE=/path/to/playwright node tests/economy-revision-ui-check.cjs`: Chromium/WebKit phone and tablet checks for starter migration, both payment routes, Coin purchases, quest 2× claims, partial Collection progress and reload.
- `PLAYWRIGHT_MODULE=/path/to/playwright node tests/economy-flow-check.cjs` (add `--webkit`): first-launch sequencing, daily reroll, quest claims, simulated currency packages, booster purchases, a full real-pointer win, persistence and day rollover.
- `PLAYWRIGHT_MODULE=/path/to/playwright node tests/daily-quests-layout-check.cjs` (add `--webkit`): phone/tablet orientations, all 33 quest objectives and icons, enlarged text, 44px controls, claims, reroll confirmation and persistence.
- `PLAYWRIGHT_MODULE=/path/to/playwright node tests/shop-layout-check.cjs` (add `--webkit`): responsive illustrated Shop cards, sticky balances, enlarged text, zero/large balances, all 12 products, purchase targets, confirmation return and simulated-purchase persistence.
- `PLAYWRIGHT_MODULE=/path/to/playwright node tests/main-menu-layout-check.cjs` (add `--webkit`): 31 phone/tablet/desktop cases including 320×480, currencies beside the portrait, top-right utility alignment, large balances and enlarged currency text, title clearance, 44px touch targets, real navigation and a fallback without `:has()` support.
- `PLAYWRIGHT_MODULE=/path/to/playwright node tests/theme-selection-check.cjs` (add `--webkit`): theme selection, locked requirements, independent edition progress, random and saved-choice guards, session populations, and phone/tablet layouts.
- `PLAYWRIGHT_MODULE=/path/to/playwright node tests/progression-flow-check.cjs` (add `--webkit`): real-pointer 30-pair completion, instant test double claims, persistent inventory, result-before-ranking, no presentation replay, the complete achievement gallery with hidden search/filters and no-save abandonment.
- `PLAYWRIGHT_MODULE=/path/to/playwright node tests/progression-outcomes-check.cjs` (add `--webkit`): actual AI playthroughs ending in loss or draw, held standings, local-only streaks and one-time completion across reloads.
- `PLAYWRIGHT_MODULE=/path/to/playwright node tests/achievement-flow-check.cjs` (add `--webkit`): live unlock banners, queued notifications through pause, simultaneous large streaks, unchanged board dimensions and no cold-reload replay.
- `PLAYWRIGHT_MODULE=/path/to/playwright node tests/achievement-loading-check.cjs` (add `--webkit`): menu preloading, shared image references, deferred artwork with stable scrolling and focus, observer fallback, and offline standalone operation. Build first; `--dev-only` skips the packaged checks.
- `PLAYWRIGHT_MODULE=/path/to/playwright node tests/achievement-gallery-check.cjs` (add `--webkit`): all 43 families and 100 milestone details, distinct tier previews, hidden search and filters, legacy earned AP versus future rewards, frame thresholds and equipping without spending AP, restored focus/scroll, phone/tablet layouts, keyboard navigation and reduced motion. Add `--layout-only` for focused phone/tablet gallery and detail navigation checks. Captures and reports go to `output/remake/achievement-gallery-review/`.
- `PLAYWRIGHT_MODULE=/path/to/playwright node tests/daily-welcome-check.cjs` (add `--webkit`): first-login welcome, same-day suppression, next/missed-day persistence, standard/double claims, access to the full calendar and responsive reward layouts. `tests/daily-welcome-motion-check.cjs` verifies animated progression, pause/resume and reduced-motion states.
- `PLAYWRIGHT_MODULE=/path/to/playwright node tests/menu-transition-check.cjs` (add `--webkit`): door, sunlight and glowing-crescent entry sequences through real theme selection, phone/landscape alignment, hidden-tab pause/resume, reduced motion and a complete playable board after entry.
- `PLAYWRIGHT_MODULE=/path/to/playwright node tests/matchmaking-check.cjs` (add `--webkit`): responsive search/found states, counterclockwise orbit and sequential dots, 2–4 second boundaries, cancellation and stale timer guards, retained theme and opponent identity, 2.5-second face-off/portrait transfer, visible tile entry, input locking, hidden-tab pause and reduced motion.
- `PLAYWRIGHT_MODULE=/path/to/playwright node tests/pvp-feedback-check.cjs` (add `--webkit`): responsive equal player panels, maximum score/pulse bounds, visible turn ownership through streaks, independent blue/red score flights, pause/reduced motion, and real consecutive-match/opponent-reveal paths.
- `PLAYWRIGHT_MODULE=/path/to/playwright node tests/progression-ui-check.cjs` (add `--webkit`): ten phone/tablet viewports, no-scroll Daily Rewards, achievement navigation, menu hit targets, reward receipt totals, text enlargement and ranking presentation fixtures.
- `tests/streak-feedback-check.cjs` and `tests/streak-audio-check.cjs` (same Playwright environment; each runs both engines): streak ownership, layout, reduced motion, pause/resume, shared audio, voice limits and cancellation.
- `PLAYWRIGHT_MODULE=/path/to/playwright node tests/menu-flow-check.cjs` (add `--webkit`): simplified menu, phone/tablet layout, Settings ruleset and Rules navigation, pause/leave behavior, removal of legacy duel snapshots, fresh deals, and persistence of profiles, preferences and collected tiles.
- `PLAYWRIGHT_MODULE=/path/to/playwright node tests/menu-backgrounds-check.cjs` (add `--webkit`): all three launch scenes on phone/tablet, no consecutive repeats, stable scenery through menus and duels, reduced motion and storage fallback.
- `tests/tile-binder-check.cjs`: full-screen Collection filters, all 320 launch art images, responsive columns and phone/tablet sizing.
- `tests/tile-inspector-check.cjs` (add `--webkit`): collected-only details, lore, Previous/Next navigation, Back/Escape return, restored collection position and landscape tablet details panes.

The earlier `gameplay`, `duel`, `ui-polish`, `remake`, `remake-motion`, `progression`, `pacing`, `network-launch`, `launch-rarity` and `viewport-compat` browser scripts document previous UI/save contracts. They rely on persisted match fixtures and are historical checks; the current in-memory duel does not accept those fixtures. Current browser checks use the live UI and write review captures under `tmp/` or `output/`.

- New generated UI art lives in `public/assets/remake/`; exact prompts and provenance are in `output/remake/art-provenance.json` and `public/assets/remake/avatars-provenance.json`. Existing theme assets are preserved.
- Trophy subjects use the 16-illustration atlas at `public/assets/remake/achievement-trophies.png`; `src/achievement-trophy.jsx` adds level-specific laurels, crowns, glints and locked/preview states.
- Current borderless playfields live in `public/assets/boards/*-playfield.webp`. Native AI images, prompts, hashes and contact sheet are in `output/remake/board-refresh/`. The older framed board catalogue remains archived unchanged. Current screenshots and sizing metrics are in `output/remake/progression-review/`.
