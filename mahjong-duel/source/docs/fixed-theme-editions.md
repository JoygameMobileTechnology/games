# Tile sets belong to themes

Each theme now uses one fixed catalogue. Players choose a theme; there is no separate East/West selector in Settings or Collection.

| Theme | Tile artwork | Playable pictures |
| --- | --- | ---: |
| Ming Porcelain | Eastern | 40 |
| Dancheong | Eastern | 40 |
| Stained Glass | Western | 40 |
| Dutch Golden Age | Western | 40 |

There are **160 playable pictures** across the four themes. Theme selection, the collection binder, deals, loading tiles and matchmaking previews use the same mapping from `rulesetForTheme` in `src/themes.js`. New gameplay progression events must identify the edition belonging to their theme. Archived events and saved collection identities remain readable.

## One progression journey

Theme unlocks form one sequence: Ming Porcelain → Dancheong → Stained Glass → Dutch Golden Age. Each requirement uses the catalogue belonging to the theme where its pictures are collected. Existing rarity, copy-count and artwork-count requirements remain:

| Unlock | Previous theme’s Marble / Sapphire | Theme before that: Amethyst / Gold |
| --- | --- | --- |
| Dancheong | Ming: 14 / 7 distinct pictures, 3 matches each | — |
| Stained Glass | Dancheong: 18 / 8 distinct pictures, 3 matches each | Ming: every picture, 2 matches each |
| Dutch Golden Age | Stained Glass: 22 / 10 distinct pictures, 3 matches each | Dancheong: every picture, 2 matches each |

Previously unlocked themes stay unlocked, including themes earned through the retired edition of an earlier theme. Their prerequisite themes stay available as well.

## Existing collections

Collection schema version 1 becomes version 2. For each theme, pictures from the retired edition map one-to-one to pictures in its fixed edition. The mapping pairs stable artwork IDs within the **same theme and rarity**. Both catalogues have matching numbers of pictures in each rarity.

A saved match counts as one copy. For example, 2 existing canonical copies plus 3 retired-edition counterpart copies become 5 copies in the playable catalogue. Original archived counts and physical-pair receipts remain in the save. Version 2 marks the conversion as complete; an `editionCredits` ledger records the copied portion of each playable picture count. Reopening the game cannot transfer those copies again.

The visible collection and achievement picture counters count only the 160 playable pictures. Archived pictures are preserved for history and rollback; they do not inflate the visible catalogue. Collection mirrors reconcile original counts and transferred credits separately, then combine them. This preserves complementary progress even when the independent collection has already been upgraded while the progression envelope is still old. Receipts and retained theme unlocks are merged without counting them twice.

## Updated achievements

Achievement IDs stay stable, so earned rewards and timestamps retain their original value. The current [achievement reward balance](achievement-round-points.md) provides **43 families, 74 active milestones and 7,500 AP** to a fresh profile; the table below shows current payouts.

| Achievement | Goal | AP |
| --- | --- | ---: |
| Across Continents (formerly Both Traditions, `A088`) | Finish a duel in Ming Porcelain **or** Dancheong, and a duel in Stained Glass **or** Dutch Golden Age | 150 |
| Grand Tour I (formerly Varied Tables, `A099`) | Finish duels in 2 distinct themes | 50 |
| Grand Tour II (formerly Every Setting, `A100`) | Finish duels in all 4 themes | 100 |
| Personal Gallery I–IV (`M017`–`M020`) | Discover 10 / 35 / 80 / 160 playable pictures | 50 / 100 / 150 / 200 |

The four per-theme collection achievements still require 25 different pictures in their theme and each award 100 AP. Descriptions no longer ask the player to select or combine editions.

Historical completed-theme/edition entries determine the new travel counters **by theme identity**, regardless of the edition selected at the time. A former Western Ming duel counts as a visit to Ming Porcelain. Completing Ming twice using different editions counts as only one destination and one cultural region.

Existing unlocked achievements stay earned even when their original condition differs from the replacement goal. If saved history already satisfies a newly reachable replacement or collection goal, migration records it silently with a **zero-AP receipt**. This preserves earned AP, avoids duplicate reward notifications, and prevents a payout merely from merging old collection copies. Future goals reached through new play pay their full advertised round reward. The separate `themeAchievementsVersion: 1` marker makes this conversion idempotent; the AP balance separately advances the achievement reward schema to version 5. Tier buttons show the current catalogue rewards; a differing historical payout is labeled “Previously earned” in the detail note. Earlier earned frames remain available even when their current thresholds are higher.

## Recovery and rollout

The first load of an established older profile attempts to preserve its untouched JSON under:

- `porcelain:backup:before-fixed-theme-editions` — original progression envelope.
- `porcelain:backup:before-theme-tiles-v2:collection` — original independent version-1 collection.

These backups never overwrite a previous backup. The achievement-v3 and earlier reward backups remain separate, as does the current AP migration backup at `porcelain:backup:before-achievement-pacing-v5`. If browser storage is unavailable or full, in-memory migration still proceeds with historical receipts intact.

For a developer rollback, stop the app and restore the original progression and collection JSON together into `porcelain:progression` and `porcelain:collection`, then use the previous build. The previous build does not understand collection version 2. Backups represent progress before the transition; they are not an automatic rollback of later play. Reloading and saving the current build is safe, including when one collection mirror is stale. Avoid running an older build against the upgraded save, since it cannot write the new schema safely.
