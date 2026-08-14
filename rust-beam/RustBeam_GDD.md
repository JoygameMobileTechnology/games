# RUSTBEAM — Game Design Document
**Version:** 0.1 (Prototype) · **Date:** 2026-08-14 · **Working title** (alternatives: Rust Blast, Laser Rust, Shine Loop)

**Genre:** Hyper-casual satisfying puzzle — conveyor/queue management + laser rust-cleaning
**Prototype platform:** Single-file HTML5, portrait, touch + mouse
**References:** *Weld It 3D* (laser rust-cleaning fantasy & satisfaction) · *Pixel Flow* (conveyor-queue puzzle loop; benchmark for palette, animation, UI, light & shadow)

---

## 1. High Concept

A rusty steel plate hides a vibrant painting. Colored laser guns ride a conveyor loop around the plate and burn away rust of **their own color**, revealing the true artwork underneath. The queues are fixed — **when** you deploy each gun is the puzzle. Fill all five hold slots and you fail; strip 100% of the rust and the restored image shines.

**Design pillars**
1. **Oddly satisfying cleaning** — every beam-second must look and sound delicious (sparks, sizzle, hot glow, shine sweep).
2. **Readable puzzle pressure** — all information is public (queue order, capacities, image layout). Failure is always an ordering mistake, never hidden information.
3. **Reveal payoff** — the artwork "comes alive" as the level's reward moment.

---

## 2. Core Loop

Tap the front gun of a lane → it enters the conveyor → it auto-fires a continuous laser at *exposed* rust of its color → capacity drains per cell → at 0 it despawns. A gun that finishes a lap idle with ammo left parks into a **hold slot** (tap to redeploy later). Clean 100% of the plate → **win**. Fifth hold slot fills → **fail**.

---

## 3. Playfield & Objects

### 3.1 Screen layout (portrait, 390×844 design space)

```
┌────────────────────────────┐
│ HUD: [Lv 4] SHINE ▓▓▓░ 62% │  ← level chip, progress, restart, mute
│  ┌──────  belt loop ─────┐ │
│  │  ┌──────────────────┐ │ │
│  │  │   RUSTY  PLATE   │ │ │  ← artwork under rust crust
│  │  │    (artwork)     │ │ │
│  │  └──────────────────┘ │ │
│  └────────▲ gate ────────┘ │  ← guns enter/exit belt here
│   [·] [·] [·] [·] [·]      │  ← 5 hold slots
│   ┌──┐  ┌──┐  ┌──┐  ┌──┐   │
│   │G7│  │B12│ │G9│  │Y6│   │  ← lanes (2–5), front gun tappable
│   │Y4│  │G5│  │B8│  │B7│   │     capacity badge on every gun
│   └──┘  └──┘  └──┘  └──┘   │
└────────────────────────────┘
```

### 3.2 Plate & artwork
- Hidden logical grid: **13×17 cells** (L1 tutorial: 11×14). Grid size is constant — difficulty never comes from a bigger image or more work.
- Every cell belongs to one **color region** (background is a region too — the whole plate is rusted and the whole plate gets cleaned).
- Each cell has two visual states: **RUSTED** (dirty, oxidized version of its true color under a grunge crust) and **CLEAN** (vibrant true color with a subtle metallic sheen).
- **Critical art rule:** the image must read as one continuous painting, never as tiles. Region edges are smoothed (marching-squares outline with corner rounding / Chaikin smoothing); the rust crust is a single continuous layer with noise, streaks and eroded cutout edges around cleaned areas; a slight emboss shadow where crust meets clean metal sells the crust thickness.

### 3.3 Laser guns
- Attributes: **color** (a true palette color — gun body accents, emissive core and beam all use the *clean* color, never the rusty version) and **capacity** (number of cells it can clean, shown as a badge, ticking down live).
- States: `IN_LANE` (only the front gun is tappable) → `ON_BELT` → `IN_SLOT` → `DESPAWNED`.
- Visual: chunky rounded emitter, gunmetal 2-tone body, color-emissive tip and stripe, soft drop shadow, springy pop animations.

### 3.4 Conveyor belt
- Rounded-rect loop around the plate; constant speed; **lap time ≈ 10 s**; single direction (clockwise); entry/exit **gate** at bottom center.
- **Belt capacity: 5 guns.** Same speed for all → no overtaking. Guns enter at the gate with minimum spacing (brief queued entry if the gate is momentarily blocked).
- Track visual: dark groove with slowly moving chevron dashes; guns ride small sleds.

### 3.5 Lanes (queues)
- **2–5 vertical lanes** per level. Each lane is a fixed, fully visible ordered stack (front gun raised and lit; the rest dimmed, receding; `+n` badge if more than 4 are hidden). Capacities always visible — planning info is public.
- Tapping the front gun deploys it to the belt. If the belt is full (5/5), the tap is **denied**: gun shake + soft buzz.

### 3.6 Hold slots
- **5 slots** between belt and lanes. Occupied by guns that finish a lap idle with ammo remaining (see 4.3).
- Tap a slotted gun → redeploys to the belt (if belt < 5, otherwise denied feedback).
- Pressure feedback: at **4/5** occupied, slots pulse amber with a warning tick; at **5/5**, instant fail.

---

## 4. Rules

### 4.1 Exposure — outside-in peeling (core puzzle driver)
A rusted cell is **EXPOSED** if and only if it is 4-adjacent to the plate border **or** to an already-cleaned cell. Only exposed cells can be lasered. Interior colors therefore stay locked until their surroundings are cleaned — this is what forces holds and creates the puzzle.

### 4.2 Targeting & firing
- A gun on the belt continuously targets the **nearest exposed cell of its color** (distance from muzzle; ties broken by lowest row, then lowest column). It retargets instantly as cells clear and as it moves.
- **Burn time: 0.10 s per cell** (tunable 0.08–0.15). While consecutive targets exist the beam never turns off → a continuous sweeping laser, not projectiles.
- Each cleaned cell: capacity −1. At capacity 0 the gun **despawns immediately** (fly-off + poof), freeing belt space.
- No exposed target of its color → beam off, gun keeps riding.

### 4.3 Lap & slot rule
When a gun crosses the gate having completed ≥ 1 full lap:
- **Currently firing** (live target) → it continues for another lap.
- **Idle with ammo > 0** → it exits to the leftmost free hold slot (0.35 s arc flight).

### 4.4 Win / Fail
- **Win:** all cells cleaned → 1.2 s restore sequence (remaining ash blows off, full-plate gloss sweep, spark confetti, image scales to 1.03 with a glow frame) → *Level Complete* panel → Continue (linear progression).
- **Fail:** the moment the **5th hold slot** is occupied → red flash, "SLOTS FULL!", Retry panel. This is the only fail condition.

### 4.5 Economy & solvability
- Per color: **Σ gun capacities = rust cell count of that color** (exact) — every gun matters and no gun is dead weight. Easy levels may add ≤ +10% surplus on one or two colors for forgiveness; a surplus gun whose color is fully cleaned auto-despawns contentedly.
- Every level ships with a **dev-only solver pass** (greedy + short lookahead simulation) asserting: solvable, and peak simultaneous slot usage ≤ the level's target (see §5). Prototype includes the solver behind a debug flag.

---

## 5. Difficulty Design

Difficulty **never** comes from bigger images or more cells. Knobs, in escalating order:

1. **Lane order vs. exposure order** — front guns whose colors sit in the image interior force early holds.
2. **Capacity fragmentation** — a color split across many small guns → repeated deploys and belt traffic.
3. **Partial-clean guns** — capacity larger than the currently exposed cells of its color → cleans some, parks in a slot with a remainder, must be redeployed later (slot occupancy over time).
4. **Lock chains** — color A ringed by B ringed by C: strict ordering across three lanes.
5. **Lane count & interleaving** — more lanes = more simultaneous decisions.

**Target peak slot pressure (with optimal play):** Tutorial 0–1 · Easy 1–2 · Medium 2–3 · Hard 4 · Very Hard 4 with essentially one safe ordering (any greedy mistake spikes to 5 = fail).

---

## 6. Level Plan (10 levels, linear)

Industrial/workshop subject set; the rusty-plate fantasy stays coherent across the run.

| # | Subject | Colors | Lanes | ~Guns | Difficulty | Main pressure technique |
|---|---------------------|--------|-------|-------|------------|-------------------------|
| 1 | Thunder Bolt | 2 | 2 | 6–8 | Tutorial | Guided taps; colors exposed in queue order |
| 2 | Monkey Wrench | 3 | 3 | 10–12 | Easy | One interior accent color, single hold |
| 3 | Gear | 3 | 3 | 12–14 | Easy | Hub color locked behind teeth ring |
| 4 | Power Cell (battery)| 4 | 4 | 14–16 | Medium | Bolt icon buried inside body; fragmentation |
| 5 | Skull | 4 | 4 | 16–20 | Hard | Eyes/nose double-locked; partial-clean bone guns |
| 6 | Anchor | 3 | 3 | 12–14 | Easy | Breather; light interleaving |
| 7 | Padlock | 3 | 3 | 12–14 | Easy | Keyhole tease (small interior region) |
| 8 | Robot Head | 4 | 4 | 16–18 | Medium | Eyes + mouth chain across lanes |
| 9 | Rocket | 5 | 5 | 18–20 | Medium | Window & flame interleave, 5-lane traffic |
| 10| Flaming Skull | 5 | 5 | 20–24 | Very hard | Triple lock chain + partial-clean guns + fragmentation |

Each level opens with an intro card (level number + subject name) over the already-visible rusted plate. Per-level palettes are defined in build data as named true colors; see §7 for the rust derivation rule.

---

## 7. Art Direction (benchmark: Pixel Flow)

**Overall mood:** soft, premium hyper-casual. Deep cool gradient background (indigo → dark teal), gentle vignette, slow-drifting dust motes. One warm implied key light: long soft shadows under the plate, guns and UI cards. Everything eased (cubic in/out); nothing linear except belt travel; 60 fps.

**Plate & rust:** brushed-steel frame with rounded corners and cosmetic corner bolts. Rust crust is layered procedural grunge — umber base, orange-oxide speckle, vertical drip streaks — through which each region's *rusted color* tints. Rust derivation rule per color: `rust = darken(desaturate(mix(true, #6B4A2F, 55%), 40%), 25%)` + shared grunge overlay, so every rusty tone reads as "the dirty version of what's underneath".

**Cleaning feedback (per cell):** laser impact flare → white-hot flash → rust dissolves radially (0.08–0.15 s) → vibrant color pops with a 0.2 s shine sweep → ember sparks + a thin smoke curl. Region fully cleaned → one-shot outline glow pulse.

**Beam:** layered strokes — 2 px white-hot core, 8–14 px colored bloom at low alpha (additive), subtle shimmer/sway noise; radial-gradient impact flare; spark particles with gravity; micro smoke puffs.

**Guns & UI:** chunky rounded shapes, 2-tone gunmetal + color emissive; springy scale pops (0 → 1.08 → 1, ~180 ms, cubic-out) on deploy/slot/despawn; lane cards and slots with soft inner shadows; capacity badges with a tick-down bounce.

**Win moment:** rust ash particle blow-off across the plate, full-image gloss sweep, spark confetti, restored painting held for a beat before the panel.

**No external assets:** all art (image regions, rust, metal, particles, UI) is generated procedurally in code; artwork is authored as color-region maps rendered with edge smoothing.

---

## 8. Audio (WebAudio, fully synthesized)

| Event | Sound |
|---|---|
| Beam active | Filtered sawtooth hum + subtle vibrato; slight pitch offset per color; ducks when idle |
| Cell cleaned | Short band-passed noise sizzle + tiny pitch-down blip (rate-limited to avoid machine-gun stacking) |
| Deploy / redeploy | Soft pop + whoosh |
| Gun despawn (empty) | Bright poof + rising chirp |
| Enter slot | Muted thunk |
| Denied tap | Low buzz |
| 4/5 slots warning | Slow amber pulse tick |
| Win | Major-pentatonic arpeggio + shimmer |
| Fail | Sub thud + power-down sweep |

Master mute toggle in HUD; audio context unlocked on first user tap.

---

## 9. UI / UX

- **HUD (top):** level chip, restoration progress bar ("SHINE 62%"), restart, mute.
- **Flow:** intro card → play → Win (Continue) / Fail (Retry). Strictly linear; progress held in memory for the prototype (no persistence).
- **Tutorial (L1):** three staged hints with dim overlay + hand pointer: (1) "Tap the yellow laser!" → watch it clean; (2) "Inner colors unlock when the outside is clean"; (3) "Extra guns park in slots — never fill all 5!" No text walls; each hint clears on the required action.
- **One-touch game:** tap only (lanes front gun, slotted guns, UI buttons). No drag, no aiming.

---

## 10. Tech Spec (prototype)

- **One `index.html`**, zero external dependencies. Canvas 2D, `devicePixelRatio`-aware; 390×844 portrait design space, letterboxed scaling to any viewport.
- **Input:** pointer events (touch + mouse unified).
- **Loop:** `requestAnimationFrame`, dt-clamped update; particle pooling (caps ≈ sparks 300, smoke 80, ash 200).
- **Rendering perf:** rust grunge and clean artwork pre-rendered to offscreen canvases; cleaning cuts eroded holes in the crust layer's mask; beam/particles drawn additively on top.
- **Level data format:** `{ name, palette: [{true, rust}], grid: ASCII rows (char → color index), lanes: [[{color, cap}, …], …], surplus }`.
- **Dev solver:** headless greedy(+lookahead) simulation behind a debug flag to verify solvability and peak-slot metrics during tuning.

### Tunables (defaults)

| Parameter | Default |
|---|---|
| Grid | 13×17 (L1: 11×14) |
| Lap time | 10 s |
| Burn time per cell | 0.10 s |
| Belt capacity | 5 |
| Hold slots | 5 (warn at 4) |
| Deploy/slot flight | 0.35 s |
| Despawn animation | 0.4 s |
| Capacity range | 6–30 |

---

## 11. Prototype Acceptance Criteria

1. All 10 levels playable end-to-end, linear, each verified solvable by the dev solver at its target slot pressure.
2. Stable 60 fps on a mid-range phone during heaviest beam + particle load.
3. The artwork reads as a continuous image at all times (no visible grid), and the rust→clean reveal is the visual highlight.
4. Tutorial completable without prior explanation; fail state clearly attributable to slot overflow.
5. Full audio set synthesized in WebAudio with mute toggle.

## 12. Out of Scope (prototype)

Meta/economy, boosters/power-ups, extra mechanics (layered rust, obstacles, jokers), ads/IAP hooks, external audio/image assets, localization (EN only), persistence/save system, level select screen.
