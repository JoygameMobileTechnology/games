# ARROWSTORM — Game Design Document
**Working title.** Arrow-puzzle × horde-defense hybrid.
**Version 1.0 — Prototype scope** · August 2026

---

## 1. One-Liner

Free arrows from a puzzle board to arm your hero against descending hordes — every arrow is ammo, every wave is a fresh board, and running dry means dying slow.

**Genre:** Puzzle / Horde Defense roguelite
**References:** *Arrows: Puzzle Escape* (board mechanic) × *Hellsquad RRRush* (horde combat, XP level-ups, art direction) × *Dice Dungeons* (wave/chapter backbone, ported from existing code)
**Platform:** Single `.html` file, Chrome on PC and mobile
**Orientation:** Portrait (letterboxed on desktop, ~9:16 play area)
**Input:** Touch + mouse (tap only)

---

## 2. Design Pillars

1. **The puzzle IS the weapon.** No auto-attacks, no fallback gun. Every point of damage comes from freeing an arrow. Puzzle speed = DPS.
2. **Ammo discipline.** The board is a per-wave damage budget with no mid-wave refill and no failsafe. Overkill is waste. Waste kills you.
3. **Risk is baked into geometry.** Long arrows hit hardest and are hardest to free. No extra rules needed — the board itself creates the risk/reward.
4. **Juice like Hellsquad.** Crisp, saturated, bold-outlined cartoon art. Every kill pops. Every hit flashes. Smooth 60fps, all drawn in code.

---

## 3. Screen Layout (Portrait)

```
┌─────────────────────────────┐
│  HUD: ❤ HP bar · Wave 4/10  │  ← top strip
│       Chapter name · ⏸      │
│ · · · enemy spawn band · · ·│
│                             │
│     COMBAT ZONE (~50%)      │  ← enemies walk DOWN
│                             │
│   ═══ melee line ═══        │
│         🧙 HERO             │  ← stationary, center
│  [XP bar ▓▓▓▓░░░░  Lv 3]    │
├─────────────────────────────┤
│                             │
│    ARROW BOARD (~42%)       │  ← 7 × 8 grid
│                             │
│  Arrows left: 14  ⚠ LOW     │  ← ammo counter
└─────────────────────────────┘
```

- **Combat zone (top ~50%):** enemies spawn in a band near the top edge (always visible — ported from Dice Dungeons `spawnY`) and walk down. They stop at the **melee line** just above the hero and attack.
- **Hero:** fixed position, centered, between combat zone and board.
- **Board (bottom ~42%):** the puzzle grid. Sized for thumbs.
- **Tap zones:** taps on the board = puzzle input. Taps on an enemy = **focus fire** (see §6.4).

---

## 4. Core Loop

```
Press START WAVE (fresh board visible — plan!)
      │
      ▼
Enemies spawn from queue ──► walk down ──► melee the hero
      │                                        ▲
      ▼                                        │
Tap free arrows ──► arrow flies to hero ──► fired at front-most enemy
      │
      ▼
Kills drop XP ──► bar fills ──► PAUSE: pick 1 of 3 skills ──► resume
      │
      ▼
Wave cleared ──► leftover arrows → bonus XP ──► board wiped & regenerated
      │
      ▼
Next wave … Wave 5 = MINI-BOSS … Wave 10 = BOSS ──► chapter clear
```

**Session shape:** one chapter ≈ one run (5–8 min). Death = run over, restart chapter at wave 1 with a fresh build (roguelite reset).

---

## 5. The Arrow Board

### 5.1 Grid & Arrows
- Grid: **7 columns × 8 rows** (constant across chapters; density scales instead).
- An arrow occupies **1–4 contiguous cells** in a straight line and points in one of **4 directions** (↑ ↓ ← →).
- **Tap a free arrow:** its exit path (from its head to the board edge, along its facing direction) contains no occupied cells → it slides out along that path, arcs to the hero, and is fired (§6).
- **Tap a blocked arrow:** it lurches, *clangs*, shakes the blocking cell, and **locks for 0.5s**. Time lost is the real penalty (enemies keep advancing) — the lock just prevents brainless spam from being optimal.

### 5.2 Board Generation
- **Reverse-insertion generation:** boards are built by inserting arrows from the edges inward, guaranteeing the board is always fully clearable in *some* order. No dead boards, ever.
- **Damage budget:** total board damage ≈ **1.5× the wave's total enemy HP** (Ch1) → **1.35×** (Ch2) → **1.25×** (Ch3). Sloppy play survives; wasteful play starves.
- Fill density scales ~55% → 75% of cells across a chapter; length mix shifts longer in later waves.

### 5.3 Refill Rules (LOCKED DECISIONS)
- **No mid-wave refill. No failsafe.** If the board runs dry with enemies alive, the hero stands unarmed and takes the beating. Restart follows. Ammo discipline is the lesson.
- **Between waves:** leftover arrows convert to **bonus XP (+3 XP each)**, then the board is **wiped and regenerated fresh**, scaled to the next wave.
- **Readability requirements** (mandatory because there's no failsafe):
  - persistent **"Arrows left"** counter under the board;
  - **low-ammo warning** — counter pulses red when board < 20% and enemies remain;
  - enemy **HP bars** + floating **damage numbers**, so overkill is a visible, judgeable mistake.

### 5.4 Element Colors on the Board
| Chapter | Native board composition |
|---|---|
| 1 | 100% Neutral (grey) |
| 2 | ~10% random elemental arrows appear natively |
| 3 | ~20% native elemental |

Skill conversions (§8) stack **on top** of native composition.

---

## 6. Combat

### 6.1 Hero
- Stationary channeler. **100 base HP.** No auto-attack, no active ability in v1 — pure conduit for the board.
- Freed arrows visually arc from the board to the hero, who instantly re-fires them as glowing projectiles.

### 6.2 Arrow Damage & Pierce
- **Damage = 12 × length** → L1 = 12, L2 = 24, L3 = 36, L4 = 48. *(All numbers tunable.)*
- **Pierce:** L3 arrows pierce **1** extra enemy behind the target; L4 pierce **2**. Each successive hit deals **−40%**.

### 6.3 Elements
Effect *strength scales with arrow length* — a long ice arrow is a hard freeze, a short one a tap of slow.

| Element | Color | Effect (base, per hit) | Length scaling |
|---|---|---|---|
| Neutral | Grey | damage only | — |
| Fire | Red | Burn: 4 dmg/s for 3s (re-hits refresh) | +1s duration per length |
| Ice | Blue | Slow 40% for 2s | +0.6s per length; L4 = full **freeze** 1.5s |
| Lightning | Yellow | Chains to nearest enemy in radius for 50% dmg | +1 chain at L3+ |

### 6.4 Targeting
- **Default: front-most** — the enemy closest to the hero (i.e., the one about to hurt or currently hurting you). Targeting = threat removal.
- **Focus fire:** tap any enemy in the combat zone to mark it; all arrows target it until it dies or you tap elsewhere. This is the answer to back-line archers plinking you while melee crowds the front. Marked enemy gets a reticle.

### 6.5 Enemy Behavior
- Spawn in the top band, walk down (`move` px/s).
- **Melee types:** stop at the melee line, spread shoulder-to-shoulder, and chip the hero on their `atk` / `spd` timers (stat block reused from Dice Dungeons). They stay until killed — chip damage stacks fast if the front line isn't cleared.
- **Ranged types:** stop at their `range` and fire slow, visible projectiles at the hero. Unavoidable → balanced by **low HP** and answered by focus fire / pierce.
- **Board interference (elites & bosses)** — the top half attacks the bottom half:
  - **Shaman "Root":** telegraph → a random arrow gets vines, **locked for 5s** (or freed early with 2 taps).
  - **Boss "Rockfall":** telegraph → 2–3 boulders land on empty cells, **blocking exit lanes for 8s**, then crumble. Always temporary — with no refill, permanent blockers could soft-lock a board, so they never persist.

---

## 7. Waves, Hordes & Chapters (ported from Dice Dungeons)

**Systems carried over from the existing codebase:**
- Wave data format: `{ name, enemies: [{type, count, delay}], isBoss }`
- Spawn queue with per-enemy delay timers (`spawnQueue` / `spawnTimer`)
- Wave state machine: `waiting → spawning → fighting → cleared → intermission` (the `cards`/`dice` states are replaced by mid-wave XP pauses)
- **Start Wave button** between waves — doubles as the *board-preview planning beat*
- Wave announcement banner ("Wave 4 — Arrow Storm")
- Boss `summonInterval` (bosses periodically summon adds)

**Structure:** 3 chapters × 10 waves. **Wave 5 = mini-boss** (elite with a board-interference ability), **Wave 10 = boss**. Clearing a chapter unlocks the next (saved via `localStorage` — works fine as a local file in Chrome).

### Chapter Themes & Roster (baseline stats; retuned from Dice Dungeons to the new damage economy)

**Chapter 1 — The Greenmarch** *(tutorialized: all-neutral boards, melee-heavy)*
| Enemy | Role | HP | ATK | SPD (s) | Move | XP |
|---|---|---|---|---|---|---|
| Goblin | melee fodder | 36 | 5 | 1.0 | 60 | 4 |
| Kobold Archer | ranged | 24 | 6 | 1.6 | 48 | 5 |
| Ogre | tank melee | 140 | 14 | 2.0 | 38 | 12 |
| **W5 Ogre Warchief** | mini-boss, Rockfall | 400 | 18 | 1.8 | 36 | 60 |
| **W10 Grashnak** | boss, summons goblins | 1200 | 24 | 1.4 | 42 | 150 |

**Chapter 2 — The Whispering Crypts** *(introduces native element arrows, more ranged)*
Skeleton (melee, 60 HP) · Wraith (ranged, 45 HP) · Bone Shaman (ranged + **Root**, 55 HP) · **W5 Bone Colossus** (mini-boss) · **W10 Skullking Morvax** (ranged boss, summons skeletons)

**Chapter 3 — The Abyssal Gates** *(fast swarms + tanks, heavy board interference)*
Imp (fast melee, 34 HP) · Hellhound (fast melee, 80 HP) · Gargoyle (tank, 130 HP) · Pit Shaman (Root) · **W5 Gate Sentinel** (mini-boss, Rockfall) · **W10 Baelzoth** (boss, summons + Rockfall)

Wave composition tables follow the Dice Dungeons pattern (fodder waves → mixed waves → swarm wave → elite wave → boss); exact tables authored at build time.

---

## 8. Progression: XP & Skills

### 8.1 XP Loop (Hellsquad-style, LOCKED)
- Kills emit XP orbs that fly to the XP bar automatically (hero is stationary — no pickup walking).
- Bar fills → **game pauses → pick 1 of 3 random skills → resume.** Mid-combat, mid-wave.
- XP to reach level *n*: `30 × 1.35^(n−1)` (tunable).
- **Boss & mini-boss kills grant one guaranteed free pick.**
- Leftover arrows at wave clear = +3 XP each (efficiency reward).

### 8.2 Skill Pool (v1 — 16 skills)
Rarity weights: Common 60% / Rare 30% / Epic 10%. Stackable unless noted.

| Skill | Rarity | Effect |
|---|---|---|
| Sharpened Tips | C | +15% arrow damage |
| Vitality | C | +25 max HP, heal 25 |
| Fletcher | C | Future boards: +10% damage budget |
| Scavenger | C | Leftover-arrow XP ×2 *(once)* |
| Quick Hands | C | Blocked-tap lock −50% *(once, then removed)* |
| Long Draw | C | +15% chance generated arrows are 1 longer |
| Fire Conversion | R | +20% of arrows are Fire — **instantly repaints current board** + all future boards |
| Ice Conversion | R | +20% Ice (instant + future) |
| Lightning Conversion | R | +20% Lightning (instant + future) |
| Kindling | R | Burn ticks +50% |
| Deep Freeze | R | Ice slow 40% → 60%; freeze threshold L4 → L3 |
| Storm Caller | R | +1 lightning chain |
| Regeneration | R | +1 HP/s |
| Piercer | E | Pierce threshold −1 (L2 arrows pierce) |
| Executioner | E | Enemies below 15% HP die instantly |
| Boss Slayer | E | +40% damage to elites & bosses |

*Design note:* conversion skills must repaint the **current** board immediately — level-ups happen mid-wave but boards only regenerate between waves, so without instant repaint the skill would feel dead on pick.

---

## 9. Difficulty & Tuning Knobs

| Knob | Effect |
|---|---|
| Board damage budget ×1.5 → ×1.25 | The core difficulty dial |
| Enemy `move` speed | Pressure on puzzle-solving speed |
| Spawn `delay` values | Burst intensity of hordes |
| Ranged enemy count | Unavoidable chip → HP check |
| Root / Rockfall frequency | Board disruption |
| Fill density & length mix | Puzzle complexity |

**Balance guardrails:** a median player should clear Ch1 on the first or second run; Ch3 should demand deliberate ammo economy + a coherent element build. Death should trace to a *readable* mistake (overkill spam, ignored archers, tanking with a full board).

---

## 10. Art Direction — "Hellsquad crisp"

All art is **code-drawn on canvas** (single-file constraint, no external assets).

- **Palette:** saturated, high-contrast. Each chapter tints the battlefield (green woods / cold violet crypt / ember-red abyss). Element colors are loud and unmistakable.
- **Characters:** chunky cartoon proportions, **bold dark outlines**, big readable silhouettes at small sizes, 2–3 frame procedural animation (bob, waddle, attack lunge) with **squash & stretch**.
- **Arrows:** fat, glossy, toy-like shafts with clear heads; element arrows glow with soft outer bloom.
- **VFX:** projectile glow trails · hit flash (white blink) · hit sparks · burn embers · frost shards · chain-lightning arcs · floating damage numbers (crit-style pop on long arrows) · XP orbs streaking to the bar · screen shake on boss hits and Rockfall · death poofs with knock-back squash.
- **UI:** rounded, glossy buttons; thick-stroked icons; smooth eased tweens on every popup (skill cards slide + bounce in).
- **Motion target:** 60fps; every interaction answers within 1 frame (tap → arrow lurch/slide is instant).

## 11. Audio

WebAudio synth, no files (approach ported from Dice Dungeons `sfx` module): tap-clang (blocked), whoosh-thunk (fire/hit), freeze crackle, burn crackle, chain zap, XP chime, level-up fanfare, wave horn, boss roar, rockfall rumble, defeat sting.

---

## 12. Screens & Flow

1. **Title / Chapter Select** — 3 chapter cards (locked/unlocked via `localStorage`), best-wave marker per chapter.
2. **Run screen** — the layout in §3. Between waves: wave-clear banner → leftover-XP tally → fresh board slides in → **START WAVE** button.
3. **Level-up popup** — pause, dim, 3 skill cards, tap to pick.
4. **Defeat** — "The horde overran you" + run stats (waves, kills, arrows fired, damage wasted to overkill) → Retry chapter.
5. **Chapter clear / Victory** — stats + next-chapter unlock; Ch3 clear = victory screen.

## 13. Tech Notes

- Single `.html`, zero dependencies, Canvas 2D, `requestAnimationFrame`, fixed-timestep update.
- Portrait play area letterboxed on desktop Chrome; full-bleed on mobile; touch + mouse unified.
- `localStorage` for chapter unlocks (valid for a local file opened in Chrome — the claude.ai artifact restriction doesn't apply to a downloaded build).
- Ported Dice Dungeons modules: wave data schema, spawn queue, wave state machine, announcement UI, start-wave overlay, WebAudio sfx scaffold.

## 14. Out of Scope (v1 prototype)

Meta currency & shops · multiple heroes · active/ultimate abilities · daily runs · endless mode · monetization hooks · localization.

## 15. Open Tuning Questions (to resolve in playtest)

1. Is 0.5s blocked-tap lock enough to kill spam, or too punishing on mobile mis-taps?
2. Budget ×1.25 in Ch3 — brutal or fair? (First candidate to loosen.)
3. Should pierce hit enemies behind the target only, or all enemies along the flight line?
4. Focus fire: sticky until death (current) vs. timed 4s mark?
5. Boss Rockfall on a nearly-empty board — cap boulders at (empty cells − 4) to preserve the "no soft-lock" promise?

---

*End of GDD v1.0 — next step: build the prototype `.html`.*
