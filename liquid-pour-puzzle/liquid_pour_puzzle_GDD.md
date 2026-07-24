# Liquid Pour Puzzle — Game Design Document

**Status:** Prototype Scope
**Version:** 0.1
**Reference:** [Water Out Puzzle](https://apps.apple.com/tr/app/water-out-puzzle/id6747998558?l=tr) (art direction only)

---

## 1. Overview

Liquid Pour Puzzle is a single-player mobile puzzle game built around a tactile pour-and-clear mechanic. The player faces a grid-based board packed with colored shape holders intertwined like puzzle pieces. Beneath the board sits a row of liquid-filled tubes, each containing a stack of differently-colored liquid segments. By tapping and holding a tube, the player sends liquid upward into the column above it, filling holders that match the liquid's current color. Filled holders disappear, remaining shapes fall under gravity, and the board reconfigures.

The puzzle is one of **ordering**. Each tube can only dispense its colors top-down, and liquid can only reach a holder with clear line-of-sight up its column. Pour in the wrong order and a holder gets buried, blocked, or gravity-shifted into a position no tube can reach — and the level becomes unsolvable.

**Genre:** Casual puzzle, single-screen, tap-and-hold input
**Platform:** Mobile (portrait orientation)
**Session length:** 30 seconds to 3 minutes per level

---

## 2. Core Loop

1. Player opens a level. Board is presented with shape holders packed onto it. Tubes sit below the board, each pre-loaded with stacked colored liquid segments.
2. Player evaluates the board: which holders are reachable from which tubes, what's blocking what, and what each tube has on top of its stack.
3. Player tap-and-holds a tube. Liquid pours up the column. A matching holder (if any, with clear line-of-sight) begins filling.
4. Holder fills completely → it vanishes → remaining shapes drop into the gap as rigid bodies.
5. Player evaluates the new board state and repeats.
6. Level ends when either every holder is cleared (win) or a holder remains that no tube can reach (loss).

---

## 3. Game Elements

### 3.1 Board

A rectangular grid of cells, fixed dimensions per level (e.g., 6×8, 7×10). Each cell can be empty or occupied by exactly one holder. Cells are visually inset into a navy tray, the same look as the reference game. Boards in the prototype are always rectangular; irregular outlines are out of scope.

### 3.2 Holders

Holders are colored, outlined shapes that occupy one or more contiguous cells on the grid. Available shapes for the prototype:

- 1×1 square
- 1×2, 2×1, 1×3, 3×1 rectangles
- L (and its rotations/reflections, four-cell)
- T (four-cell)
- + (plus, five-cell)

A holder has a single color and starts empty. Liquid of the matching color fills it cell-by-cell as it pours in. The holder only clears when **every cell** of it is filled — partial fills are remembered between pours and persist until the holder either completes or the level ends.

Holders are static while on the board: they never rotate, never tumble, never deform. They only move when gravity pulls them straight downward after a clear.

### 3.3 Tubes

Tubes are arranged in a row directly beneath the board. Each tube is locked to **one specific column** of the board and fires straight up that column only. Tubes do not move and cannot be repositioned by the player.

A tube contains a vertical **stack of colored liquid segments**. The topmost segment is the one currently available to dispense. Once it has been fully emptied, the next segment down is revealed and becomes the new top.

Not every column needs a tube. Some columns may be tubeless — those holders must be reached indirectly, by clearing other holders first and letting gravity drop them into a tubed column.

### 3.4 Liquid

Liquid is the consumable resource. The total volume of each color, summed across **all tubes** in the level, is exactly equal to the total cell count of that color's holders on the board. There is no surplus and no deficit. Every drop of liquid in the level has a destination, and every cell on the board has a corresponding drop somewhere in the tubes.

This balance is what makes the level solvable in principle. Whether the player finds a working order is the puzzle.

---

## 4. Mechanics

### 4.1 Pouring

The player initiates a pour by tap-and-holding a tube. While the finger is held down, the tube continuously dispenses its current top color upward into its column. Releasing the finger stops the pour immediately.

Pouring is the only player input during gameplay.

### 4.2 Line-of-Sight Rule

Liquid does not travel through empty space arbitrarily, and it does not pass through other holders. For a tube to fill a holder, two conditions must both be true:

1. **Color match.** The tube's currently dispensing color matches the holder's color.
2. **Clear line-of-sight.** Looking straight up from the tube, the first holder encountered in that column is the target holder. Any non-matching holder in the way blocks the pour entirely. Empty cells between the tube and the holder are fine — liquid traverses empty space without issue, but it cannot pass through any holder, even one of the matching color above another.

If either condition fails, the tube **refuses to dispense**. No liquid leaves the tube, no waste, no penalty. The player can experiment freely by holding any tube to see what it does.

A holder qualifies as "in this column" if any one of its cells sits in that column. For an L-shape whose foot pokes into the tube's column, the foot is enough to receive the pour.

### 4.3 Color Stack Behavior

Each tube's liquid is a stack. The visual is a vertical sequence of colored bands inside the tube body, with the topmost band being the active dispensing color. Once a band has been fully emptied into the board, it disappears and the band beneath it rises to become the new top.

Crucially, a single color can be present in multiple tubes, and a single tube contains multiple colors. The same red holder might be fillable from tube 2 (whose top is red) or from tube 5 (whose top is blue with red underneath). Choosing tube 2 keeps tube 5's blue accessible; choosing to wait on tube 5 might be the right move if tube 2's red is needed for a holder elsewhere first.

This is the heart of the ordering puzzle.

### 4.4 Auto-Stop and Color Transitions

When a holder fills completely, the pour **auto-stops** even if the player is still holding the tube. The cleared holder vanishes, gravity resolves, and the board settles.

If the player continues holding the tube after auto-stop, the system checks whether the **next color down** in the tube has a valid target in the column (matching color + clear line-of-sight, evaluated against the new post-gravity board state). If yes, pouring resumes seamlessly with the next color. If no, the tube goes idle and the player must release and choose again.

This means a single uninterrupted hold can chain through multiple clears if the stack and the board align favorably. It also means the player never has to manually re-tap to continue — the game stops them only when continuation would be meaningless.

A pour also auto-stops if the holder being filled is partially filled and the player releases. The partial fill is preserved indefinitely. Returning to the same tube later (assuming the same color is still on top, which it will be since nothing was cleared) resumes filling from where it left off.

### 4.5 Gravity

After a holder clears, every shape with empty space beneath it falls. Shapes fall as **rigid bodies**: each shape moves as one unit, maintaining its orientation, and stops the moment any of its cells lands on the floor of the board or rests on top of any cell of another shape.

Shapes do not rotate, tumble, or fragment. Two shapes do not merge.

Gravity resolves to a stable configuration before the next pour can be evaluated. Multiple shapes may fall simultaneously; they settle in physically plausible order (lower-center-of-mass first, or simultaneously where independent).

Gravity is what makes the order-of-operations matter. Clearing holder A versus holder B first can drop a third holder C into entirely different columns, opening some line-of-sights and closing others.

### 4.6 Win and Loss Conditions

**Win:** every holder on the board has been cleared. As a consequence, every tube is also empty (because liquid volume is balanced exactly to holder cell count).

**Loss:** at least one holder remains on the board, and no tube has both (a) a matching-color segment somewhere in its stack and (b) the ability to ever bring that segment to the top with a clear line-of-sight to the holder under any reachable future board state. In practice the prototype detects this conservatively: the player chooses to restart when they recognize they're stuck, or the system flags a soft-fail if no valid pour is possible from any tube on the current board.

There is **no timer** in the prototype. The player can take as long as they like. A timer may be added later as a difficulty layer.

---

## 5. Level Design Principles

### 5.1 Solvability

Every shipped level must have at least one solution sequence. The level designer (or generator) must verify this. The total liquid volume per color must equal the total holder cell count per color — this is a hard invariant.

### 5.2 Difficulty Levers

The designer has several knobs to tune challenge:

- **Number of colors.** Two-color levels are introductory. Five-or-more-color levels are advanced.
- **Stack depth per tube.** A tube with one color is trivial. A tube with four stacked colors forces the player to think several moves ahead.
- **Color fragmentation.** Spreading one color across many tubes versus concentrating it in one creates very different puzzles.
- **Holder shape complexity.** A board of 1×1 squares is mechanically simple. A board of interlocked L, T, and + shapes creates dense line-of-sight blocking and dramatic gravity rearrangements.
- **Number of solution paths.** A level with one solution is harder and more frustrating than one with several. Early levels should have multiple solutions; later levels can narrow to one.

### 5.3 Prototype Level Targets

For the prototype, ten to fifteen levels is enough to validate the mechanic. Suggested progression:

- Levels 1–3: 2 colors, no stacking, all holders 1×1 or 1×2. Teach the pour-and-clear loop.
- Levels 4–6: 3 colors, light stacking (two colors per tube), introduce L and T shapes. Teach line-of-sight blocking.
- Levels 7–9: 3–4 colors, tubes with 2–3 stacked colors, introduce gravity-dependent solutions. Teach ordering.
- Levels 10–12: 4–5 colors, deep stacks, dense boards. Test mastery.
- Levels 13–15: One-solution puzzles with elegant aha-moments.

---

## 6. Art Direction

The reference game (Water Out Puzzle) defines the visual target. Specifically:

- **Board.** Navy/dark-blue tray with rounded outer corners and a subtle inner inset shadow. Grid cells are slightly lighter purple-blue rectangles separated by thin gutters. The board has weight and presence, like a tangible plastic tray.
- **Holders.** Brightly colored, glossy outlines around translucent fills. The outline is the dominant visual element — thick, rounded, and highlight-lit on the inner edge. The fill is a desaturated, slightly transparent version of the outline color. Each cell of a multi-cell holder is shown as a rounded sub-rectangle, but the outline traces the entire shape's silhouette as one continuous loop.
- **Tubes.** Vertical glassy cylinders, each filled with bubbly, slightly-animated liquid. Color bands are visually distinct with subtle gradient shading. Tubes have a metallic or rubber cap at the top where liquid emerges.
- **Liquid.** Animated bubbles, occasional highlights, slight wobble at the surface. When pouring, a vertical stream rises with motion blur and droplet particles at the leading edge.
- **Pour effect.** When liquid enters a holder, the holder's interior fills cell-by-cell with a wave-front animation. A small splash particle plays at the entry point.
- **Clear effect.** When a holder fills, it briefly glows brighter, then collapses inward with a particle puff and a satisfying audio cue. Remaining shapes begin falling immediately after.
- **Gravity.** Falling shapes have a slight squash-and-stretch on landing, plus a small dust-puff particle and a soft thud sound.

The overall feel target: **tactile, juicy, satisfying.** Every interaction should feel like it has weight and consequence.

---

## 7. UI (Prototype Scope)

Deliberately minimal for the prototype. The screen contains:

- Level number (top center)
- Restart button (top left)
- The board (center)
- The tube row (below board)

No timer, no score, no power-ups, no settings menu, no shop, no in-game currency. These can be layered in once the core mechanic proves fun.

A "you won" celebration screen appears on level completion with a single "Next" button. A "stuck — restart?" prompt may appear when the system detects no valid pour is possible.

---

## 8. Audio

Minimum viable audio for the prototype:

- Pour stream loop (continuous while holding)
- Holder fill complete (clear, satisfying chime)
- Holder clear puff (soft pop)
- Shape land thud (low, soft)
- Level complete fanfare
- Tube refusal (subtle muted click — communicates "nothing happened" without being annoying)
- UI tap

---

## 9. Out of Scope for Prototype

These exist in the reference game and may be added later, but are explicitly **not** in the prototype build:

- Timer and time pressure
- Power-ups (freeze, cannon, add-time, etc.)
- Hint system
- Boards with irregular outlines, holes, or non-rectangular shapes
- Tubes entering from the top or sides of the board
- Obstacles in the grid (anchors, dots, immovable blocks)
- Directional arrow pieces or any movable in-board mechanics
- Currency, shop, ads, monetization
- Daily challenges, leaderboards, social features
- Animations beyond the essential feedback loop

---

## 10. Open Questions to Decide During Prototyping

These are intentionally left open and should be resolved through playtesting:

- **Pour speed.** How fast does liquid rise? Too slow is boring; too fast removes the moment of "watching the puzzle resolve." Probably tuned per cell (e.g., 0.15s per cell of fill).
- **Gravity speed.** Should shapes fall fast and snap, or fall slowly with anticipation? Tied to perceived game pace.
- **Auto-stop visual feedback.** When a tube auto-stops mid-hold, does the stream simply cut, or does it linger and fade? Affects how the player notices the stop.
- **Color transition feedback.** When a tube transitions to its next color mid-hold, do we play a small "clunk" or color-shift effect? Probably yes, to make the stack feel mechanical.
- **Stuck detection.** Solver-based detection (run a search for any winning sequence) is correct but expensive. Heuristic detection (no tube can pour anything right now) is cheap but imprecise — some boards are temporarily idle but become solvable after a long manual sequence. Decision deferred until level data is available to test on.
- **Restart cost.** Should restarts be free, or carry some friction? Free for prototype; revisit later.

---

## 11. Success Criteria for the Prototype

The prototype is successful if a playtester:

1. Understands the pour mechanic within the first level without explanation.
2. Experiences a genuine "aha" moment when they realize stacking and line-of-sight create the puzzle, somewhere around levels 4–7.
3. Voluntarily replays a failed level rather than quitting.
4. Can describe, in their own words after playing, what makes a level hard or easy.

If those four happen, the core loop works and we can build outward (timer, power-ups, meta-progression, monetization). If they don't, the mechanic needs revision before any of that.
