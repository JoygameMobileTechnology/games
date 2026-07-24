# Game Design Document
## Project Codename: *MatchStack*

**Genre:** Hybridcasual Puzzle
**Platform:** Mobile (iOS & Android)
**Orientation:** Portrait (Vertical)
**Version:** 0.1 — Initial Draft

---

## 1. Game Overview

*MatchStack* is a hybridcasual mobile puzzle game combining Mahjong-style stacked card mechanics, a memory layer, and a merge system. Players tap face-down cards on a layered grid board to reveal image pieces of everyday objects, then collect and merge those pieces to clear the board.

The core loop is satisfying and accessible: flip, remember, collect, merge. Difficulty scales naturally by increasing the number of card layers, expanding the board size, and splitting images into more pieces.

---

## 2. Core Gameplay Loop

```
1. Tap a face-down card on the Main Board → card flips and reveals an image piece
2. Tap the revealed card again → it moves to the Merge Board below
   OR
   Tap a different face-down card → the first card flips back face-down (hidden again)
3. On the Merge Board, collect all pieces belonging to the same image
4. When all pieces of an image are present on the Merge Board → they automatically merge and disappear
5. Repeat until all cards are cleared from the Main Board → Level Complete
6. If the Merge Board fills up (9 cards) with no merge completing → Game Over
```

---

## 3. Boards

### 3.1 Main Board

- A grid-based board positioned in the **center of the screen**.
- **Grid size varies per level** (e.g., 5×6, 6×8, etc.), tuned for difficulty and visual fit within the vertical layout.
- Cards are stacked in **multiple vertical layers**, rendered with a visual depth offset similar to classic Mahjong — upper layers are shifted slightly so players can perceive the stack.
- A card on a lower layer **cannot be tapped** if there is any card directly stacked above it. Only the topmost exposed cards are interactable.
- All cards begin **face-down** (reversed), hiding their image pieces.

### 3.2 Merge Board

- Located **below the Main Board**, always visible.
- A **3×3 square grid** with a capacity of exactly **9 card slots**.
- Cards placed here are always **face-up** (image visible).
- Position within the Merge Board does not matter — pieces only need to all be present for a merge to trigger.
- When a merge triggers, the matching set of cards **disappears with a merge animation**, freeing up slots.
- If all 9 slots are filled and no merge is possible → **Game Over**.

---

## 4. Cards

### 4.1 Card Sizes

Cards are not all uniform — they can occupy different amounts of grid cells on the Main Board:

| Size | Grid Cells Occupied | Notes |
|------|---------------------|-------|
| 1×1 | 1 cell | Standard square |
| 2×1 | 2 cells (horizontal) | Can be rotated to 1×2 |
| 2×2 | 4 cells | Larger square |
| 3×1 | 3 cells (horizontal) | Can be rotated to 1×3 |

### 4.2 Card Rotations

All non-square card sizes can appear in any of four rotations:
- **0°** (default orientation)
- **90°** (clockwise)
- **180°** (flipped)
- **270°** (counter-clockwise)

Larger cards can overlap cells occupied by other cards on different layers — this is expected and intentional.

### 4.3 Card Front (Image Piece)

- Each card face displays **one image piece** of a daily object.
- The image piece shape is **independent of the card's physical size** — a 2×1 card does not necessarily contain a rectangular image slice.
- Pieces are scattered across the board and may belong to different images.

### 4.4 Card Back

- All cards begin face-down with a uniform, decorative back design.
- No information about the image piece is visible from the back.

---

## 5. Image System

### 5.1 Image Theme

All images depict **everyday objects** from daily life, organized into categories:

- **Clothing & Accessories** — shirt, sneakers, hat, sunglasses, bag
- **Furniture & Home** — chair, lamp, sofa, table, clock
- **Tools & Hardware** — wrench, hammer, scissors, paintbrush, tape measure
- **Devices & Electronics** — smartphone, headphones, camera, laptop, remote control
- **Kitchen & Household** — mug, kettle, toaster, spatula, bowl

Images should be **clear, colorful, and immediately recognizable** — stylized illustration style recommended over photorealism.

### 5.2 Image Pieces

Each image is divided into **2 to 6 pieces**, spread across individual cards on the Main Board:

| Piece Count | Difficulty Contribution |
|-------------|------------------------|
| 2 pieces | Easy — quick to complete |
| 3 pieces | Moderate |
| 4 pieces | Moderate–Hard |
| 5 pieces | Hard |
| 6 pieces | Very Hard — tests memory and board management |

A level may contain multiple images simultaneously, with pieces interleaved across the board.

### 5.3 Merge Trigger

When all pieces of a single image are present anywhere on the Merge Board simultaneously, they **automatically merge**. No manual arrangement is needed.

---

## 6. Memory Mechanic

The memory mechanic is the key tension driver:

- A player may only have **one card flipped at a time** on the Main Board.
- If the player taps a **second face-down card** before sending the first to the Merge Board, the **first card flips back face-down**.
- This means the player must remember what they revealed and where it was — especially important when managing multi-piece images.
- The memory depth becomes more demanding as the board grows in size and layers.

---

## 7. Win & Lose Conditions

| Condition | Outcome |
|-----------|---------|
| All cards cleared from the Main Board | **Level Complete** |
| Merge Board reaches 9 cards with no merge possible | **Game Over** |

There are no time limits or move counters — the sole constraint is the Merge Board capacity.

---

## 8. Difficulty System

Level difficulty is tuned using four primary levers:

| Lever | Low Difficulty | High Difficulty |
|-------|---------------|----------------|
| Main Board grid size | Small (e.g., 4×5) | Large (e.g., 7×9) |
| Number of vertical layers | 1–2 layers | 4–5+ layers |
| Image piece count | 2 pieces per image | 5–6 pieces per image |
| Number of distinct images on board | Few (2–3) | Many (6–8+) |

Early levels should introduce mechanics one at a time:
- **Level 1–3:** Single layer, 2-piece images, small board
- **Level 4–10:** Two layers introduced, 3-piece images
- **Level 11+:** Multiple layers, mixed image sizes, larger boards

---

## 9. UI Layout (Portrait)

```
┌─────────────────────────┐
│        Top HUD          │  ← Level number, progress indicator
├─────────────────────────┤
│                         │
│       Main Board        │  ← Stacked card grid (center)
│   (Mahjong-style grid)  │
│                         │
├─────────────────────────┤
│      Merge Board        │  ← 3×3 grid, 9-card capacity
│  [ ][ ][ ][ ][ ][ ]    │
│  [ ][ ][ ]             │
├─────────────────────────┤
│      Bottom Bar         │  ← (Reserved for future power-ups / hints)
└─────────────────────────┘
```

---

## 10. Visual & Audio Direction

### 10.1 Art Style
- Clean, flat illustration style with soft shadows
- Warm, cheerful color palette to match the everyday object theme
- Cards have satisfying flip animations (card rotation on Y-axis)
- Merge effect: cards glow, rise, and pop into a completed image thumbnail before disappearing

### 10.2 Audio
- Light, ambient background music (lo-fi or cheerful casual tone)
- Satisfying flip sound on card tap
- Distinct "collect" sound when card moves to Merge Board
- Celebratory jingle on merge completion
- Level complete fanfare
- Tense short sound / visual cue when Merge Board is nearly full (7–8 cards)

---

## 11. Open Questions & Future Considerations

- **Power-ups:** Potential future additions — Peek (reveal a card without flipping), Shuffle (rearrange Merge Board), Extra Slot (temporary 10th merge slot)
- **Hints:** Could highlight a card that matches a piece already on the Merge Board
- **Monetization:** Lives system on Game Over, level skip, cosmetic card backs
- **Level Editor:** Internal tool for designers to place cards, define layers, and assign image pieces
- **Undo mechanic:** May be considered — currently excluded to preserve memory challenge

---

*Document Status: Draft — pending art direction review and prototype validation.*
