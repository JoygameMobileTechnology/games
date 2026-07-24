# Liquid Color Sort – Game Design Document

## Concept Overview

**Liquid Color Sort** is a casual mobile puzzle game that blends the satisfying mechanics of liquid color-sorting with a pixel art reveal system. Players pour colored liquids between containers to sort them by color, and each completed container fills in a section of a hidden pixel art image.

---

## Core Mechanic

### The Pour System

- Each level presents a set of **containers** (tubes, flasks, beakers, or jars) filled with **layered liquid segments** of different colors.
- The player taps a **source container**, then taps a **destination container** to pour.
- Liquid can only be poured if:
  - The top color of the source matches the top color of the destination, **or**
  - The destination is completely empty.
- Pouring continues automatically until the colors no longer match or the destination is full.

### Winning Condition

A level is complete when every container holds only **one single color** (or is empty). Each fully sorted container triggers the reveal of a pixel art section corresponding to that color.

---

## Strategic Layer

### What Makes It Challenging

- Colors are **stacked and trapped** beneath mismatched layers — players must plan a sequence of pours to unshuffle them.
- Containers have **limited capacity** (typically 4 segments each).
- Players may be given 1–2 **empty spare containers** as buffers, but using them wisely is key.
- Later levels introduce more colors, more containers, and less free space.

### Planning Ahead

Unlike simple tap-and-sort games, the liquid mechanic rewards thinking several moves ahead:

1. Identify which colors are blocked.
2. Find or create an empty space to temporarily hold a blocking color.
3. Uncover the target color and route it to its matching container.

---

## The Pixel Art Reveal

- Each level has a hidden pixel art image divided into **color zones**.
- When a container is fully sorted (one color only), its corresponding color zone in the pixel art **fills in with a fluid animation**.
- The image reveals progressively as the player sorts each color.
- Completing the level shows the **full artwork** with a celebratory effect.

### Themes (Examples)
- Animals & nature
- Food & drinks
- Landscapes & cityscapes
- Abstract patterns
- Seasonal / holiday exclusives

---

## Container Types

| Container | Capacity | Notes |
|-----------|----------|-------|
| Test Tube | 4 segments | Standard container |
| Flask | 6 segments | Introduced in mid-game |
| Wide Jar | 3 segments | Short but wide; easier to fill |
| Locked Tube | 4 segments | Cannot receive pours until unlocked |

---

## Level Progression

| Stage | Colors | Containers | Difficulty |
|-------|--------|------------|------------|
| Beginner (1–30) | 3–4 | 5–6 | Minimal trapping, lots of free space |
| Intermediate (31–100) | 5–6 | 7–9 | More layers, fewer spare slots |
| Advanced (101–300) | 7–9 | 10–13 | Deep trapping, tight space |
| Expert (301+) | 10+ | 14+ | Near-zero margin for error |

---

## Game Feel & Juice

- **Pour animation**: Smooth liquid flow with color blending at the edges.
- **Sound**: Soft liquid pour sounds, satisfying "glug" on completion.
- **Haptics**: Gentle pulse on a successful pour; stronger pulse on level complete.
- **Pixel art reveal**: Each color zone fills with a ripple/flood animation, not an instant fill.
- **No timers**: Fully relaxed, pressure-free play.

---

## Why Liquid vs. Jewels?

| Aspect | Jewels | Liquid |
|--------|--------|--------|
| Sorting unit | Individual piece | Fluid segment (can pour multiple at once) |
| Visual feedback | Sparkle & placement | Pour flow, color layering |
| Strategic depth | Low–Medium | Medium–High (trapped layers add complexity) |
| Satisfying moment | Placing the last piece | Watching liquid flow and settle |
| Pixel art integration | Piece fills a cell | Color zone floods in |

The liquid metaphor also scales naturally in difficulty — the *depth* of trapped colors is immediately visible inside each container, giving players clear information to plan with.

---

## Monetization (Suggested)

- **Ads**: Optional rewarded ads to add an extra empty container (hint).
- **No mid-gameplay ads**: Ads only shown between levels.
- **Premium**: One-time purchase to remove ads.
- **Cosmetics**: Alternate container styles (potions, wine glasses, test tubes) and liquid effects (glitter, neon, pastel).

---

## Platform

- iOS & Android (mobile-first)
- Offline play supported
- No account required
