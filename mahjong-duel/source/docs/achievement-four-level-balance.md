# Four-level achievement balance

Updated October 9, 2026.

The six achievement families that previously had five or ten levels now have
four. The edition-related goals now follow themes; see [fixed theme editions](fixed-theme-editions.md). The other families retain their conditions. There are 43 trophy families and 74 active milestones.

## Targets and pace

All numbers are cumulative. Each later interval requires more progress than the
one before it; these are four actual unlocks, not four groups hiding extra levels.

| Achievement | Level I | Level II | Level III | Level IV |
| --- | ---: | ---: | ---: | ---: |
| Duelist — completed duels | 1 | 10 | 35 | 100 |
| Winning Form — wins | 1 | 5 | 20 | 60 |
| Pair Collector — personal pairs | 10 | 150 | 600 | 1,800 |
| Find Your Flow — best uninterrupted pair chain | 2 | 4 | 7 | 12 |
| Personal Gallery — distinct collected pictures | 10 | 35 | 80 | 160 |
| Daily Ritual — different login days | 1 | 7 | 21 | 60 |

A duel contains 30 pairs. At roughly 15 personal pairs per duel, Pair Collector
falls around the first duel, 10, 40 and 120 duels. At a 50% win rate, Winning Form
falls around 2, 10, 40 and 120 duels. These are pacing assumptions, not promises or
changes to AI difficulty. The middle stages fit the existing theme progression
targets of roughly 10, 26 and 51 completed duels; mastery remains a longer goal.

Streaks measure skill within one duel rather than time played. Collection depends
on which themes the player explores. Login days accumulate: missing
a day never resets progress.

## Achievement Points

Every four-level family uses the same reward ladder, with a 50 AP increase
between successive levels. Steeper progress targets still make later levels
longer goals, while the rewards avoid an oversized jump at mastery. The full
catalogue and frame thresholds are documented in
[achievement reward balance](achievement-round-points.md).

| Resized families | Level I | Level II | Level III | Level IV | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Duelist, Winning Form, Pair Collector, Find Your Flow, Personal Gallery, Daily Ritual | 50 | 100 | 150 | 200 | 500 each |

A fresh profile can earn 7,500 AP across the whole catalogue: 4,950 AP from
multi-level tracks and 2,550 AP from one-time achievements. Shorter tracks use
the same ladder's first two or three rewards. One-time feats award 50, 100, 150
or 200 AP according to difficulty. Frames unlock at 500 / 1,500 / 3,000 / 5,000 /
6,500 AP; previously earned frames remain available. Coins, Gems, quests,
booster prices and theme unlock conditions are unchanged.

## Existing saves

- Original A001–A100 unlock IDs, timestamps and valid AP receipts remain stored.
- The resized tracks use new M001–M024 IDs. Old counters and earned thresholds
  establish which of these four levels are already complete, including a saved
  mastered trophy whose counter is incomplete.
- Mapped levels receive a zero-AP receipt; the old earned AP stays in the original
  ledger. The detail view attributes that historical AP to its corresponding
  visible level, without adding it to the wallet again. Tier buttons show the
  current catalogue reward; a differing historical payout is labeled
  “Previously earned” in the detail note.
- Future levels pay their full new reward, without clipping against an old family
  budget. Historical rewards are never repriced, so a migrated profile’s eventual
  total may differ from the fresh-profile maximum.
- Reloading or retrying migration does not repeat rewards. Old pending achievement
  notifications map to the current family and level.
- Reward schema version 5 preserves frame rights earned under the earlier AP
  thresholds as well as exact historical AP. Its dedicated raw-save backup is
  `porcelain:backup:before-achievement-pacing-v5`; it is written once before
  upgrading an established older profile and does not replace earlier backups.
- Before an established older save is loaded, its raw progression envelope is
  preserved once under `porcelain:backup:before-achievement-v3`. It is never
  overwritten. An engineer can export that value for manual recovery; normal
  gameplay never restores it automatically. An older application version does
  not understand the new M-series rewards, so use the snapshot for a rollback.

The migration changes no collection counts, currencies, booster inventory,
profile settings or other progression counters.

## Trophy artwork

Five new illustrations replace the remaining reused subjects:

| Achievement | New subject |
| --- | --- |
| Familiar Pictures | Two matching tile pairs beneath twin gold arches |
| Lasting Recall | Matching tiles connected by a jade ribbon and three gold beads |
| Guided Hand | A luminous bulb guiding the player toward a matching pair |
| Returning Rival | A porcelain calendar with jade checks and Mahjong tiles |
| Grand Tour (formerly Every Setting) | Four theme medallions with Eastern and Western tile symbols |

All 43 families now have distinct artwork identities. The 27 one-time images and
11 remaining atlas subjects are preserved. Four-level trophies grow from one to
three, six and ten laurel leaf pairs, reaching their full color and crown at
Level IV. Exact built-in image-generation prompts and asset provenance are in
[achievement-trophies-v3.json](achievement-trophies-v3.json).
