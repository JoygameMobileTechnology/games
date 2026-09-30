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

The four launch themes offer 320 collectible faces. Packaging prunes unavailable-theme artwork from generated builds while preserving full source artwork and saved collection identities. Runtime artwork is included in `public/`; original production atlases and QA captures remain in the development workspace.

## Verification

`npm test` runs 203 tests covering matching, formations, ghost memory, boosters, collection persistence, rarity migration, rewards, achievements, simulated standings, menu scenery, theme progression, currencies, daily quests, Shop purchases, both AI profiles and all 720 cultural tile notes.

Browser checks require a separate Playwright installation with browser binaries. Set `PLAYWRIGHT_MODULE` to that installation and `GAME_URL` to the running game. Current checks include `tests/menu-flow-check.cjs`, `tests/menu-backgrounds-check.cjs`, `tests/tile-binder-check.cjs`, `tests/tile-inspector-check.cjs`, `tests/progression-ui-check.cjs`, `tests/achievement-gallery-check.cjs` and `tests/achievement-loading-check.cjs`; use `--webkit` where supported. Daily login checks include `tests/daily-welcome-check.cjs` and `tests/daily-welcome-motion-check.cjs`, covering once-daily presentation, reward claims, the login-only quest OK button, responsive layouts, progress animation, pause/resume and reduced motion. Recent additions include `tests/main-menu-layout-check.cjs`, `tests/theme-selection-check.cjs`, `tests/daily-quests-layout-check.cjs`, `tests/shop-layout-check.cjs`, `tests/economy-flow-check.cjs` and `tests/opponent-settings-check.cjs`. Earlier scripts using persisted match fixtures document historical behavior: current duels are held only in memory. Captures go under ignored `output/` and `tmp/` directories.

## Game behavior

One shared face-down board, 40 pairs, your profile’s AI ghost and two selectable AI profiles. Both editions require identical artwork. Matching keeps your turn; missing passes it. Only tiles above block a flip. A 21-pair lead secures the win, and play continues until the board is empty. There is no duel saving or Continue action.

Modern AI remembers faces observed during the last two completed attempts and the current attempt. Original AI logs revealed tiles, recalls known pairs with 40% probability and a match for the first reveal with 35% probability, and deletes each memory record with 25% probability after every two-tile attempt. Both obey player tile availability, guess without seeing hidden faces and reset memory after Shuffle. Choose either profile in Settings. Profile creation is optional. Profiles, preferences and progression stay in browser storage.

The first eligible visit each UTC day opens a focused daily welcome with an animated seven-visit journey, a day medallion and today’s rewards. Accumulated login days choose 4,096 unique two-line greetings, followed by unique day-specific greetings; missed days do not reset progress. The full Daily Rewards calendar stays available from the menu. Gentle motion and system reduced motion show the final state immediately.

Daily rewards and Shop purchases grant persistent booster inventory. Double claims use a simulated rewarded-ad completion in this test build; a production provider must report successful completion. Achievements and standings are local, and multiplayer/ranking opponents are simulated. The trophy gallery groups 100 unlocks into 43 achievements, including standalone trophies with detail pages. All trophies appear on category shelves, with search and filter controls hidden. The menu preloads and decodes one shared trophy image during idle time. The offline build converts embedded artwork into one reusable short image URL; offscreen trophy art mounts as shelves approach the viewport while all controls keep their positions. The loading check covers menu preparation, scrolling, focus, rotation, observer fallback and standalone operation with external networking blocked. Milestone levels add richer trophy decoration and increasing rewards. A per-unlock point ledger preserves previously earned points. Five avatar frames unlock at 100, 250, 500, 1,000 and 1,400 points; equipment persists and follows the player portrait throughout the game. Trophy artwork and its generation prompt are documented in `docs/achievement-art.md`.

Collection uses the Eastern/Western preference from Settings. Phones show a two-column gallery and full-screen tile details; portrait tablets show three columns; landscape tablets add an adjacent details pane. Previous/Next browses found tiles within the filter, and Back restores the selected tile and scroll position.

Each 40-face edition contains 22 Marble, 10 Sapphire, 5 Amethyst and 3 Gold tiles. Rarity is cosmetic: ivory-white, blue, purple and gold glows do not change draw odds or scoring. Collection labels use matching gem icons. Tile faces have no rarity border or corner tag. Eagle Eye reveals hidden glows for ten seconds. Supporting lore sources are in `docs/tile-lore-*-sources.md`.

Each launch chooses one of three menu backgrounds without repeating the last launch. Bamboo leaves, fireflies and autumn leaves accompany the scenes. Navigation does not change the scene; Gentle motion and system reduced motion hide the ambient effects.

## Themes, quests and economy

Play Duel opens theme selection. Ming porcelain starts unlocked. Dancheong requires three matches of every Ming Marble and Sapphire artwork. Stained Glass also requires two of every Ming Amethyst and Gold artwork and three of every Dancheong Marble and Sapphire artwork. Dutch Golden Age follows the same pattern using Dancheong and Stained Glass. Eastern and Western collections unlock their themes independently, using existing saved counts. The selected theme supplies both tiles and board; Random Match uses only unlocked themes. Cosmetic populations persist through the tab session and change gradually every three minutes.

Completed duels award 100 Coins for wins, 20 for losses and 50 for ties. Three quests reset each UTC day with an initial Easy and Medium guarantee and one daily reroll into a different difficulty. Quest rewards grant Gems or Gems plus Coins. Daily Quests follows the daily welcome and remains open until closed. During login, an OK button below the reroll note returns to the menu; manually opening Daily Quests does not show this button.

The illustrated Shop contains five currency packages, four individual boosters and three combo packs. Currency purchases are simulated for testing and require confirmation; no real payment is taken. Booster purchases spend persistent Coins and Gems. Existing saved progression is preserved while absent currency and quest fields initialize safely. Shop art prompts are in `output/shop-art/prompts.md`; production PNGs remain in the development workspace, and optimized WebPs are included in `public/assets/remake/economy/shop/`.

See [third-party notices](../THIRD_PARTY_NOTICES.md) for bundled library and font licenses.
