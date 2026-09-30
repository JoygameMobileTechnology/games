# How Realistic AI works

Realistic is a local, simulated opponent designed to feel like a person playing a memory game. It learns your general level slowly, remembers imperfectly, takes uneven amounts of time to think, and has stronger and weaker runs. It does not guarantee a particular win rate or arrange wins and losses.

## Selecting it

This update selects **Realistic for everyone once**, including players who previously used Modern AI or Original AI. After that first update, Settings remembers whichever of the three options you choose. Changing the option during a duel applies to your next duel.

Modern AI and Original AI retain their existing decision rules. The matched opponent still uses the preset player's name and portrait.

## What it can see

The AI knows the board's visible layout: tile positions, which tiles have been removed, and which tiles are uncovered and therefore legal to flip.

It learns a tile's identity only when **either player actually flips that tile face up**. It watches your reveals as well as its own. A hidden tile that it has never seen is unknown; a tile it has forgotten becomes unknown again.

It cannot inspect hidden artwork, names, rarity, matching identities, or the board's solution to choose a move. Its second choice is made only after its first tile has been revealed and recorded. Hint and Eagle Eye do not give the AI tile identities. It cannot use boosters.

The game engine still checks whether two chosen tiles match and automatically repairs a board with no available pair. Those are shared game rules, not information used by the AI to select tiles. Either kind of Shuffle clears its entire position memory, while leaving its general skill and current match form intact.

## How it chooses two tiles

1. **Look for a remembered pair.** It checks its memory for matching tiles that are both currently uncovered. If it successfully recalls one, it selects that pair. It does not knowingly turn down a recalled pair to manufacture a miss.
2. **Otherwise, explore.** When there is no pair in its memory, there is a 65% chance it favors legal positions whose faces it does not currently remember. Otherwise it chooses from all legal positions. If a pair exists in memory but the recall attempt fails, it guesses from all legal positions.
3. **Flip the first tile.** That face is now visible and enters its memory.
4. **Look for its partner.** If the first choice came from a recalled pair, the intended partner is used provided it is still legal and memory confirms the match. Otherwise, it gets a separate chance to recall a previously seen partner.
5. **Guess if it cannot recall.** It chooses randomly from all other legal tiles. Correct tiles remain in that pool, so accidental matches are possible. It never searches hidden faces to ensure a mistake.

When several remembered pairs or partners qualify, it chooses randomly among them. Successful matches earn another attempt under the same rules as the player.

## How its memory changes

The AI's current ability combines three things:

- **Learned level:** its slowly changing estimate of your skill.
- **Match form:** a randomly better or worse day, fixed for that duel.
- **Focus:** a small, gradual variation in attention during the duel.

These combine into an effective ability between 0 and 1. The table shows the exact settings at the lowest level, at a neutral midpoint, and at the highest level. The midpoint is an illustration; actual matches include form and focus variation.

| Memory behavior | Ability 0 | Ability 0.5 | Ability 1 |
|---|---:|---:|---:|
| Chance to recall a pair already in memory | 30% | 60% | 90% |
| Chance to recall a known partner after the first reveal | 45% | 70% | 95% |
| Maximum remembered tile positions | 6 | 12 | 18 |
| Maximum memory age, in completed attempts | 4 | 8 | 12 |
| Chance each record is forgotten after an attempt | 26% | 18% | 10% |

Every completed two-tile attempt by **either player** advances memory age and triggers independent forgetting rolls. This includes successful matches and attempts where Freeze keeps the player's turn. Pauses and thinking time do not age memory.

Seeing a tile again refreshes its record. When memory is full, the oldest observations are dropped. A record is discarded once its age exceeds the limit; matched and removed tiles are discarded immediately. Even a fresh record can be lost in the next forgetting roll.

For an ability `s`, the exact formulas are:

- Pair recall: `30% + 60% × s`.
- Partner recall: `45% + 50% × s`.
- Capacity: `6 + round(12 × s)` tile positions.
- Age limit: `4 + round(8 × s)` completed attempts.
- Forgetting: `26% − 16% × s` per record, per completed attempt.

These recall percentages are **not overall match-success percentages**. Success also depends on which tiles are uncovered, what has been seen, what remains in memory, and lucky guesses.

## How it adapts to you

Your learned level starts at **0.50 on a 0–1 scale**. It is stored on this browser/device and carried into future Realistic duels, shared across themes and Eastern/Western editions. It is an internal estimate, not a displayed player rank.

During a Realistic duel, the game counts your successful and unsuccessful two-tile attempts. Your accuracy is successful attempts divided by eligible attempts. If you use Hint, your **next valid attempt is excluded**, even if the highlight has already disappeared. That exclusion clears after the attempt. Shuffle, Freeze and Eagle Eye do not directly reveal a matching face, so they do not exclude attempts.

Only a **completed Realistic duel** can update the estimate. Leaving, reloading, or abandoning an unfinished duel contributes nothing. Modern and Original matches do not train it. At least **eight eligible player attempts** are needed; a completed duel with fewer attempts is recorded but leaves the level unchanged.

At completion:

1. Convert accuracy into a target level: subtract 10 percentage points, divide by 65 percentage points, and limit the result to 0–1. Thus 10% accuracy or less targets level 0, and 75% or more targets level 1.
2. Move **12% of the distance** from the current level toward that target.
3. Limit the change to **0.035 in either direction per duel**. That is 3.5 percentage points on this internal scale, not 3.5% of the previous value.

Examples starting from level 0.50:

| Your eligible accuracy | Target level | Level for the next duel |
|---|---:|---:|
| 25% | About 0.231 | About 0.468 |
| 45% | About 0.538 | About 0.505 |
| 75% or higher | 1.000 | 0.535 |

Consistent improvement therefore raises the AI gradually; a weaker run lowers it gradually. As it gets close to the target, each change becomes smaller. The current duel keeps the learned level it started with, so one good turn cannot cause an immediate difficulty jump.

Winning, losing, the score gap, Coins, and leaderboard rank do not set the target. A win is not deliberately followed by a punishment match, and falling behind does not make the AI throw the game. Accuracy is a practical proxy for skill, so this is adaptation toward your observed play, not an exact measurement of human ability or a promised 50/50 matchup.

## Good matches, bad matches, and streaks

Each new duel gets a random match-form adjustment from **−0.16 to +0.16**, plus an initial focus adjustment from **−0.06 to +0.06**. These can make an opponent sharper or more distracted than its learned level alone would suggest.

After each AI attempt, focus keeps 84% of its previous value and adds a fresh random adjustment from −0.045 to +0.045. Focus is limited to −0.14 through +0.14. Keeping part of the previous value gives attention some continuity across nearby attempts.

The effective ability is the learned level plus match form plus focus, limited to 0–1. Form and focus are independent of scores and outcomes. Streaks emerge from attention, surviving memories, board exposure, recall rolls and luck; there is no prescribed streak length or required miss.

## Thinking and flip timing

Each attempt has two separately randomized waits. It generally spends longer surveying the board, then flips the second tile more quickly when it remembers the pair.

| Situation | Normal delay | Occasional hesitation |
|---|---|---|
| Before the first flip, recalled pair | 650–1,600 ms, depending on ability | Adds 600–1,000 ms |
| Before the first flip, exploring | 750–1,800 ms, depending on ability | Adds 600–1,000 ms |
| Between flips, remembered partner | 220–550 ms | 5% chance of another 300–500 ms |
| Between flips, uncertain partner | 420–1,100 ms | 9% chance of another 300–500 ms |

The first-flip hesitation chance runs from **12% at ability 0 to 7% at ability 1**. Total waits are capped at **2,600 ms before the first flip** and **1,500 ms between flips**. A chance match can still happen after a hesitant guess.

Precisely, the first wait is `650 + random(0,850) + (1−ability)×100` milliseconds for a recalled pair, or `750 + random(0,900) + (1−ability)×150` while exploring, plus any hesitation. All delays are rounded to milliseconds. Decisions, delays, forgetting, match initialization and ongoing focus changes use separate random streams.

Existing match/mismatch reveal and tile-collision animations keep their timing. Pausing or hiding the tab freezes pending thinking and flip delays; resuming continues the remaining time rather than rolling another delay. Leaving the duel cancels pending moves. Reduced motion affects presentation, not the AI's decision-making or thinking delays.

## Saved data and limits

- `porcelain:aiMode` stores the selected option; `porcelain:aiModeVersion` records that the one-time Realistic selection has happened.
- `porcelain:realisticSkill` stores the learned level, completed Realistic duel count, schema version and last processed duel ID. The last ID prevents the current result from training it more than once.
- Individual tile memories, current form, focus and the current match's accuracy sample are held only for that duel. They are not saved as a resumable game.
- Clearing this site's storage resets the learned level. If storage is unavailable, adaptation continues during the current visit but cannot survive a reload. There is no account synchronization or server training.

The numerical settings above are the implemented starting balance. They have automated checks for visibility limits, legal moves, changing recall rates, timing, gradual adaptation and persistence; they are not yet calibrated against a study of human players.
