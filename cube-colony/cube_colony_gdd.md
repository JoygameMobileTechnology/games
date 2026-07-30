# Cube Colony! — Game Design Document

**Working title:** Cube Colony! (alternates: Swarm Sculpt, Ant Land 3D, Colony Blast 3D)
**Version:** 0.1 (concept GDD) · **Date:** July 2026
**Genre:** Hybrid-casual puzzle — slot-management "blast" family (This Is Blast lineage)
**Platform:** iOS / Android, phones first · **Orientation:** Portrait, fully 3D
**Session target:** 60–150 s per level, 8–12 min per session
**Audience:** Casual puzzle players 25–45, skewing toward relaxing/de-stress players; direct overlap with Colony Flow!, Cube Land Puzzle, This Is Blast!, Hexa Sort audiences

---

## 1. High concept

A living ant colony dismantles beautiful 3D voxel sculptures. Tap ant boxes into a limited row of slots at the base of a rotatable voxel model; the ants stream out, climb the sculpture's surface, pry off cubes that match their color, and carry them down into the single colony hole beneath the pedestal. Rotate the model to discover which colors are exposed before you commit a box. Clear every cube to finish the level.

One sentence: **This Is Blast, but your ammunition is alive, and your target is a 3D sculpture you have to walk around.**

The merge, precisely:

| Inherited from Colony Flow! | Inherited from Cube Land Puzzle | New to Cube Colony! |
|---|---|---|
| Ant boxes tapped into limited slots | Rotatable 3D voxel model as the target | Ants path on the 3D surface itself |
| Living swarm, travel-time rhythm | Exposure puzzle: only surface cubes are takeable | Waiting boxes resume automatically when their color is re-exposed |
| Cozy, no-timer positioning | Rotation-to-inspect loop | Single colony hole as universal delivery point and progress meter |
| Daily-streak live ops | Fair, skill-solvable difficulty | Museum meta: dismantled sculptures rebuilt underground |

**The hole (locked decision):** there is exactly one hole, centered in the pedestal beneath the model. It accepts every color. The color-matching constraint lives entirely in *harvesting* (which cubes an ant may pry), never in *delivery*. This keeps the base of the screen clean in portrait and makes the hole double as the level-progress meter.

---

## 2. Design pillars

1. **Alive.** The board is never static. Ants stream, climb, carry, and celebrate. Even while the player thinks, the colony works. Every system decision is tested against "does this make the colony feel more alive?"
2. **Fair.** Every level is beatable without boosters, verified by an automated solver before ship. Boosters buy comfort and speed, never possibility. (This is Cube Land's most-praised trait and Colony Flow's most-complained-about failure — we copy the former.)
3. **Readable 3D.** Rotation is a pleasure, not a chore. The player can always answer "what can I take right now?" within two seconds of looking. Information design (glow, silhouette arrows, color chips) does the heavy lifting.
4. **Calm.** No timers, no lives, no mid-level ads, no urgency audio. Failure is soft and retry is instant. The game is a fidget and a reward, not a stressor.

---

## 3. Core gameplay

### 3.1 The stage (portrait layout, top to bottom)

- **Top bar (~8% of screen):** level number, coin balance, settings, and the **color census** — one chip per color showing total cubes remaining of that color in the whole model (strategic info is public; tactical exposure info is not — see 3.6).
- **3D stage (~55%):** the voxel model standing on a circular pedestal. The colony hole is a dark opening at the pedestal's center front. The model floats slightly above the pedestal on a thin column so ants visibly climb up onto it. Free horizontal rotation, limited pitch, light zoom.
- **Slot rail (~12%):** four slots (default) in a row. Slotted ant boxes sit here with their color and remaining-ant badge.
- **Supply yard (~20%):** the pool of upcoming ant boxes. Early levels: a simple visible queue. From mid-game: a 3D stacked yard where only uncovered front boxes are tappable (a second ordering layer, matching the genre convention).
- **Booster dock (~5%):** three booster buttons on the right edge, thumb-reachable.

Everything tappable lives in the lower half; the game is fully one-hand playable.

### 3.2 Core loop (moment to moment)

1. **Inspect.** Swipe to rotate the model. Spot which colors have exposed cubes, and roughly how many.
2. **Commit.** Tap an available ant box in the yard. It hops into the first free slot.
3. **Work.** Ants stream out of the box one by one, climb onto the model, pry matching exposed cubes, and carry them down into the hole. Multiple slotted boxes work in parallel.
4. **Manage.** While ants travel, plan the next commit. Removing cubes exposes buried colors, which can wake a waiting box (3.4) — the central "aha" of the game.
5. **Resolve.** A box whose ants are all spent folds up and frees its slot. Clear every cube to win. Jam every slot with boxes that can't work to fail (soft, with rescue — see 3.8).

The loop's rhythm is Colony Flow's: commit is instant, consequence unfolds over seconds of ant travel, and the player's eyes bounce between the swarm at work and the yard where the next decision waits.

### 3.3 Ant boxes and slots

An **ant box** has two visible properties: a **color** and a **capacity badge** (number of ants inside — tiers of 6 / 8 / 10 / 12, mirroring genre ammo tiers). Each ant makes exactly one delivery: emerge, pry one matching cube, carry it to the hole, and dive in with it. One ant = one cube keeps the math legible at a glance: a "10" box removes exactly ten cubes of its color.

Box states:

| State | Meaning | Visual |
|---|---|---|
| **In yard** | Available (or blocked behind other boxes in stacked yards) | Idle box; dimmed if covered |
| **Working** | Slotted, matching exposed cubes exist, ants streaming | Lid open, ants flowing, badge counting down |
| **Waiting** | Slotted, ants remain, but **no exposed cube matches** | Lid half-closed, ants peeking out, gentle "zzz" pulse |
| **Spent** | All ants delivered | Box folds flat and pops away; slot frees |

**Waiting is the heart of the puzzle.** A waiting box occupies its slot until its color is exposed again — then its ants resume *automatically*, with a small fanfare. The player is never punished twice: uncovering the right color instantly converts a liability back into progress. The fail state exists only when all four slots hold waiting boxes and no yard commit can change that.

**Slots:** four by default. A fifth slot can be added per level via rescue (3.8), rewarded ad, or booster. Slot count is a difficulty knob (a rare three-slot gimmick level is allowed; never fewer).

### 3.4 The supply yard

Levels 1–11 use an open queue: all upcoming boxes visible in order, front box tappable. From level 12, the **stacked yard** unlocks: boxes arrive arranged in a small 3D pile (2–3 rows), and only fully uncovered boxes are tappable. Taking a front box uncovers those behind it. This adds the genre's second ordering layer (which box do I *unlock* by spending this one?) and is itself a difficulty knob (yard depth, color interleaving).

The yard never hides information: covered boxes are visible (dimmed) so players can plan, they just can't be taken out of order.

### 3.5 Harvest rules — what can an ant take?

A cube is **exposed** if at least one of its six faces is open to air. Ants may pry **any exposed cube of their color, anywhere on the model — including the far side the camera can't currently see.** They will happily march around the back.

This is the single most important design decision in the hybrid, so the rationale is documented:

- **Rotation gates information, not access.** In Cube Land, shots come from the camera, so rotation gates access. Here, ants are autonomous agents crawling the whole surface — having them refuse cubes "behind" the model would feel arbitrary and would create fail states caused by camera position, which is hostile in a calm game.
- The inspection loop survives fully intact, because **committing a box blind is the risk**: if you haven't rotated to check whether orange is exposed, you may slot an orange box straight into a waiting state. Knowledge is the resource rotation buys.
- It creates the hybrid's signature delight: ants disappearing around the silhouette to harvest cubes you can't see, then reappearing with cargo.
- A **"Shadow Colony" variant rule** (ants only harvest the camera-facing hemisphere) is reserved as a late-game special level type or hard mode, not core.

**Targeting order:** within a working box, ants target the *nearest* exposed matching cube by surface distance (with slight randomization for organic spread). Players never aim; there is no benefit to camera position beyond information.

**Structural rules:** voxel models have no gravity — the sculpture holds its shape as it's eaten away, exactly as in Cube Land (floating remnants are fine and are themselves puzzle content). One exception: **stone cubes** (4.1) crumble automatically into the hole when their last neighbor is removed.

### 3.6 Rotation, camera, and information design

- **Rotation:** one-finger horizontal drag = free yaw with inertia (no snapping). Vertical drag = pitch, clamped to ±25°. Pinch = zoom within tight bounds. Double-tap = reset to default framing. Input on the stage only; yard and slots ignore drags.
- **No auto-rotate by default** (it fights planning). An optional slow idle-spin toggle lives in settings for players who like it.
- **Scent highlight:** when a box is slotted, all currently exposed cubes of its color get a soft pulsing glow, and if any sit on the hidden side, small **silhouette arrows** appear at the model's edge pointing "around back." The player always knows *that* work exists, even when they can't see it.
- **Color census** (top bar) shows total remaining cubes per color — strategic totals are public knowledge. What it deliberately does *not* show is how many of those are currently exposed; that is what rotation and memory are for. This split (public totals, private exposure) is the information budget that keeps 3D from feeling unfair while keeping inspection meaningful.
- **Dig-site preview:** holding a finger on any yard box glows that color's exposed cubes for as long as the hold lasts — a free "should I commit this?" check that teaches the inspection habit.

### 3.7 The hole and delivery

The hole is the level's heartbeat. Ants carrying cubes converge on it from all over the pedestal, forming little marching lanes. Each delivery plays a soft musical "plink" that walks up a pentatonic ladder as delivery streaks build, so a busy colony literally makes music. A slim progress ring around the hole fills as cubes are banked; milestone pulses at 25 / 50 / 75%. On level completion the last ant does a tiny bow at the rim before diving in.

### 3.8 Win, fail, and rescue

- **Win:** model fully cleared → the hole erupts in a short confetti-of-crumbs celebration → results screen (coins earned, par comparison, museum banking of the sculpture).
- **Jam (soft fail):** all slots hold waiting boxes and no legal yard commit exists that could change exposure. The game detects this state instantly and offers **Colony Rescue**: open a fifth slot (rewarded ad or coins) or use a Recall booster. Declining → level failed → **instant free retry**, unlimited. No lives system, ever.
- **Out-of-ants fail:** if the yard and slots are empty but cubes remain (loadouts are solver-tuned so this only happens after inefficient play on skull levels), same rescue offer, plus a small wild-ant top-up option.

### 3.9 Ant simulation and feel

- **Stream cadence:** a working box emits an ant every ~0.35 s, up to 5 ants from that box on the surface at once. With four working boxes, up to ~20 ants animate simultaneously (hard cap for performance; queued ants wait invisibly inside the box).
- **Pacing math:** target ~0.7–1.0 s of visible travel per cube on small models. Ant move speed scales with the model's bounding size so time-per-cube stays roughly constant as sculptures grow — big models feel epic, not slow.
- **March! button:** a free, always-available toggle that doubles all ant speed (and pitch-shifts the plinks up). Impatience is a settings choice, never a purchase.
- **Swarm charm:** ants leave brief fading pheromone dotted-trails; nearby ants offset into lanes rather than overlapping; idle waiting ants groom antennae; occasional "hat ant" (cosmetic-equipped) walks through. Pry animation: 0.3 s wiggle, pop, cube rides on the ant's back slightly oversized for readability.
- **Haptics:** light tick on pry, soft thud on delivery, success pattern on box-spent.

---

## 4. Level design

### 4.1 Special cubes and obstacles

Introduced one at a time, each with a discovery level that showcases it gently before it appears in challenges.

| Special | Rule | Puzzle role | Intro level |
|---|---|---|---|
| **Dirt cube** | Color hidden under a crust; revealed when any adjacent cube is removed | Rewards inspection and memory; deepens the information game | ~15 |
| **Bomb cube** | When harvested, clears a 3×3×1 shell around it (cubes fly into the hole) | Delight, cascade exposure, tempo spike | ~20 |
| **Ice cube** | Needs two ant visits: first cracks, second carries | Doubles effective cost of a color; strains capacity math | ~25 |
| **Vined cube** | Locked until its marked anchor cube is removed | Forces explicit ordering chains across the model | ~35 |
| **Stone cube** (neutral gray) | No color; cannot be harvested; auto-crumbles when its last neighbor is removed | Structural walls that shape excavation routes | ~45 |
| **Golden cube** | Any-color harvest; drops bonus coins | Economy treat; nudges exploration to the far side | ~30 |
| **Prism cube** | Matches every color (wild target) | Relief valve the level designer places deliberately | ~55 |

All specials are surface-readable (distinct materials and silhouettes, not just tints) and each has a colorblind-safe glyph.

### 4.2 Difficulty knobs

Level difficulty is composed from independent dials, so the curve can be tuned without redrawing art:

1. **Burial depth** — how deep each color's cubes sit under other colors (drives exposure planning).
2. **Color count** — 3 at tutorial, up to 7 late-game.
3. **Loadout slack** — total ants per color minus cubes of that color (0 slack = every ant matters; positive slack = comfort).
4. **Yard order tension** — how adversarially box order interleaves against the model's layering.
5. **Yard occlusion** — stacked-yard depth and covering pattern.
6. **Slot pressure** — how many colors are "live" simultaneously versus slots available.
7. **Special density** — count and combination of 4.1 specials.
8. **Model scale** — 80-cube tutorials to 2,000-cube landmark builds.

### 4.3 Level types and curve

- **Levels 1–5 (tutorial):** 80–150 cubes, 2–3 colors, open queue, generous slack. Level 3 is the **rotation lesson**: a model whose third color exists only on the back face, guaranteeing a first "turn it around → discovery" moment.
- **Standard levels:** the 60–150 s bread and butter; difficulty follows a sawtooth (build 4–5 easy-to-medium, spike, relax).
- **Skull / Super Skull levels:** every ~7th and ~20th; near-zero slack, deep burials, hostile yard order. Clearly badged. (Naming nods to Cube Land's "Super Hard" levels, its community's favorite challenge tier.)
- **Wonder levels (every 25):** landmark sculptures (lighthouse, carousel, dragon) at 1,000–2,000 cubes with a mid-level checkpoint and a **matryoshka reveal** — clearing the outer shell exposes a second, smaller sculpture inside with its own mini-loadout. Double payoff, screenshot bait.
- **Chapters ("Colony Worlds"):** 40-level themed sets — Garden, Picnic, Toyland, Ocean, City, Holiday rotations — theming both the sculptures and the ambient pedestal/skybox.

### 4.4 Fairness and the solver (pillar 2, enforced)

Every level ships with a machine-verified solution:

- A search-based solver plays each level under core rules (no boosters) and must find a clearing order. Unsolvable or solver-timeout levels cannot enter the build.
- The solver also emits **par boxes** (minimum commits needed) and a difficulty score (forced-move count, minimum slack encountered, jam-proximity). Scores map to the intended curve; outliers are auto-flagged.
- Regression: any model or loadout edit re-triggers verification in CI.

This directly answers the sub-genre's loudest complaints — Colony Flow's "levels that cannot be beat without boosters" reviews versus Cube Land's "every level is possible" praise. Fairness is our review-score moat.

### 4.5 Content pipeline

- Sculptures authored in **MagicaVoxel** (.vox), imported with automatic palette quantization to the level's color count.
- Auto-generation pass proposes loadout + yard order to hit a target difficulty score; designers hand-adjust; solver verifies.
- Throughput target: **40 shippable levels/week** from one designer + pipeline once tooling matures. Launch with 300; Cube Land's content starvation (players finishing all levels and being looped back to level 1) is the cautionary tale — we also ship **level select and replay from day one**.

---

## 5. Game feel, art, and audio

- **Art direction:** warm, sunlit diorama. Chunky voxels with soft ambient occlusion and the subtle per-cube edge lighting players specifically praised in Cube Land ("the subtle lighting on the little cubes as you rotate the model really makes them feel solid"). Ants are big-headed, glossy, two-frame-personality creatures — closer to a Pixar prop than a realistic insect. Absolutely no photoreal insects (a real segment of the casual audience is insect-averse; our ants must read as mascots).
- **The pedestal is a stage:** rotating dioramas per world (picnic blanket, tide pool, toy shelf) that never occlude the model.
- **Audio:** lo-fi/acoustic loop per world at low intensity; pry "pop," delivery "plink" pentatonic ladder; colony murmur that swells with active ant count; win jingle under 3 s. No urgency stingers anywhere — pillar 4.
- **Reveal fantasy:** as the model is eaten, a short outro shows the ants "rebuilding" it in the underground museum — the lore is that the colony archives beautiful things, which reframes destruction as collection.

---

## 6. Meta and progression

- **Level map:** linear path through Colony Worlds with chapter-end chest. Level select unlocked for all beaten levels from day one; beaten levels replayable for badges.
- **Badges per level:** *Cleared*, *Under Par* (≤ par boxes), *No-Jam* (never entered a jam state). Badges feed world completion meters and cosmetic unlocks — this is the skill-expression layer for the "I never spent a dollar, skill issue" player Cube Land's reviews revealed.
- **The Museum (retention centerpiece):** every completed sculpture is rebuilt on a shelf in the underground colony museum — a fully 3D, rotatable gallery. Tapping a piece replays a 5 s time-lapse of its dismantling. Share button renders a turntable clip. The museum turns a disposable level into a permanent collection and is the emotional answer to "why keep playing."
- **Cosmetics:** ant hats and skins, trail styles, hole/pedestal themes, delivery-plink instrument packs. Cosmetic-only — zero gameplay power (protects pillar 2 and the solver's guarantees). Earned via badges, streaks, and the Colony Pass.
- **Daily streak — "Picnic Days":** log-in streak with escalating crumbs (coins, wild-ant boxes, cosmetics), modeled on Colony Flow's live "Sweet Meal" event pattern.
- **Events:** rotating 2-week themed packs (10–15 exclusive sculptures + a cosmetic set); async **Par Race** leaderboards ranked on total boxes-under-par across the pack — a skill leaderboard that respects the no-timer pillar (never speed-based).
- **Colony Pass:** per-world cosmetic-forward pass (free + premium track), 3–4 week cadence.

---

## 7. Monetization and ads

Philosophy: monetize **comfort, pace, and identity — never possibility.** Every level is beatable free (4.4); the store sells convenience and cosmetics.

**Ads (the Colony Flow correction):**
- Interstitials only after every **2nd–3rd** completed level, never after a failed level, never mid-level. (Colony Flow's "ad between every round, even after we beat a level" reviews and Cube Land's "ads mid-level would be an instant uninstall" line define the red lines.)
- Rewarded placements: +1 slot at jam, double end-of-level coins, yard shuffle (re-deals yard order once), daily gift, wild-ant top-up at out-of-ants.
- **Remove Ads — $5.99** (kills interstitials only; rewarded stays). Expected top SKU.

**Soft currency:** coins from wins (40–80 per standard level, scaling), streaks, badges, and golden cubes. Booster prices tuned so an active free player affords ~1 booster/day — deliberately inverting Colony Flow's resented 1,200-coin booster vs ~20-coin level payout ratio.

**Boosters (in-level):**

| Booster | Effect | Notes |
|---|---|---|
| **Recall** | Return one slotted box to the yard front, unspent ants intact | The jam-breaker; most-used |
| **Fifth Slot** | Adds a slot for the rest of the level | Also the rewarded-rescue item |
| **Wild Box** | Slots a 6-ant box that harvests any color | Small, safe relief valve |
| **Drill** | Player taps any single cube; a drone beetle removes it regardless of color/exposure | Surgical unblocker; the one aimed action in the game, a deliberate Cube Land homage |

**IAP structure:** coin packs, booster bundles, starter pack ($2.99, one-time), piggy bank, Remove Ads, Colony Pass premium ($4.99/world), cosmetic packs. No energy, no lives, no gacha.

---

## 8. UX, controls, and accessibility

- **One-hand portrait play:** all commits, boosters, and yard taps in the lower 50%; rotation works anywhere on the stage. Minimum touch target 64 px.
- **FTUE:** zero text walls; the first three levels teach commit → parallel boxes → rotation purely through staged situations. First jam is scripted at level 6 with a free guided Recall so the rescue flow is learned before it costs anything.
- **Interrupt-safe:** app suspend mid-level freezes the sim perfectly; levels are deterministic given the commit log, so state restore is exact. Full offline play (both parent games ship this and their audiences expect it).
- **Colorblind support:** optional glyph overlay stamps a small symbol on every cube face and matching box lids (7 distinct glyphs); specials already carry unique silhouettes. Palettes verified for deuteranopia/protanopia/tritanopia contrast.
- **Comfort settings:** March! speed toggle, reduced-motion mode (no camera inertia, calmer particles), haptics off, idle-spin on/off, left-hand booster dock mirror.
- **Localization at launch:** EN, ES, PT-BR, FR, DE, JA, KO, ZH-Hans (matching the parents' 8-language footprint).

---

## 9. Technical design

- **Engine:** Unity (URP), portrait 1080×2340 reference, 60 fps target on mid-tier devices (iPhone 12 / Pixel 6 class), auto 30 fps battery mode.
- **Voxel rendering:** chunked greedy meshing with per-cube removal patches; removing a cube re-meshes only its chunk (≤16³). Per-cube AO baked per chunk; edge-lighting via a cheap bevel normal trick rather than geometry.
- **Model budget:** ≤2,048 visible cubes standard, ≤4,096 for Wonder levels; texture atlas per world.
- **Ant simulation:** ants are GPU-instanced skinned imposters at distance, full skinned meshes only for the nearest ~8. Hard cap of 20 surface ants + 10 pedestal-lane ants.
- **Pathing:** precomputed surface-face adjacency graph; A* per ant on assignment; cube removal patches the graph locally (O(neighbors)). Lane offsets are visual jitter, not physics — no physics engine in the core sim.
- **Determinism:** the level sim is a fixed-step deterministic core (needed for the solver, replays, museum time-lapses, and interrupt restore — one system, four features).
- **Download size target:** <200 MB initial (both parents ship 300–400 MB; leaner install is a conversion edge), worlds streamed on demand.
- **Analytics events:** commit, wait-enter/exit, jam, rescue-shown/taken, rotation seconds per level, par delta, booster use, ad points — enough to tune the information-design pillar with data (e.g., if rotation-seconds ≈ 0 on failed levels, the scent-highlight teaching failed).

---

## 10. Live ops and content cadence

- **Launch:** 300 solver-verified levels across 7 worlds + museum + Picnic Days streak.
- **Cadence:** +40 levels/week (pipeline target), one event pack per 2 weeks, Colony Pass per world (~monthly), seasonal reskins (holiday sculptures) on the standard casual calendar.
- **The Cube Land lesson, institutionalized:** a "runway dashboard" tracks the top 1% player's remaining-content days; if runway <14 days, level production escalates. Nobody ever gets looped back to level 1.

---

## 11. KPIs and targets (soft-launch gates)

| Metric | Gate | Rationale |
|---|---|---|
| D1 / D7 / D30 retention | 45% / 18% / 8% | Genre-competitive for This Is Blast family |
| Median level length | 60–150 s | Session rhythm |
| Fail-rate curve | 3–8% standard, 20–30% skulls, <40% anywhere | Fairness pillar with teeth |
| Rescue-take rate at jam | >35% | Rewarded economy health |
| Rotation engagement | >70% of levels include a rotation ≥90° | Verifies the 3D layer is played, not ignored |
| Museum visit rate | >25% of D7 players weekly | Meta hook validation |
| ARPDAU (blended) | $0.10–0.15 at soft launch | Hybrid-casual baseline |

---

## 12. Risks and mitigations

1. **3D readability in portrait** (the existential risk). Mitigations: scent highlight + silhouette arrows + color census + dig-site preview; analytics gate (rotation engagement KPI); art rule that no world palette contains two adjacent-hue colors at similar value.
2. **Pacing drag on large models.** Mitigations: size-scaled ant speed, parallelism, March! toggle, Wonder-level checkpoints. Watch median level length like a hawk.
3. **Swarm performance on low-end devices.** Mitigations: instancing, ant caps, imposters, 30 fps mode; the sim is decoupled from render framerate.
4. **Player confusion: "why won't my box work?"** (waiting state). Mitigations: explicit zzz visual + a one-time tooltip the first time a wait occurs + the scent highlight showing zero glowing cubes.
5. **Solver cost on 2,000-cube levels.** Mitigations: hierarchical solving (color-layer abstraction before cube-level verify), CI budget alarms, Wonder levels hand-review-plus-solver.
6. **IP adjacency.** The slot-blast mechanic is a broad genre convention (This Is Blast and dozens of derivatives); our expression — living agents, 3D surface pathing, museum meta — is distinct. Keep naming/art clear of both parents' trade dress.

---

## 13. Competitive snapshot (verified July 2026)

| Game | Developer | Rating | Position | What we take | What we avoid |
|---|---|---|---|---|---|
| **Colony Flow!** | ABI Global Ltd. | 4.7★ (8.3K), #8 Puzzle | 2D ant/slot sorter, live ops running | Swarm charm, streak events, slot economy | Booster-walled levels, nerfed coin economy, ad-after-every-round (its dominant 1-star themes) |
| **Cube Land Puzzle** | Rotatelab | 4.7★ (10K), #22 Puzzle, v0.4.x | 3D voxel blaster, young and fast-moving | Rotation/exposure puzzle, fair difficulty, cube lighting polish | Content starvation loop-back, missing level select, clear-state parity bugs |
| **This Is Blast!** | (genre anchor) | — | Established 2D slot-blast template | Slot/ammo economy conventions players already know | — |

Positioning line: *the first fully 3D, living-swarm entry in the blast-sort genre* — Cube Land proved 3D demand at v0.4 with 10K ratings; Colony Flow proved the ant fantasy charts top-10; nobody has both.

---

## 14. Scope and roadmap

- **Prototype (4 weeks):** gray-box model, rotation, slots, ant streaming on surface graph, waiting/jam logic, solver v0. Kill/continue question: does commit → travel → wake-a-waiting-box feel great?
- **Vertical slice (+8 weeks):** 20 polished levels, 2 specials (dirt, bomb), stacked yard, FTUE, museum stub, one world's art, sound pass.
- **Soft launch (+16 weeks):** 150 levels, 4 worlds, full monetization + analytics, Picnic Days, level select, localization ×4. Gate on Section 11 KPIs.
- **Global (+8 weeks):** 300 levels, 7 worlds, Colony Pass, events, remaining localization.

Team assumption: 1 producer/designer, 2 engineers, 1 tech artist, 1 artist, part-time audio + UA.

---

## 15. Open design questions

1. Should the **color census** be always-on or unlocked at level ~10 as a "Scout Ant" reward? (Teaches its value by brief absence.)
2. **Matryoshka Wonder levels:** one loadout for both shells, or a fresh mini-loadout for the inner model? (Current spec: fresh mini-loadout.)
3. Do **bomb cubes** bank their cleared cubes as deliveries (ants cheer, cubes fly to the hole) or as vanish-only (progress but no coin credit)? Current lean: fly-to-hole, full credit — spectacle over economy nuance.
4. **Shadow Colony mode** (camera-facing-only harvesting): hard-mode toggle, special level type, or cut?
5. Working title: does **Cube Colony!** clear trademark and store-search checks against both parents, or do we lean toward Swarm Sculpt for differentiation?
