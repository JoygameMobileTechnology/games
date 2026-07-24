# 🏰 Siege Rush — Game Design Document

## Overview

**Genre:** Hybridcasual Puzzle / Strategy
**Platform:** Mobile (iOS & Android)
**Orientation:** Portrait (Vertical)
**Core Loop:** Deploy troops → Merge on conveyor → Circle the board → Destroy all structures → Clear the level

---

## Visual Style

- Hypercasual aesthetic — clean, flat, bold colors
- Troops are stickmen (similar to hypercasual games)
- Settlements have a top-down grid look
- Reference feel: **Pixel Flow** layout, but without color mechanics

---

## Screen Layout

```
┌─────────────────────────┐
│        TOP HUD          │  ← Level info, stars, HP bars
├─────────────────────────┤
│  ┌───────────────────┐  │
│  │  [CONVEYOR BELT]  │  │
│  │  ┌─────────────┐  │  │
│  │  │             │  │  │
│  │  │  GAME BOARD │  │  │
│  │  │  (Grid)     │  │  │
│  │  │             │  │  │
│  │  └─────────────┘  │  │
│  │  [CONVEYOR BELT]  │  │
│  └───────────────────┘  │
├─────────────────────────┤
│      TROOP PANEL        │  ← Tap to deploy troops
└─────────────────────────┘
```

- The **conveyor belt** wraps around the central game board like a frame
- Troops travel around the conveyor in one direction (e.g., clockwise)
- Troops **shoot inward** at structures as they pass by
- The **troop panel** at the bottom shows available troop types to tap and deploy

---

## Core Mechanics

### 1. Deploying Troops
- The player taps a troop type in the bottom panel to send it onto the conveyor
- Troops enter the conveyor from the **bottom section**
- Each troop has a fixed amount of ammunition; when it runs out, the troop exits the board
- Troops also exit if their HP reaches zero (shot by turrets)

### 2. Conveyor Movement
- Troops move continuously around the conveyor belt (clockwise)
- As they move past structures on the board, they automatically shoot at them
- Multiple troops can be on the conveyor at the same time

### 3. Merge Mechanic
- If **two troops of the same level** meet on the conveyor, they **merge into the next level up**
  - Level 1 + Level 1 → Level 2
  - Level 2 + Level 2 → Level 3
  - Level 3 + Level 3 → (max level, no further merge)
- Merging happens automatically on contact on the conveyor
- The merged troop inherits the **full stats of the new level** (not additive)

### 4. Shooting
- Troops shoot **inward** toward the nearest visible structure as they travel
- Each shot consumes 1 ammunition
- Troops cannot shoot through walls — they target the closest structure in their line of sight

### 5. Level Cleared
- A level is cleared when all structures (walls, base, turrets, other buildings) are destroyed
- **No troops carry over** — each level starts fresh
- The player is scored (1–3 stars) based on efficiency (e.g., troops used, time taken)

---

## Troops

All troops are stickman-style characters with a visual weapon indicator.

| Level | Name | Weapon | Damage/Shot | Fire Rate | HP | Ammo |
|-------|------|--------|-------------|-----------|-----|------|
| 1 | Archer | Arrow 🏹 | 1 | Every 1.5s | 10 | 20 |
| 2 | Gunner | Bullet 🔫 | 3 | Every 1.0s | 20 | 15 |
| 3 | Bomber | Bomb 💣 | 5 | Every 0.75s | 30 | 10 |

> **Merge Rule:** Same level + Same level = Next level up (with that level's full base stats)

---

## Structures

All structures occupy **1×1 grid cells** unless otherwise noted. Structures have no attack ability unless specified.

---

### Walls

Walls act as barriers protecting the base and other structures. Each wall segment occupies 1 grid cell.

| Type | HP per Segment | Visual |
|------|---------------|--------|
| Wooden Wall | 1 | Light brown planks |
| Stone Wall | 2 | Grey stone bricks |
| Steel Wall | 3 | Dark metallic panels |

- Walls are arranged in lines or enclosures around the settlement
- Troops must shoot through or around walls to reach inner structures

---

### Base

The **Base** is the primary target of each level. It sits in or near the center of the board. The level is not cleared until the base is destroyed.

| Type | HP | Difficulty Tier |
|------|----|----------------|
| Wooden Base | 10 | Easy |
| Stone Base | 20 | Medium |
| Steel Base | 30 | Hard |
| Tech Base | 50 | Elite |

- The base is a multi-cell structure (e.g., 2×2 grid footprint)
- Visually distinct per tier (color, shape, details)

---

### Turrets

Turrets **shoot back** at troops on the conveyor. They rotate to face the nearest troop.

| Type | HP | Damage/Shot | Fire Rate |
|------|----|-------------|-----------|
| Wooden Turret | 2 | 1 | Every 2.0s |
| Stone Turret | 3 | 2 | Every 1.5s |
| Steel Turret | 4 | 3 | Every 1.0s |

- Turrets are placed within the settlement layout
- Turret count scales with level difficulty
- Destroyed turrets no longer fire

---

### Other Structures

Small structures that add gameplay variety. They do **not** shoot back.

| Structure | HP | Effect |
|-----------|----|--------|
| **Watchtower** | 3 | Boosts nearby turret fire rate by 25% while intact |
| **Armory** | 5 | Repairs adjacent walls by 1 HP every 3s while intact |
| **Supply Tent** | 2 | No active effect; worth bonus score when destroyed |
| **Barricade** | 1 | Cheap obstacle, placed in clusters to block troop line of sight |

> Design note: These structures are kept simple and readable — they either buff defenders or provide small obstacles.

---

## Level Design

Each level represents a **different settlement** with a unique layout:

- **Easy levels:** Wooden walls, few turrets, wooden/stone base, open layout
- **Medium levels:** Mixed stone/wood walls, more turrets, stone base, tighter layout
- **Hard levels:** Stone/steel walls, many turrets, steel base, maze-like layout
- **Elite levels:** Full steel walls, max turrets, tech base, watchtowers and armories present

### Layout Principles
- Walls create **paths and choke points** around the board
- The base is always **reachable** from the conveyor (not fully enclosed by indestructible elements)
- Turret placement challenges the player to prioritize targets

---

## Game Flow

```
Level Start
    │
    ▼
Player views settlement layout
    │
    ▼
Player taps troops to deploy → Troops enter conveyor
    │
    ▼
Troops travel conveyor, shoot inward, merge if matching
    │
    ├──► Troops run out of ammo → exit board
    ├──► Troops killed by turrets → exit board
    │
    ▼
All structures destroyed?
    ├── YES → Level Clear! → Star rating → Next Level
    └── NO  → Deploy more troops (if available)
                    │
                    └── Out of troops → Level Failed → Retry
```

---

## UI / UX Notes

- **Troop panel** shows available troop types with a count or cooldown indicator
- **HP bars** float above structures on the board
- **Merge animation** plays when two troops combine on the conveyor (flash, level-up effect)
- **Projectile visuals** are simple and clear: arrow streak, bullet dot, bomb arc
- **Conveyor belt** has a visible moving animation to show direction of travel
- **Level intro** shows a brief overview of the settlement layout before the player taps to start

---

## Out of Scope (Keep Simple)

- No color mechanics
- No economy / currency system (can be added later)
- No troop upgrades between levels
- No multiple simultaneous conveyors
- No player-controlled troop direction

---

*Document version: 0.1 — Initial Design Draft*
