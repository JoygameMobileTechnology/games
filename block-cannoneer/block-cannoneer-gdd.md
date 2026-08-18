# Block Cannoneer — Game Design Document

**Build target:** Full playable game, built by Claude Code in one complete pass.
**Platform:** Mobile web, portrait mode. HTML + TypeScript + Three.js.
**Genre:** 3D physics destruction puzzle (single player, level-based).
**Reference game:** *Royal Smash! — Physics Puzzle* (Cypher Games). Match its core feel: over-the-cannon camera, tap-to-fire, satisfying collapses, limited shots, fail-flow that offers power to finish the level.

---

## 1. High Concept

The player is the cannoneer — there is no visible character. The camera sits directly above and behind an unseen cannon, looking out at a platform holding one or more towers built from physical blocks. The player taps anywhere on the structure to fire a projectile at that exact point. Every level is a structural puzzle: blocks have different weights and materials, and towers carry load unevenly. Find the critical, load-bearing "soft spots," and one shot can collapse an entire tower in a chain reaction. Shots are limited. Knock every block off the platform before shots run out.

The fantasy: effortless, godlike demolition. The reality: careful reading of structure. When the reality gets frustrating, monetized power-ups arrive to "save the player's ego" and let them finish the level feeling like a genius anyway.

**Design pillars:**

1. **Every shot must feel amazing.** Impact, break, tumble, fall — all four moments have distinct feedback (visual, audio, haptic).
2. **The puzzle is the structure, not the aim.** Aiming is trivial (tap = hit). Skill is *where* to hit and in what order.
3. **Losing sells power.** The fail state is engineered to feel like "I was SO close" — which is exactly when the Big Shot rewarded-ad offer appears.
4. **Toy-box beauty.** Everything looks like lacquered wooden toys on a sunny table. Confetti, sparkles, and magic dust make destruction feel celebratory, never grim.

---

## 2. Camera, Perspective & Scene

- **Camera:** Fixed per level. Positioned above and slightly behind the (invisible) cannon muzzle, tilted down ~12–18° toward the structure. The player literally looks *over* the cannon: the bottom edge of the screen is where shots originate. No cannon model is rendered — the shot is implied by a very small, brief fire wisp at the bottom-center of the screen (a few ember/smoke particles, no bright flash, no light spike) plus the projectile emerging from it.
- **Framing (portrait):** The full structure and the platform must fit inside the safe area with generous margin. Camera distance auto-computed per level from the structure's bounding box.
- **No player camera control** in v1. Optional per-level gentle idle sway (±0.5°) for life. Optional slow auto-orbit of a few degrees on some levels if it helps readability, but default is fixed.
- **The platform:** A floating pedestal/table (rounded-edge slab) in a dreamy skybox (soft gradient sky, floating clouds, god rays). Blocks that leave the platform tumble into the void below and despawn after ~2s of falling.
- **Environment:** Minimal. Pastel gradient background, soft ambient occlusion, one warm key light + cool fill. Long soft shadows for depth reading — shadows matter for judging structure.

---

## 3. Core Gameplay

### 3.1 Input

- **Tap anywhere on screen** → raycast from camera through tap point → fire a projectile from the cannon origin (bottom-center, slightly below screen) along a computed ballistic path that hits the raycast intersection point.
- Projectile flight is fast (~0.25–0.35s to impact) but visible — a stubby cannonball with a comet trail. It's an aimed *arc-less* direct shot in v1 (straight line with tiny gravity droop for flavor); the tap point is guaranteed to be the impact point if unobstructed. If another block occludes the tapped point, the shot hits the first thing on the ray — that occlusion IS part of the puzzle.
- Input is locked for ~0.3s after each shot (fire rate limiter), except during Rapid Fire (see §6).
- **No drag-aim, no power meter.** Tap = shot. This is deliberate: aiming friction is removed so all difficulty lives in structural reading.

### 3.2 Objective & Win/Lose

- **Win:** Every block is off the platform (fully clear of the platform's top surface and falling/fallen) before shots run out.
  - Detection: a block counts as "cleared" when its bounding volume no longer overlaps the platform's clear-zone volume AND its Y position is below the platform surface. Blocks resting on *other* blocks that rest on the platform are not cleared.
- **Lose:** Shots reach 0 while ≥1 block remains on the platform, and the physics world has settled (wait for settle — a last shot can still win during its chain reaction; never fail while things are moving).
- **Shot budget:** Defined per level (typically 3–8). Displayed as cannonball icons at the top of the screen that dim as spent.
- **Grace rule:** If the level ends with exactly 1–2 small blocks remaining, trigger the **Ego-Save Flow** (§7.3) instead of an immediate fail screen.

### 3.3 Star Rating

- ⭐⭐⭐ Cleared with shots to spare (≥1 unspent).
- ⭐⭐ Cleared using every shot.
- ⭐ Cleared using a power-up or purchased extra shots.
- Stars feed a lightweight meta progression (cosmetic unlocks — projectile skins, confetti colors, platform themes every N stars).

---

## 4. Physics System

This is the heart of the game. Use **Rapier (WASM, @dimforge/rapier3d-compat)** as the physics engine — it has the stable stacking and solver quality this game demands. (Fallback if Rapier integration is problematic: cannon-es, but increase solver iterations heavily and expect to hand-tune stack stability.)

### 4.1 Block Materials

Every block is a rigid body cuboid (or simple compound) with a **material profile**:

| Material | Density | Break threshold | Friction | Restitution | Visual | Role in puzzles |
|---|---|---|---|---|---|---|
| **Balsa** | 0.4 | Very low | 0.5 | 0.1 | Pale striped wood | Shatters on any decent hit; filler & fuses |
| **Pine** | 1.0 | Low | 0.6 | 0.15 | Warm wood, rounded edges | Standard block; breaks on direct hits |
| **Oak** | 1.8 | Medium | 0.7 | 0.1 | Dark wood, brass corner caps | Doesn't break easily; must be *toppled* |
| **Stone** | 3.5 | Very high | 0.8 | 0.05 | Speckled granite toy-look | Effectively unbreakable; the "load" that crushes things below |
| **Glass** | 1.2 | Minimal (any touch while stressed) | 0.3 | 0.2 | Translucent candy-glass | Shatters even from blocks falling ON it — chain-reaction fuel |
| **Rubber** | 0.9 | Unbreakable | 0.9 | 0.8 | Bright bouncy ball look | Deflects shots, bounces debris unpredictably; obstacle |
| **Iron** | 5.0 | Unbreakable | 0.6 | 0.05 | Riveted metal plate | Shields & armored caps; forces the player around it |

- **Density → mass:** mass = density × volume. This is what makes "different self weight and different weight of structure on it" real: a stone cap on pine pillars means the pillars are pre-stressed; nick one pillar and the cap's mass does the demolition for you.
- **Break threshold:** each block accumulates impulse damage. On any contact event, impulse magnitude above a small noise floor is added to the block's damage. When damage ≥ threshold, the block **breaks**: it's replaced by 4–8 pre-fractured debris chunks (convex pieces) inheriting velocity, plus particles. Debris despawns/shrinks-out after ~3s or on leaving the platform.
- **Projectile hits** apply their impulse at the exact contact point (not center of mass) — hitting the top corner of a pillar rotates it differently than hitting its base. This is the entire skill expression.

### 4.2 Structural Gameplay ("find the soft spot")

Levels are hand-designed so that structures have:

- **Load paths:** Heavy blocks (stone/iron) supported by lighter ones (pine/balsa/glass). Removing/breaking a support makes gravity do the work.
- **Keystones:** A single block whose removal collapses a large section. Marked subtly by design language (e.g., keystones are often the *odd* material in a column), never by explicit UI.
- **Overhangs & counterweights:** Structures balanced so a nudge on the correct side tips the whole assembly off the platform, while hitting the wrong side wedges it more firmly.
- **Shields:** Iron plates guarding soft spots frontally; the answer is hitting an exposed flank, shooting *through* a glass window, or toppling something onto the shield from above.
- **Fuses:** Lines of balsa/glass that transmit a collapse across the platform (dominoes).

**The intended solve of every level = fewer shots than the budget.** The budget always includes 1–2 "mistake" shots. Optimal play is discovering the collapse order, not pixel-precision.

### 4.3 Tuning & Feel Constants

Expose ALL of these in a single `tuning.ts` constants file for iteration:

- Gravity (default -14 m/s², slightly heavier than real for snappy falls)
- Projectile mass, speed, impulse multiplier
- Per-material density/threshold/friction/restitution tables
- Damage noise floor, debris chunk count, debris lifetime
- Settle detection: world considered settled when total kinetic energy < ε for 0.5s
- Physics timestep: fixed 60Hz with interpolation; cap physics bodies per level (~120 blocks + debris pool)

---

## 5. Game Feel & Presentation

**Art direction: "lacquered toy box."** Bright saturated pastels, rounded edges (beveled box geometry), soft studio lighting, subtle rim light. Everything should look like you could pick it up. No textures needed beyond simple procedural stripes/speckles + matcap-ish shading; consistency and lighting sell it.

**Hard rule — no muzzle flashes.** Firing never produces a bright flash, screen glow, or light spike at the cannon. The fire effect is a minimal wisp: 3–6 ember particles + one small smoke puff, dim and short (~0.2s), sitting at the bottom-center of the screen. Its only job is believability — "yes, that came from a cannon" — while the player's eyes stay on the structure. All fire spectacle lives at the *impact* end, not the firing end.

### 5.1 Feedback Stack (per event)

| Event | Visual | Audio | Haptic |
|---|---|---|---|
| Fire (normal shot) | Minimal fire wisp at screen bottom (a few embers + a puff of smoke, ~0.2s, small and dim — just enough to sell "a cannon fired," never a bright flash), tiny screen kick (2–3px camera nudge) | Toy "pop!" — cork-gun sound (see §5.2) | Small nudge |
| Impact on a block (any shot, break or not) | Radial dust puff, impact ring decal, brief block flash | Wooden "tok" pitched by material | Small nudge |
| Rapid Fire | Continuous small ember/smoke wisp at screen bottom while the stream is active (one persistent low-key emitter, NOT a flash per bullet) + micro screen kicks | Popcorn-style stream of tiny high pops, each pitch-jittered (§5.2) | One small nudge **per bullet, synced to each shot leaving the cannon** (~8/sec while held; if the OS throttles, coalesce into a continuous light buzz that starts/stops with the stream) |
| Big Shot — fire | Same minimal fire wisp, slightly larger with a few golden embers (still no flash — the *projectile's* golden aura carries the spectacle), stronger screen kick | Big cartoon "FWOMP" — oversized cork pop + quick pitch-drop whistle + sparkle shimmer (§5.2); never a real cannon boom | **Bigger nudge** (stronger + longer than normal fire) |
| Big Shot — impact | Shockwave ring, oversized debris + confetti | Heavy crunch + sub thump | **Bigger nudge** (strongest single haptic in the game) |
| Block breaks | Debris burst + colored splinters + a few confetti pieces + magic sparkle motes | Crunchy break sound per material (wood crack / glass shatter / stone crumble) | Medium |
| Block knocked off platform | Trail of sparkle dust as it falls; small star-pop at platform edge | Whistle-down + soft pop | **Small haptic nudge (this is the signature one — every block leaving the platform gives a tiny bump)** |
| Chain reaction (≥4 blocks in 1s) | Brief saturation boost + extra confetti density — **no slow-motion; the game never alters time speed** | Rising musical riff | Double pulse |
| Enter Rapid Fire Mode | Soft dark vignette eases in from screen edges (~0.25s), structure remains fully lit; reverses on cancel/end | Low "arming" whoosh | Light tick |
| Enter Big Shot Mode | Red tint eases into the four screen corners (~0.25s); reverses on cancel/fire | Deeper "arming" hum | Light tick |
| Level clear | Full-screen confetti cannons from both bottom corners, magic ribbon particles, "CLEAR!" bounce text | Fanfare + crowd-less cheer sparkle | Success pattern |
| Last-shot fail | Desaturate, gentle sad "wobble" on remaining blocks | Soft trombone-ish descend (kept light, not punishing) | None |

- **Haptics:** use `navigator.vibrate()` patterns (Android/Chrome). iOS Safari doesn't support vibrate — degrade silently; keep an abstraction (`haptics.ts`) so a wrapper (Capacitor) can plug in later. Define named tiers in `haptics.ts` so every gameplay event maps to one: `nudgeSmall` (fire, impact, block-off-platform, each Rapid Fire bullet), `nudgeMedium` (block break), `nudgeBig` (Big Shot fire and Big Shot impact), plus `doublePulse` (chain reaction) and `successPattern` (level clear). Tune the actual ms patterns per tier in `tuning.ts`. Anti-mush rule: when a shot fires and hits within the same ~80ms window, or many impacts stack in one frame, merge to the single strongest tier instead of queuing overlapping vibrations.
- **Audio:** Web Audio API. Pitch-randomize (±10%) every impact/break sample to avoid machine-gun repetition. Ducking: music dips 30% during chain reactions so the physics foley shines. Generate sounds procedurally with Tone.js or ship tiny synthesized samples — no licensed audio.

### 5.2 Cannon Sound Design — "Toy Cannon" Rule

**The cannon must never sound intimidating or military.** No sub-bass, no long boom, no reverb tail, no explosion. It's a toy in a toy box: think cork pop-gun, party popper, champagne cork, bubble wrap. Cheerful, dry, and short. All firing sounds are high-passed at ~150Hz so there is literally no war-cannon rumble in them; the *impacts* on the structure carry whatever weight the mix needs.

Synthesis recipes (Web Audio, all under 250ms):

- **Normal shot — "cork pop":** Layer of (a) a sine/triangle blip with a fast downward pitch envelope (~600→180Hz over ~60ms) for the hollow "pop" body, (b) a 15ms band-passed noise click for the cork "snap," and (c) a soft 80ms breathy noise "pff" for the air puff, low-passed and quiet. Randomize base pitch ±15% per shot. Total feel: a wooden pop-gun.
- **Rapid Fire — "popcorn":** The cork pop shrunk: shorter (~80ms), pitched up an octave-ish, snap layer only + tiny pff. Each bullet gets a random pitch from a small pentatonic-ish set so an 8/sec stream sounds like playful popcorn/bubble-wrap music rather than gunfire. Slight stereo jitter per pop.
- **Big Shot — "big cartoon FWOMP":** (a) an oversized cork pop pitched a fifth lower (still high-passed — big *toy*, not artillery), (b) a fast 150ms pitch-drop whistle (sine sweep ~900→300Hz, like a compressed slide-whistle) for cartoon heft, (c) a short glittery shimmer (few detuned high sines / filtered noise sparkle) selling the golden-magic aura. Reads as "comically powerful," never "dangerous."

Litmus test: if the fire sound would fit in a war movie, it's wrong; if it would fit in a Mario Party minigame, it's right.
- **Confetti & magic:** GPU particle system (instanced quads). Confetti = physicky flutter (per-particle rotation + drag). Magic motes = additive-blended soft sprites drifting upward. Budget: ≤2000 live particles.

---

## 6. Power-Ups

Two launch power-ups, matching their acquisition channel to their fantasy:

### 6.1 Rapid Fire — **IAP consumable**

- **Activation is a two-step mode, not an instant effect:**
  1. Player taps the Rapid Fire button → enters **Rapid Fire Mode**. The edges of the screen darken (soft vignette closing in from the borders, structure stays fully lit) so all focus lands on the structure. The cannon does not fire yet. Normal tap-to-shoot is suspended while in the mode.
  2. Player touches and **holds** anywhere on the structure → the stream starts, and the aim follows the finger as it moves — the player "hoses down" the structure, keeping the cannon on target by dragging.
  3. Tapping the Rapid Fire button again while in the mode **cancels it**: vignette fades out, normal play resumes, **no charge consumed** — but only if the stream never started. The charge is spent the moment the first bullet fires.
- Stream: ~8 small projectiles/sec, each at ~40% normal impulse, for a maximum of **2.5 seconds of total hold time**. A radial meter around the finger drains while held; releasing pauses the drain (still in mode, can resume holding). When the meter empties, the mode ends automatically with a small "spent" poof.
- **Does NOT consume level shots.** It's pure bonus destruction.
- Every bullet in the stream fires a small haptic nudge synced to it, so the phone physically drums in the player's hand while they hold — this is a big part of the power fantasy.
- Sold in packs (e.g., 3 / 10 / 25 uses). One activation = one consumable, spent on first bullet fired (not on entering the mode).
- Entry point: a button on the left edge of the HUD showing owned count; tapping with 0 owned opens the shop.

### 6.2 Big Shot — **Rewarded ad**

- **Same two-step mode mechanic as Rapid Fire:**
  1. Player taps the Big Shot button → enters **Big Shot Mode**. Instead of darkening, the **corners of the screen take on a red tint** (soft red gradient bleeding in from the four corners — reads as "danger/power armed" and is instantly distinguishable from Rapid Fire's dark vignette). Normal tap-to-shoot is suspended.
  2. Player taps the structure → the Big Shot fires at that point.
  3. Tapping the Big Shot button again before firing **cancels the mode**: tint fades, normal play resumes, the banked Big Shot is kept, no level shot spent.
- The projectile: massive and glowing, **~6× normal impulse plus a small AoE shockwave** (radial impulse falloff, radius ~1.5 block units). It bulldozes oak, cracks stone, and shoves entire towers.
- **Consumes 1 level shot** when fired (it replaces your shot, it doesn't cheat the count) — but its power makes that trade obviously worth it.
- Earned by watching a rewarded ad (stub the ad SDK behind an interface `ads.ts` with a fake 3-second "ad" for the web build). One Big Shot banked at a time from the HUD button; also offered contextually in the Ego-Save Flow.
- Visual: the projectile is golden with a magic aura; firing shows only the slightly-larger minimal fire wisp (no flash); impact produces an oversized confetti + shockwave ring.
- Haptics: a bigger nudge on firing AND a bigger nudge on impact — two distinct heavy pulses that make the Big Shot feel physically heavier than everything else.

### 6.3 Extra Shots — **soft currency / RW**

- +3 shots offered on the fail/ego screen: watch an ad OR spend coins. (Coins earned from level clears; small amounts, mostly a coin-sink placeholder for the economy to grow into.)

---

## 7. Monetization & Ego-Save Design

### 7.1 Philosophy

Fair puzzle, generous feel, monetize *frustration relief and power fantasy* — never sell the solution, sell the steamroller. The player who pays should feel clever and mighty, not extorted.

### 7.2 Channels

- **IAP:** Rapid Fire packs, coin packs, "Remove Ads" (removes interstitials only; rewarded ads stay, they're a feature).
- **Rewarded ads:** Big Shot, +3 shots on fail, 2× coins on clear.
- **Interstitials:** After every 3rd completed level, never after a fail (fails already show the ego-save offer — don't stack punishments).
- All payment/ad calls go through `monetization.ts` interfaces with mock implementations (browser `confirm()`-style mock for IAP, timed fake ad). Real SDKs are integration work for later.

### 7.3 The Ego-Save Flow (fail interception)

When shots hit 0 with blocks remaining (after settle):

1. Camera slowly pushes in on the surviving blocks (they wobble tauntingly).
2. Panel slides up: **"SO close! Finish the job?"** with the remaining-block count.
3. Options, in order of prominence:
   - **▶ FREE Big Shot** (rewarded ad) — primary, huge button.
   - **+3 Shots** (coins or ad).
   - **Use Rapid Fire** (if owned / buy).
   - Small "Retry level" text link at the bottom.
4. If they take any offer, gameplay resumes seamlessly (no reload) — the panel drops away and the wobbling blocks await their doom.
5. If they clear it this way: full celebration anyway (1-star), with copy like "Demolition complete!" — the game never says "you needed help."

---

## 8. Level Design & Content

### 8.1 Level Data Format

Levels are **declarative JSON** (`/levels/*.json`), hot-loadable:

```json
{
  "id": 12,
  "name": "Crown Weight",
  "shots": 4,
  "cameraHint": { "distanceScale": 1.0, "pitchDeg": 15 },
  "platform": { "size": [10, 1, 8], "theme": "meadow" },
  "blocks": [
    { "type": "box", "material": "pine", "size": [1, 3, 1], "pos": [-2, 1.5, 0], "rot": [0, 0, 0] },
    { "type": "box", "material": "pine", "size": [1, 3, 1], "pos": [2, 1.5, 0] },
    { "type": "box", "material": "stone", "size": [5, 1, 1.5], "pos": [0, 3.5, 0] }
  ],
  "tutorialText": "Heavy tops crush weak legs. Aim low."
}
```

- Author **30 launch levels** with a difficulty curve. Also build a tiny **dev level editor** (URL param `?editor`): click-to-place blocks on a grid, material palette, export JSON. Keep it crude — it's a dev tool.

### 8.2 Difficulty Curve (30 levels)

- **1–3 · Tutorial(ish):** Single towers, pine/balsa. Teach fast: tap to shoot, blocks off platform = win, low shots on legs beat high shots on bodies. Unloseable, one taught idea each, no hand-holding text beyond one line.
- **4–9 · Materials:** Introduce stone caps (crush mechanics), glass (chain fuel), oak (topple-don't-break), rubber deflectors. Roughly one new material per level, immediately combined with the previous ones. First levels where spamming center-mass fails arrive here (~level 6).
- **10–20 · Structure reading:** Keystones, counterweight tipping, occlusion shots (shooting through gaps), iron shields, fuses/domino runs, multi-tower levels where collapse order matters. Shot budgets tighten across this band (intended solve = budget − 1 by ~level 16).
- **21–30 · Full complexity:** Everything combined; big castles, tight budgets, and showpiece levels (especially 28–30) designed so a perfect keystone shot produces a spectacular near-full collapse — the "share this" levels.
- Every ~5th level is a **breather**: over-budgeted shots, huge satisfying collapse, near-guaranteed 3 stars. Pacing valve.

---

## 9. UI / UX (Portrait)

- **HUD (in level):** Top: level number, shot icons, pause. Left edge: Rapid Fire button (count badge). Right edge: Big Shot button (ad icon if unbanked). Bottom: nothing — the whole lower screen is the "cannon."
- **Screens:** Title (Play + settings gear) → Level select (simple vertical path with stars) → Game → Clear panel (stars, coins, Next / Replay / 2× coins ad) / Ego-Save panel → Shop (Rapid Fire packs, coins, Remove Ads).
- **Settings:** Sound, music, haptics toggles; restore purchases stub.
- **Juice everywhere:** buttons squash on press, panels spring in (simple tween lib or hand-rolled easing; no heavy UI framework — DOM/CSS overlay on top of the Three.js canvas is fine and crisper than in-canvas UI).
- First-time UX: no menus — boot straight into Level 1 after the title tap.

---

## 10. Technical Specification

- **Stack:** TypeScript, Three.js (WebGL), Rapier physics (WASM), Vite build. DOM/CSS for UI overlay. No React needed.
- **Target:** 60fps on mid-range phones (test proxy: throttled Chrome); **uncapped on high-end — aim for 120fps on ProMotion/120Hz devices, and higher wherever the display allows.** Never cap the frame rate artificially: drive rendering from `requestAnimationFrame` (which follows the display's refresh rate) and let it run as fast as the device offers. Physics stays fixed at 60Hz regardless, with render-side interpolation between physics states — this is what makes 120Hz actually look smoother instead of just running the sim faster. All animation, tweening, camera kick, and particle motion must be delta-time based (never per-frame increments), or 120Hz devices will play everything at double speed. Portrait; lock via CSS/orientation hint, letterbox in landscape with a "rotate your device" card.
- **Rendering:** Instanced meshes per material where possible; merged static platform; soft shadows via one shadow-mapped directional light (1024 map); tone-mapped (ACES) with slight bloom on emissive/magic elements only if perf allows (make bloom toggleable).
- **Architecture (clean, tunable — this will be iterated on):**
  - `main.ts` — boot, loop (fixed-step 60Hz physics, render at native display rate with interpolation — supports 60/90/120/144Hz displays transparently)
  - `tuning.ts` — every gameplay constant (§4.3)
  - `materials.ts` — material table (physics + visual)
  - `level/loader.ts`, `level/editor.ts`
  - `sim/physics.ts` — Rapier world, damage/break system, settle detection, clear detection
  - `sim/projectiles.ts` — normal / rapid / big shot
  - `fx/particles.ts`, `fx/audio.ts`, `fx/haptics.ts`, `fx/screenfx.ts` (screen kick, saturation boost, desat, vignette/tint for ability modes — **no time-scaling; physics and render always run at 1× speed, do not implement a timescale system**)
  - `game/state.ts` — level flow FSM (Aiming → Resolving → Settled → Win/EgoSave; plus ability sub-modes entered from Aiming: RapidFireMode and BigShotMode, each cancellable back to Aiming via a second button press — cancel refunds nothing because nothing was spent until the first projectile fires)
  - `meta/progress.ts` — stars, coins, owned consumables → `localStorage`
  - `meta/monetization.ts`, `meta/ads.ts` — mocked interfaces (§7.2)
  - `ui/` — screens & HUD (DOM)
- **Persistence:** `localStorage` (progress, settings, owned items).
- **Determinism note:** Physics need not be deterministic across devices; nothing depends on replay.

---

## 11. Out of Scope (v1)

- Real ad/IAP SDK integration (mocked interfaces only).
- Accounts, cloud save, leaderboards, social.
- Cannon/projectile cosmetic shop UI (data model may exist; UI later).
- Landscape support, gamepad, desktop-first polish (must *run* on desktop with mouse for dev).

## 12. Build Instructions for Claude Code

1. Scaffold Vite + TS + Three.js + Rapier; get one hardcoded tower falling with tap-to-shoot before anything else. **The first milestone is feel:** a shot that lands where tapped, breaks a pine block into debris, and knocks pieces off the platform with sound + particles.
2. Then build the material/damage system, level loader, and the 30 levels; then power-ups; then monetization mocks and the Ego-Save Flow; then meta/UI polish.
3. Keep every number in `tuning.ts`. Comment the *why* of feel constants. I will iterate on balance heavily.
4. Ship with the dev editor behind `?editor` and a `?level=N` param for direct testing.
