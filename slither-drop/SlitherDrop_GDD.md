# 🕳️ SlitherDrop — Game Design Document

> *A puzzle game merging the color-matching grid logic of **Drop Away** with the snake-style drag movement of **Gecko Out**.*

---

## Table of Contents

1. [Game Overview](#1-game-overview)
2. [Core Concept](#2-core-concept)
3. [Game Elements](#3-game-elements)
   - 3.1 [The Grid Board](#31-the-grid-board)
   - 3.2 [Stickmen](#32-stickmen)
   - 3.3 [Holes](#33-holes)
4. [Mechanics](#4-mechanics)
   - 4.1 [Dragging Holes (Snake Movement)](#41-dragging-holes-snake-movement)
   - 4.2 [Color Matching Rules](#42-color-matching-rules)
   - 4.3 [Stickman Collection](#43-stickman-collection)
   - 4.4 [Hole Capacity & Disappearance](#44-hole-capacity--disappearance)
5. [Win & Fail Conditions](#5-win--fail-conditions)
6. [Level Design Guidelines](#6-level-design-guidelines)
7. [Example Level Walkthrough](#7-example-level-walkthrough)
8. [Visual & Audio Direction](#8-visual--audio-direction)
9. [Progression System](#9-progression-system)
10. [Technical Notes](#10-technical-notes)

---

## 1. Game Overview

**Title:** SlitherDrop *(working title)*
**Genre:** Casual Puzzle
**Platform:** Mobile (iOS / Android)
**Player Count:** Single-player
**Session Length:** 1–3 minutes per level
**Target Audience:** Casual puzzle fans aged 10+

**Elevator Pitch:**
> Drag colorful holes across a grid like a slithering gecko to swallow matching stickmen — but plan your path carefully, because every cell you cross leaves a tail, and every hole has a limited appetite.

---

## 2. Core Concept

SlitherDrop fuses two distinct mobile puzzle mechanics:

| Mechanic | Source Game | Role in SlitherDrop |
|---|---|---|
| Static stickmen on a grid, color-matched to holes/blocks | Drop Away | Defines the puzzle layout and the collection targets |
| Draggable snake-style movement across a grid | Gecko Out | Controls how holes are moved by the player |

The key tension: holes move like snakes (their body follows the path of their head), so planning the route matters. A hole can only pass under a stickman if colors match, and it disappears once it has collected enough stickmen to fill its capacity.

---

## 3. Game Elements

### 3.1 The Grid Board

- A rectangular grid (e.g., 6×8, 7×9) of square cells.
- Each cell can be **empty**, contain a **stickman**, or be occupied by part of a **hole**.
- The grid is fixed; it does not scroll or rotate.
- Cells outside the grid are walls — holes cannot move there.

---

### 3.2 Stickmen

- **Appearance:** Small, simple stick-figure characters rendered in a single solid color.
- **Placement:** Fixed at specific grid cells at level start. They **cannot be moved** by the player.
- **Colors:** Each stickman has one color (e.g., red, blue, green, yellow, purple, orange).
- **Behavior:** A stickman is collected (falls in) when a matching-color hole moves into the cell beneath them.
- **State:** After being collected, the stickman disappears from the board and the hole's fill count increases by 1.

> ℹ️ Multiple stickmen of the same color may exist on the board. Stickmen of different colors are obstacles to holes that don't match them.

---

### 3.3 Holes

- **Appearance:** A colored, irregularly-shaped opening that covers one or more grid cells.
- **Shape:** Holes can span multiple connected cells (e.g., L-shape, T-shape, straight line, 2×2 square). The shape is determined by level design.
- **Color:** Each hole has a single color that must match stickmen it can collect.
- **Capacity:** Equal to the number of grid cells the hole covers at its initial size. A hole that covers 3 cells can collect up to 3 stickmen.
- **Movement:** Player-controlled via drag. Moves like a snake: the head leads, the body follows the exact path.
- **Multiple Holes:** A level may contain several holes of different colors and shapes simultaneously.
- **Disappearance:** When a hole has collected stickmen equal to its capacity, it is satisfied and vanishes from the board.

> ⚠️ A hole cannot move into a cell occupied by a stickman of a **different** color. That cell acts as a wall for that specific hole.

---

## 4. Mechanics

### 4.1 Dragging Holes (Snake Movement)

The player interacts with holes by **dragging** them:

1. **Select:** Tap and hold on any cell of a hole to select it.
2. **Drag:** Swipe in any direction. The hole's "head" (leading cell) moves toward the drag direction, and all body cells follow, one step at a time, replicating the path of the head.
3. **Path Fidelity:** The body of the hole precisely traces the path the head took. If the head turned left and then up, the body curves left then up in sequence as it follows.
4. **Grid-Locked:** Movement is snapped to the grid. One drag gesture = one cell moved per step. Fast drags can move multiple cells in sequence.
5. **No Crossing Self:** A hole's body cannot overlap itself.
6. **No Crossing Other Holes:** Holes cannot move through cells occupied by other holes.

> 🐍 Think of each hole as a gecko/snake. Its shape at any moment is determined by the last N cells it has visited, where N is its current length.

---

### 4.2 Color Matching Rules

| Scenario | Result |
|---|---|
| Hole moves into a cell with a **matching-color** stickman | ✅ Stickman is collected, hole's fill count increases |
| Hole attempts to move into a cell with a **non-matching** stickman | ❌ Blocked — the hole cannot enter that cell |
| Hole moves into an **empty** cell | ✅ Allowed freely |
| Hole moves into a cell occupied by **another hole** | ❌ Blocked |

Color matching is strict — no partial matches, no wildcards (unless introduced as a special mechanic in later levels).

---

### 4.3 Stickman Collection

- When the head of a hole enters a cell containing a same-color stickman, the stickman is instantly collected.
- The stickman disappears (falls away with a short animation).
- The hole's internal fill counter increments by 1.
- The hole continues moving normally after collection.
- A hole can collect multiple stickmen in a single drag gesture, as long as the path passes through matching cells consecutively.

---

### 4.4 Hole Capacity & Disappearance

- Each hole has a **capacity** equal to the number of grid cells it initially covers.
  - Example: A 3-cell L-shaped hole has capacity 3.
- As the hole collects stickmen, the **filled count** rises.
- When **filled count = capacity**, the hole is full:
  - It plays a satisfaction animation (e.g., glows, shrinks, pops).
  - It is **removed from the board entirely**.
- If a hole is removed while its body occupies multiple cells, all those cells are freed instantly.

> 💡 Design implication: A hole collects one stickman per cell it passes through (if matched). Its body length never shrinks mid-game — only the fill counter grows. The hole's length on the grid stays constant until it disappears.

---

## 5. Win & Fail Conditions

### ✅ Win Condition
The level is **completed** when:
- All stickmen have been collected (board has zero remaining stickmen), **AND**
- All holes have been filled and removed (board has zero remaining holes).

Both conditions must be true simultaneously. The game shows a victory screen with stars/score.

### ❌ Fail / Stuck Condition
There is no traditional "fail" — the player cannot make an irreversible wrong move (they can always drag holes back). However:
- If the player reaches a **deadlock** (no hole can reach any matching stickman without being blocked by non-matching stickmen), a **hint** or **reset** option is offered.
- An optional **move counter** can be added for challenge modes, where exceeding the move limit triggers a level restart prompt.

---

## 6. Level Design Guidelines

### Difficulty Tiers

| Tier | Grid Size | # Colors | # Holes | Hole Shapes | Notes |
|---|---|---|---|---|---|
| Tutorial | 4×5 | 1–2 | 1–2 | Straight (2 cells) | Teach dragging and color rules |
| Easy | 5×6 | 2–3 | 2–3 | Straight, L-shape | Simple routing, no traps |
| Medium | 6×7 | 3–4 | 3–4 | L, T, S-shapes | Holes must be sequenced carefully |
| Hard | 7×8 | 4–5 | 4–5 | Complex multicel | Color blocking, route planning required |
| Expert | 8×9+ | 5–6 | 5–6 | Any shape | Tight corridors, interdependent holes |

### Design Principles

1. **Every level must be solvable.** Verify solve paths before publishing.
2. **Color blocking should be intentional.** Non-matching stickmen should force the player to route holes creatively, not randomly.
3. **Order of operations matters.** Some holes must be moved before others to avoid blocking. Good levels reward players who think ahead.
4. **Avoid dead ends by default.** Unless specifically designed as a puzzle element, holes should always have a path to reach at least one matching stickman.
5. **Capacity should match supply.** The total capacity of all holes in a level must exactly equal the total number of stickmen on the board (ensuring the win condition is always achievable).

---

## 7. Example Level Walkthrough

### Level Setup (5×5 grid, 2 colors)

```
[ ][ R ][ ][ B ][ ]
[ ][ R ][ ][ B ][ ]
[ ][ ][ ][ ][ ]
[🔴]────[🔴]  [🔵]──[🔵]
[ ][ ][ ][ ][ ]
```

- **Red Hole:** L-shaped, 3 cells, capacity 3. Starts bottom-left.
- **Blue Hole:** Straight, 2 cells, capacity 2. Starts bottom-right.
- **Red Stickmen:** 3 total, in column 2, rows 1–3.
- **Blue Stickmen:** 2 total, in column 4, rows 1–2.

### Solution Path

1. Player drags the **Red Hole** upward through column 2 → collects 3 red stickmen → Red Hole disappears.
2. Player drags the **Blue Hole** upward through column 4 → collects 2 blue stickmen → Blue Hole disappears.
3. Board is clear → **Level Complete!**

The challenge in harder levels: blue stickmen may be placed in red hole's path, forcing the player to route around them.

---

## 8. Visual & Audio Direction

### Visuals

- **Art Style:** Bright, flat, cartoonish. Bold outlines. Inspired by the cheerful style of both source games.
- **Stickmen:** Simple, expressive stick figures with a round head and a solid-color body. Idle animations (slight bounce, blinking).
- **Holes:** Rendered as colored voids with a slight glow edge matching their color. The snake body should have a slightly lighter shade of the same color to differentiate head from tail.
- **Grid:** Subtle grid lines, light neutral background. Cells have a soft texture.
- **Collection Animation:** Stickman stretches toward hole, then pops/falls inside with a "gulp" effect.
- **Hole Disappearance:** Satisfied hole ripples, flashes white, and implodes with a burst of color particles.

### Audio

- **Stickman Collected:** A soft satisfying "pop" or "gulp" sound.
- **Hole Disappears:** A "whoosh + chime" sound.
- **Invalid Move:** A quiet dull "thud" — not punishing, just informative.
- **Level Complete:** Upbeat short jingle, confetti particles.
- **Background Music:** Looping lo-fi or lighthearted ambient track per world theme.

---

## 9. Progression System

### World Themes
Each world (~20 levels) has a distinct visual theme:

| World | Theme | Introduced Mechanic |
|---|---|---|
| 1 | Meadow | Basic drag & color match |
| 2 | City | Multi-cell hole shapes |
| 3 | Ocean | 4+ color levels |
| 4 | Volcano | Tight corridors, forced sequencing |
| 5 | Space | Expert routing, 6 colors |

### Meta Systems (Optional)
- ⭐ **Star Rating:** 1–3 stars per level based on move count or time.
- 💡 **Hints:** Limited hints that highlight the next best move.
- 🔄 **Undo Button:** Reverts the last drag gesture (limited or unlimited, design choice).
- 🏆 **Daily Challenges:** Special time-limited levels with leaderboard ranking.

---

## 10. Technical Notes

### Grid Representation
- The board is stored as a 2D array of cells.
- Each cell tracks: `isEmpty`, `stickmanColor` (null if empty), `holeId` (null if no hole occupies it).

### Hole Data Structure
```
Hole {
  id: string
  color: Color
  cells: List<GridPosition>   // ordered head-to-tail
  capacity: int               // = initial cells.length
  filledCount: int            // starts at 0
}
```

### Movement Validation (per step)
```
canMoveTo(hole, targetCell):
  if targetCell is out of bounds → BLOCK
  if targetCell contains a stickman of different color → BLOCK
  if targetCell is occupied by another hole → BLOCK
  if targetCell is the hole's own tail (next step) → ALLOW (tail will move away)
  otherwise → ALLOW
```

### Collection Trigger
```
onHoleEntersCell(hole, cell):
  if cell.stickmanColor == hole.color:
    removeStickman(cell)
    hole.filledCount += 1
    if hole.filledCount == hole.capacity:
      removeHole(hole)
      checkWinCondition()
```

### Win Check
```
checkWinCondition():
  if allStickmen.count == 0 AND allHoles.count == 0:
    triggerLevelComplete()
```

---

*Document version: 1.0 | Status: Concept / Pre-Production*
