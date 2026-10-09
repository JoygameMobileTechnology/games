# Achievement Point balance

The active catalogue contains **43 achievement families and 74 milestones**, worth
**7,500 AP** on a fresh profile. All rewards use increments of 50 AP. Requirements
and unlock order stay the same; this revision rebalances rewards and the frame
thresholds they feed.

## One reward ladder

Every multi-level family follows the same ladder. These are the individual
rewards for each level, not cumulative totals.

| Levels in the family | AP by level | Family total |
| --- | --- | ---: |
| Four | 50 / 100 / 150 / 200 | 500 |
| Three | 50 / 100 / 150 | 300 |
| Two | 50 / 100 | 150 |

Each successive reward increases by **50 AP**. A four-level family therefore
contributes 50, 150, 300 and finally 500 cumulative AP. Its last level is worth
200 AP, avoiding a large final reward that overwhelms the earlier levels.

| Achievement families | AP by level |
| --- | --- |
| Duelist, Winning Form, Pair Collector, Find Your Flow, Personal Gallery, Daily Ritual | 50 / 100 / 150 / 200 |
| By Heart, Table Traveller, Returning Rival | 50 / 100 / 150 |
| Attentive Eye, Ready Observer, Second Look, Familiar Pictures, Lasting Recall, Guided Hand, Grand Tour | 50 / 100 |

The six four-level families contribute 3,000 AP, the three three-level families
900 AP, and the seven two-level families 1,050 AP: **4,950 AP from milestone
tracks**.

## One-time achievements

The 27 one-time achievements contribute **2,550 AP**. Simple discoveries and
first-use successes award 50 AP; more involved feats award 100 AP; demanding
wins and reaching both cultural regions award 150 AP. Perfect Recall awards
200 AP, equal to a fourth-level milestone.

| AP | Achievement families |
| ---: | --- |
| 50 | On Your Own, Front Runner, Late Bloomer, A Fresh Discovery, Second Chance, Fresh Arrangement, A Rare Find, Measured Assistance, Every Rarity |
| 100 | Against the Odds, Close Finish, Strong Finish, Broad Attention, Make It Count, Fresh Perspective, Guided Attention, A Complete Toolkit, Ming Porcelain, Dancheong, Stained Glass, Golden Age, A Familiar Picture |
| 150 | Rising Again, Changing Tides, Steady Hand, Across Continents |
| 200 | Perfect Recall |

Every Rarity can be earned early on a board with all four rarities, so it stays
at 50 AP. Collecting 25 pictures within a theme and matching one picture 10 times
each reward sustained collection with 100 AP. Across Continents depends on
reaching a European theme later in the unlock journey and awards 150 AP.
Collection and daily-visit mastery now use the same 200 AP final reward as the
duel, win, pair and chain tracks.

## Avatar frames

Lifetime AP unlocks frames; AP is never spent.

| Frame | Lifetime AP required |
| --- | ---: |
| Bronze Laurel | 500 |
| Porcelain Crest | 1,500 |
| Jade Guardian | 3,000 |
| Golden Triumph | 5,000 |
| Celestial Glory | 6,500 |

Bronze is an early-session goal because several introductory achievements can
unlock during the same duel. Higher frames require progress across more of the
catalogue. Celestial Glory requires about **87%** of the fresh-profile total,
leaving 1,000 AP of optional progress beyond the final frame. Exact timing varies
with wins, memory feats, booster use, collection and visits.

## Existing saves and the detail view

- Previously earned AP and reward receipts retain their exact amounts. Old
  awards such as 15, 165 or 500 AP remain part of the player's history.
- Already unlocked achievements are not paid again. Timestamps, counters and
  collected progress stay intact.
- Future unlocks pay the full catalogue amount, including on older profiles.
  Rewards are never trimmed against an old family-wide budget.
- Frames earned under the old thresholds remain unlocked and equipable. Their
  rights are retained from validated historical reward receipts, not an
  unverified cached AP total. New profiles use the thresholds above.
- Tier buttons show the current catalogue reward ladder. When a completed
  level's actual historical payout differs, the detail note labels it
  **“Previously earned”** so the player can distinguish the receipt from today's
  reward.

Because historical payouts remain exact, an existing player's eventual lifetime
total may differ from the **7,500 AP fresh-profile catalogue total**. The lifetime
balance is not rounded, capped or reduced. Retained frame rights are stored in
`retainedAvatarFrameIds` in the progression envelope and survive reloads.

The reward schema advances to **version 5**. Before upgrading an established
older save, the loader attempts to preserve its untouched progression JSON once
under `porcelain:backup:before-achievement-pacing-v5`. Repeated loads never
overwrite this backup or the separate backups from earlier migrations. For a
developer rollback, restore that snapshot into `porcelain:progression` together
with the corresponding earlier application build. This restores the pre-upgrade
state, not progress earned afterward. Older clients do not understand the new
reward receipts and frame rights; avoid alternating builds against the same
save.
