# Economy and progression — revised balance proposal

**Status: Revision 2 approved and implemented on October 1, 2026.**

Revision 2, October 1, 2026, against the current 30-pair build. Supersedes the earlier approval draft. Direction: give players enough boosters to learn and experiment, make continued collection rewarding, and make purchases useful for larger supplies. Every booster must also have a substantially more expensive Coin route. The user selected an 8–12 completed-duel target for unlocking the second theme and requested rewarded 2× Daily Quest claims. These are proposed test values, not measured spending or retention forecasts.

## Baseline before Revision 2

- The first 30 login rewards currently give 86 boosters, or 172 with double claims. That overwhelms the intended small free allowance.
- Completing all three initially assigned quests currently pays an average of 11.89 Gems. At 3 Gems per Hint, this alone funds almost four Hints per day.
- Coins currently have no independent purchase: every Coin-priced product also requires Gems.
- Eagle Eye only reveals rarity, but currently costs more Gems than Hint, which identifies a matching pair.

## 1. Match earnings

Keep the established completed-duel payouts:

| Outcome | Coins | Gems |
|---|---:|---:|
| Win | 100 | 0 |
| Draw | 50 | 0 |
| Loss | 20 | 0 |

No entry fee, energy cost, or daily match-reward cap. Abandoned games do not award completion Coins. Achievements continue to award points and cosmetic frames. Theme unlocks remain collection-based.

## 2. Daily login rewards

Replace the booster-heavy weekly schedule with:

| Login day in repeating week | Reward |
|---|---|
| 1 | 1 Hint |
| 2 | 25 Coins + 1 Shuffle |
| 3 | 30 Coins + 1 Eagle Eye |
| 4 | 40 Coins |
| 5 | 50 Coins + 1 Hint |
| 6 | 60 Coins |
| 7 | 1 Freeze |
| Every 30 accumulated login days | Extra 1 of each booster |

First 30 login days: **845 Coins + 26 boosters** (10 Hints, 6 Shuffles, 5 Freezes, 5 Eagle Eyes). Taking every double claim gives **1,690 Coins + 52 boosters**.

Add a **one-time sampler of 2 of each booster (8 total)**, granted automatically to each profile once, including existing profiles when the update first loads. Show the exact contents in a single dismissible introduction; it is not an ad claim and cannot double. This lets players try all four tools immediately. First-30-login direct supply including the sampler becomes **34 boosters**, or **60 with every login doubled**. The sampler never repeats on reload, edition changes, theme changes or later logins.

Login rewards never grant Gems. Missed days retain progress and previously earned unclaimed rewards remain claimable. Double rewards keep the existing testing behavior: simulated completed ad, no video. Both Coins and boosters double once.

This requires the existing welcome screen, calendar, reward previews and claim processing to support Coins alongside boosters. The day-30 description must show one of each booster.

## 3. Daily quest earnings

Keep all 33 objectives and their current targets. Keep three daily quests, at least one Easy and one Medium initially, different objective metrics, one free reroll into another difficulty, and the current UTC reset. Reroll remains free; no paid extra rerolls.

| Difficulty | Coins per quest | Gems per quest |
|---|---:|---:|
| Easy | 20–40 | 0 |
| Medium | 40–60 | 2 on five effort/skill objectives; 0 on the other six |
| Hard | 80–100 | 4, or 6 for 50 pairs / 3 victories |

Five Medium objectives award Gems: 2 Amethyst pairs, 1 Gold pair, 4 remembered pairs, a 4-pair chain, and a completed victory. Every Hard quest awards Gems. The full per-quest table is below.

Exact enumeration of the current selection rules gives these budgets **if every selected quest is completed and claimed**:

| Three-quest board, standard claims | Current | Proposed |
|---|---:|---:|
| Average Coins, before reroll | 45.74 | 126.26 |
| Average Gems, before reroll | 11.89 | 2.74 |
| Coin range, before reroll | 0–180 | 80–200 |
| Gem range, before reroll | 8–18 | 0–8 |
| Maximum Gems after the allowed reroll | 25 | 14 |

Standard-claim Gem supply is approximately 77% below the current build. Some days offer no Gems unless the player rerolls. The UI must show this clearly with the actual reward icons. There is no extra daily Gem cap: all shown, completed rewards are paid in full. The maximum after reroll is attainable through harder objectives, not an expected daily income.

Quest actions continue to count when performed, including in an unfinished duel. Coins for the duel itself still require completion. Quests never require buying or using a booster.

### Rewarded 2× Daily Quest claims

- Each completed, unclaimed quest offers **Claim** and **Claim 2×**. The second button doubles both its Coins and Gems after confirmed rewarded-ad completion. The button previews the doubled amounts.
- Either choice settles that quest once. It is not a standard claim followed by another bonus claim. Already claimed quests cannot be doubled retroactively; no second ad can multiply a reward again.
- Each of the three quests can be doubled separately: at most three doubled quests belonging to one daily roster, in addition to the existing login-reward claim. No new ad reward slot or fourth quest is added. An older pending claim may finish after midnight under the snapshot rule below.
- Before the request, snapshot the quest ID, day, reward amount and claim eligibility. A pending request blocks a competing standard claim or second request for that quest. An ad started while the reward is valid can settle that snapshot after a day rollover, without crediting a new day's quest. Receipts prevent any replay.
- Cancelled, failed or unavailable ads pay nothing and leave the standard claim available while that quest is valid. No normal claim is consumed by an unsuccessful ad.
- Use the existing testing behavior: immediately simulate completion without showing a video. A later live provider must confirm completion before doubling.

With all three initial quests doubled, the modeled average is **252.52 Coins + 5.48 Gems per day**, and the Gem range is **0–16**. After a reroll, the highest possible fully doubled Gem total is **28**. These are completed-and-claimed budgets; partial completion or mixed claim choices pay less. Double claims also double any preserved legacy quest reward, once.

## 4. Store prices and bundle contents

Every single booster gets two alternative prices: **Gems OR Coins**. Bundles retain a **Coins + Gems** offer and gain a **Coins-only** alternative. These are separate purchase choices, never cumulative charges. Confirmation must identify the chosen payment and exact inventory grant.

| Single booster | Current Gem price | Proposed Gem price | Alternative Coin price |
|---|---:|---:|---:|
| Eagle Eye | 6 | 4 | 800 |
| Hint | 3 | 6 | 1,200 |
| Shuffle | 4 | 8 | 1,600 |
| Freeze | 5 | 10 | 2,000 |

Eagle Eye is the entry-price tool because it shows rarity information. Hint identifies an available pair. Shuffle changes tile positions and clears opponent memory. Freeze gives another turn after a miss. The revised allowance and lower Hint/Freeze prices increase availability relative to revision 1; booster effects and durations are unchanged. Automatic recovery of a board with no available pair stays free.

| Bundle | Proposed contents | Coins + Gems price | Alternative Coins-only price |
|---|---|---|---:|
| Focused Mind | 3 Hints + 1 Freeze + 1 Eagle Eye — 5 boosters | 300 Coins + 20 Gems | 5,200 |
| Duel Kit | 3 of each — 12 boosters | 1,200 Coins + 40 Gems | 12,800 |
| Master’s Kit | 6 of each — 24 boosters | 2,400 Coins + 70 Gems | 23,600 |

The small currency packages below establish a **50 Coins per Gem bookkeeping reference**, not a currency conversion players can perform. All Coin-only prices cost **four times** the reference value of the alternative offer. For example, a 6-Gem Hint has a reference value of 300 Coins but costs 1,200 Coins on its Coin-only route. Focused Mind's mixed cost has a reference value of 1,300 Coins, so its Coin-only price is 5,200.

At that reference, bundle savings versus singles are **18.75%, 23.81% and 29.76%**. The same discounts hold when comparing their Coin-only prices with buying all contents individually in Coins. These are not discounts in each currency separately. Two Duel Kits cost 2,400 Coins + 80 Gems, so Master’s Kit saves 10 Gems for identical contents; the Coin-only saving is 2,000 Coins.

Existing confirmation screens must show the chosen payment, quantities and exact prices. No payment route is selected silently when the other is unaffordable. Boosters continue to carry over; no per-match refill or new use limit is introduced.

## 5. Simulated currency packages

Keep the five current USD price points and test-purchase flow; update contents:

| Package | Current contents | Proposed contents | Displayed price |
|---|---|---|---:|
| Coin Pouch | 500 Coins | 1,000 Coins | $0.99 |
| Gem Pouch | 15 Gems | 20 Gems | $0.99 |
| Traveler’s Purse | 500 Coins + 50 Gems | 1,000 Coins + 50 Gems | $2.99 |
| Jade Chest | 1,000 Coins + 100 Gems | 2,000 Coins + 90 Gems | $4.99 |
| Imperial Chest | 2,500 Coins + 230 Gems | 4,500 Coins + 190 Gems | $9.99 |

The two small packs imply a bookkeeping reference of 50 Coins per Gem; there is **no currency-conversion feature**. At that reference, the mixed packs provide approximately 16%, 29% and 39% extra value per dollar versus small packs. Coins can buy every booster and contribute to mixed bundles, while Gems provide the more efficient supply route.

Practical examples:

- Coin Pouch buys one Eagle Eye with 200 Coins left; its other role is contributing to mixed bundles.
- Gem Pouch buys three Hints with 2 Gems left, or two Freezes.
- Imperial Chest buys a 24-booster Master’s Kit and a 12-booster Duel Kit, leaving 900 Coins and 80 Gems. Exact spending remains the player's choice.

Purchases remain explicitly simulated. No real-money checkout or live ads are added by this proposal.

## 6. Free-play budget and test assumptions

- At 50% wins and no draws, a completed duel averages 60 Coins. Match earnings alone fund Eagle Eye after about 14 duels, Hint after 20, Shuffle after 27 and Freeze after 34; quest and login Coins shorten this. A Coin-only purchase is a saving goal, not the player's initial way to try a booster.
- Fully clearing initial daily quest boards with standard claims averages enough Gems for one Hint per 2.2 quest days or one Freeze per 3.7 quest days. Doubling every quest roughly halves those intervals. These are aggregate budgets, not guaranteed schedules.
- Three duels per day at that win rate, plus completion of every initial quest with standard claims, would supply about **10,033 Coins and 82 Gems** over 30 days, plus **26 login boosters and the once-only 8-booster sampler**.
- Doubling every login and every quest in the same budget supplies about **14,666 Coins and 164 Gems**, plus **52 login boosters and the once-only sampler**. Doubling only logins supplies about 10,878 Coins and 82 Gems; doubling only quests supplies about 13,821 Coins and 164 Gems. These totals exclude purchases, rerolls and any change in win rate from booster use.
- The full-quest scenario is deliberately an upper supply budget for the stated match count, not a prediction: quests such as 4 completed duels or 3 wins can require additional play on a given day, and unfinished quests pay nothing. Reroll policy and player skill also affect actual earnings.
- Coins have uncapped match earnings, so someone playing many more duels can earn more Coin boosters. Gems stay limited by the quest roster. This preserves a free route while paid packages offer immediate volume.
- Test-purchase balances are unlimited by design; they must be excluded when assessing earned-currency pacing.

After approval, verify the math and game flow with tests. A subsequent playtest should measure actual duel length, quest completion, booster use and end-of-day balances before treating these numbers as final production tuning.

## 7. Existing players and rollout

- Preserve all current Coins, Gems, boosters, collections, achievements, rankings, receipts and unlocked content.
- Honor every already-issued login reward at its saved amount, including unclaimed rewards.
- Preserve the reward amount on an already-assigned quest when the update loads. Current quest entries do not store their reward, so the implementation must snapshot the legacy amounts before applying new definitions. New daily selections and new rerolled quests then use the approved table.
- Record the sampler grant independently of daily claims so it pays once for both new and existing profiles. This is a single shared inventory across editions, not an eight-booster grant per edition.
- Apply changed Store prices to new purchases; do not remove items or recalculate historical receipts.
- Refresh the standalone build and the economy documentation after implementation. The pending “Boosters” heading rename remains in place.

## 8. Implementation and acceptance scope after approval

Use the existing economy, daily quest, reward, progression and Store components. No new payment service or external account system.

Required checks:

1. Exact win/draw/loss payouts, all 33 quest rewards and valid initial/rerolled daily budgets.
2. First-30-login totals, one-time sampler and standard/double mixed Coin/booster grants, paid exactly once.
3. Both payment options for every single and bundle debit only the selected currencies and grant the correct inventory; insufficient balances never grant items.
4. Old balances, issued login claims and current quest rewards survive migration without loss or duplicate payment.
5. Shop and login reward previews match the granted contents on phone/tablet layouts, including Coin-only days and mixed day-30 rewards.
6. Standard versus rewarded quest claims are mutually exclusive; success, failure, cancellation, concurrent actions, reload and day rollover cannot duplicate or misapply grants.
7. Existing quest selection, completion, expiry, reroll and simulated purchase behavior still work; unit suite and standalone build pass.
8. All three theme unlock gates honor their rarity quotas and copy counts independently in Eastern and Western. Existing earned collection counts and already unlocked themes remain intact.
9. Partial collection progress, next milestone and actual completion totals agree on the theme selector, Collection and post-match summary, including duplicates that no longer advance a goal.

## 9. Theme progression and the rest of the reward loop

### Reach the second theme in about 8–12 duels

Keep the 30-pair board, fixed rarity mix (16 Marble / 8 Sapphire / 4 Amethyst / 2 Gold pairs), random artwork within each rarity and unchanged booster effects. Both editions have 22 Marble, 10 Sapphire, 5 Amethyst and 3 Gold artworks per theme.

Retain **3 personally matched pairs per low-rarity artwork** and **2 per high-rarity artwork**. Change how many distinct low-rarity artworks must reach that count for the early gates:

| Unlock | Low-rarity requirement | Additional high-rarity requirement |
|---|---|---|
| Dancheong, theme 2 | In Ming, any **14 of 22 Marble + 7 of 10 Sapphire**, each matched 3 times | None |
| Stained Glass, theme 3 | In Dancheong, any **18 of 22 Marble + 8 of 10 Sapphire**, each matched 3 times | In Ming, **all 5 Amethyst + all 3 Gold**, each matched 2 times |
| Dutch Golden Age, theme 4 | In Stained Glass, **all 22 Marble + all 10 Sapphire**, each matched 3 times | In Dancheong, **all 5 Amethyst + all 3 Gold**, each matched 2 times |

This **explicitly relaxes the previous every-artwork rule for the first two low-rarity gates**, and is part of the requested approval. Collections are never spent. Eastern and Western retain separate, persistent gates; playing one edition does not fill the other's requirements. Owning a theme in either edition is never revoked. Purchases provide boosters, not a direct theme-unlock bypass.

### Pacing model

10,000 seeded runs per scenario, using the current rarity and artwork selection. The reference player captures exactly 15 randomly selected pairs in each 30-pair duel, plays the latest theme for its low-rarity goals, then revisits an earlier theme for missing high-rarity goals. These are collection-pacing simulations, not AI matches or measured player behavior.

| Theme unlocked | Current median, total duels | Revised median, total duels | Revised 10th–90th percentile |
|---|---:|---:|---|
| Dancheong | 22 | **10** | 9–12 |
| Stained Glass | 45 | **26** | 22–33 |
| Dutch Golden Age | 68 | **51** | 43–61 |

At 12 personal pairs per duel, revised medians are 12 / 32 / 62. At 18 pairs, they are 8 / 22 / 43. Boosters can help players find more pairs, but a purchase does not guarantee a match result, a particular artwork or a fixed unlock date. Splitting play across editions takes longer to finish either path.

### Make earned progress visible

- Keep the existing match-result → Leaderboards → menu route. Add a compact collection-progress summary to the result screen showing the next theme and real progress earned in that match.
- Show **1/3 and 2/3 progress** toward an artwork's requirement instead of moving the theme bar only on the third match. For quota-based groups, the partial bar sums the best required number of artworks, capped at each artwork's copy target. Reaching 100% must mean the actual unlock conditions are met.
- Display both completed-artwork totals and partial progress: for example, “9 / 14 Marble artworks ready.” Extra copies of an already-complete artwork stay in Collection but must not appear to advance a capped unlock goal.
- Once a theme unlocks, celebrate it and make its card available with the correct edition. The new theme itself is the reward; no additional repeatable currency or booster grant is attached.
- Use the existing daily quest page for exact reward previews and standard / 2× claim choices. Keep the free reroll, deadline, and required actions clear.
- Store cards show their two payment choices with **OR**, quantities and wallet shortfalls. The existing purchase confirmation remains explicit. Larger bundles save on supplies; the player can see what each purchase adds before confirming.

### Achievements, frames, rank and AI

Keep the current Achievement Points, milestone targets and frames. Early goals already occur at 1 / 5 / 10 completed duels, 10 / 50 / 100 personal pairs, growing chains, formations and discovered artwork. Frames remain at 100 / 250 / 500 / 1,000 / 1,400 AP. AP continues to unlock cosmetics and is not converted into Coins or Gems.

Keep league promotions at 10 / 30 / 75 / 150 / 300 completed wins and the recently approved rank curve, whose first victory moves #10,000 to #8,500. These provide separate short- and long-term goals without another currency source.

Keep Realistic AI's observed-skill adaptation and all three AI choices. Buying, declining a purchase, ad viewing and wallet balance do not change AI memory, move selection, win rates or tile draw odds. This balance tunes rewards, access pacing and purchase value; it does not tune match outcomes around spending.

### Playtest measures

After implementation, assess separate cohorts for no rewarded claims, some rewarded claims, all rewarded claims and simulated purchases. Measure theme-unlock duel counts, first use of each booster, boosters earned/used, quest completion, claim choice, and Coin/Gem balances after sessions. Keep test-purchase grants distinct from earned supply in analysis. Actual purchase interest requires human playtesting; the model cannot predict it.

## Complete proposed quest roster

Values are totals per completed quest, not per pair or duel. Unlisted Gems in the UI should be omitted rather than displayed as zero.

| ID | Objective | Difficulty | Coins | Gems |
|---|---|---|---:|---:|
| easy-pairs-3 | Match 3 pairs | Easy | 20 | 0 |
| easy-pairs-5 | Match 5 pairs | Easy | 25 | 0 |
| easy-marble-3 | Match 3 Marble pairs | Easy | 20 | 0 |
| easy-sapphire-1 | Match 1 Sapphire pair | Easy | 20 | 0 |
| easy-recall-1 | Match 1 previously seen pair | Easy | 25 | 0 |
| easy-recovery-1 | Match immediately after your own miss | Easy | 20 | 0 |
| easy-attempts-6 | Make 6 two-tile attempts | Easy | 20 | 0 |
| easy-chain-2 | Match 2 pairs in a row | Easy | 25 | 0 |
| easy-variety-3 | Match 3 different artworks | Easy | 25 | 0 |
| easy-duel-1 | Finish 1 duel | Easy | 40 | 0 |
| easy-opening-1 | Find your first pair in a duel | Easy | 20 | 0 |
| medium-pairs-12 | Match 12 pairs | Medium | 40 | 0 |
| medium-pairs-18 | Match 18 pairs | Medium | 50 | 0 |
| medium-marble-8 | Match 8 Marble pairs | Medium | 40 | 0 |
| medium-sapphire-4 | Match 4 Sapphire pairs | Medium | 40 | 0 |
| medium-amethyst-2 | Match 2 Amethyst pairs | Medium | 50 | 2 |
| medium-gold-1 | Match 1 Gold pair | Medium | 50 | 2 |
| medium-recall-4 | Match 4 previously seen pairs | Medium | 50 | 2 |
| medium-recovery-3 | Match after your own miss 3 times | Medium | 40 | 0 |
| medium-chain-4 | Match 4 pairs in a row | Medium | 60 | 2 |
| medium-variety-8 | Match 8 different artworks | Medium | 50 | 0 |
| medium-win-1 | Win 1 completed duel | Medium | 60 | 2 |
| hard-pairs-35 | Match 35 pairs | Hard | 80 | 4 |
| hard-pairs-50 | Match 50 pairs | Hard | 100 | 6 |
| hard-marble-20 | Match 20 Marble pairs | Hard | 80 | 4 |
| hard-sapphire-10 | Match 10 Sapphire pairs | Hard | 80 | 4 |
| hard-amethyst-5 | Match 5 Amethyst pairs | Hard | 90 | 4 |
| hard-gold-3 | Match 3 Gold pairs | Hard | 90 | 4 |
| hard-recall-10 | Match 10 previously seen pairs | Hard | 90 | 4 |
| hard-chain-7 | Match 7 pairs in a row | Hard | 100 | 4 |
| hard-variety-20 | Match 20 different artworks | Hard | 80 | 4 |
| hard-win-3 | Win 3 completed duels | Hard | 100 | 6 |
| hard-duel-4 | Finish 4 duels | Hard | 100 | 4 |

## Audit references

Current implementation inspected: `src/economy.js`, `src/daily-quests.js`, `src/daily-rewards.js`, `src/progression.js`, `src/boosters.js`, `src/rewarded-ad.js`, `src/main.jsx`, `src/economy-pages.jsx`, `src/daily-welcome-page.jsx`, `src/progression-pages.jsx`. Budget calculations enumerate every allowed initial objective combination with its selection probability and every valid reroll replacement. They do not assume equal probability of completing objectives.

## Implementation verification

- All 261 unit tests pass, including dual-price atomic purchases, once-only starter migration, preserved legacy rewards, quest double-claim snapshots, failure/retry, cold reload and midnight rollover.
- Complete browser flows passed in Chromium and WebKit: first-login screens, reroll, simulated purchase, booster purchase, 30-pair victory, result progress, quest claims, reload and next-day reset.
- Payment/claim/Collection layouts and actions passed at 320×568, 390×844, 768×1024 and 1024×768 in both browsers.
- Login welcome/calendar layouts passed 48 checks across both browsers, including Coin-only rewards and five-item day-30 rewards on short portrait and landscape screens.
- Production build and standalone HTML generation passed. No live billing or ad provider is connected; both use the approved test flow.
