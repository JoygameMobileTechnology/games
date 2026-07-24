# SURGE STRIKERS — Game Design Document · WEB 3D EDITION (Three.js)
**Version 1.0-W · Full-Build Specification for an HTML5/WebGL 3D build · Prepared for implementation via Claude Code**

> This is the web-build variant of the Surge Strikers GDD. All game design (§1–§10, §12–§13, §15) is identical in intent to the Unity edition; §11 (Technical Design) and §14 (Build Plan) are rewritten for a **Three.js + TypeScript** stack, and platform-touching lines elsewhere are adjusted. The game renders in full 3D — this is not a 2D fallback.

> **How to read this document (note to the implementing agent):** This GDD is the single source of truth. Every system includes concrete numbers, formulas, state machines, and acceptance criteria. Where a value is marked `[TUNE]`, implement it as a Remote-Config-driven variable with the listed default. Build in the milestone order defined in §14. Do not invent systems not specified here; flag gaps as open questions instead.

---

## 1. High Concept

**Surge Strikers** is a free-to-play mobile arcade football game that takes the *structure* of Konami's eFootball — dream-team building, card collection, live events, division-based PvP — and replaces its grounded simulation with a **sci-fi fantasy sport** inspired by the tone of shows like *Galactik Football*: interplanetary teams, a limited supernatural energy called **Surge**, vertical aerial gameplay 10+ meters above the pitch, and cinematic elemental power shots.

- **Genre:** Arcade sports (football) + team-collection RPG meta
- **Platform:** Web (mobile + desktop browsers), landscape-enforced on mobile, installable PWA; touch controls first-class, keyboard/mouse supported on desktop
- **Engine/stack:** Three.js (WebGL2) + TypeScript + Vite; deterministic simulation layer in pure TS, fully decoupled from rendering
- **Backend:** Firebase Web SDK (Auth, Firestore, Cloud Functions, Remote Config, Analytics); payments via Stripe Checkout on web (§17)
- **Session target:** 4–6 min per match, 10–20 min per session
- **Monetization:** Gacha card acquisition, season pass, cosmetics via Stripe Checkout on web. No stamina gate on core play.
- **Team size on pitch:** 5v5 (4 outfielders + keeper) — see §3.1 for rationale
- **Multiplayer v1:** Asynchronous PvP (opponent squad is AI-controlled from a server snapshot). Real-time netcode is explicitly a non-goal for v1 (§16).

**Legal note:** The game is *tonally inspired by* Galactik Football but must not use its names, characters, "The Flux," planet names, team names (e.g. Snow Kids), logos, or trade dress. Everything in this document is original IP. The implementing agent must not import or generate assets that imitate that show's characters.

---

## 2. Setting & Narrative Frame

### 2.1 Universe
Centuries from now, seven inhabited worlds of the **Meridian Cluster** settle their rivalries in the **Interstellar Surge League (ISL)** — football played in orbital arenas where a cosmic energy field, the **Surge**, saturates the pitch. Athletes channel Surge through their bodies: impossible leaps, blinding sprints, shots that burn, freeze, or bend space. Surge is *scarce* — each team draws from a shared reservoir during a match, so spending it is a tactical decision, not spam.

### 2.2 The Seven Factions
Each faction is a playable "nationality" for player cards and defines the elemental flavor of their Surge. Faction determines the visual identity of abilities and grants one **Faction Ultimate** (§6.5).

| Faction | World | Element | Identity | Faction Ultimate (50 Surge) |
|---|---|---|---|---|
| **Glacier Wolves** | Kryos, a frozen moon | Cryo | Disciplined, precise passing culture | **Frostline** — for 8s, opponents crossing your defensive third are slowed 30% |
| **Ember Raptors** | Volkan, volcanic world | Pyro | Aggressive, shot-hungry | **Detonation Strike** — next Surge Shot gains +20% speed and knocks the keeper back on save |
| **Tempest Hawks** | Zephyria, sky cities | Aero | Aerial masters | **Updraft** — for 10s, all Sky Leaps by your team cost 0 and jump height +25% |
| **Terran Colossi** | Gaialith, high-gravity | Gravis | Physical wall, heavy volleys | **Gravity Well** — 6m field zone for 6s; opponents inside have −40% Physical, ball is pulled down (kills lobs) |
| **Volt Vipers** | Ionis, storm planet | Volt | Blistering pace | **Overcharge** — team sprint speed +15% and Surge Dash cost halved for 8s |
| **Umbra Phantoms** | Nyx, eternal-night world | Umbra | Trickster dribblers | **Phase Step** — controlled player's next 2 dribble touches blink 3m through opponents |
| **Prism Concord** | Meridian Station (neutral) | Prism | Balanced all-rounders | **Harmonize** — instantly refund 25 team Surge and clear all debuffs |

### 2.3 Campaign framing
The single-player campaign ("Interstellar Cup," §9.1) follows a rookie squad from Meridian Station climbing through qualifiers against each faction's home arena, told through short comic-panel dialogue vignettes (static art + text, no cutscene animation required for v1).

---

## 3. Core Gameplay — Match Rules

### 3.1 Format
- **5v5** (4 outfield + 1 keeper). Rationale: readable on a phone screen, tractable AI, faster Surge economy, and closer to the anime-style "small heroic squad" fantasy than 11v11. The architecture must keep team size data-driven (`teamSize` config) so 7v7 can be enabled later without refactor.
- **Match length:** 2 halves × 3:00 minutes of game clock `[TUNE]`. Clock pauses during goal celebrations, kickoffs, and Surge Shot cinematics.
- **Pitch:** 62m × 36m `[TUNE]`. Vertical playable airspace: 16m.
- **Rules simplified for arcade flow:** kick-ins instead of throw-ins; no offside; fouls produce free kicks (direct if inside 25m); two hard fouls by the same player = 2-minute sin-bin (power-play, no red cards); corners and goal kicks standard; no VAR, no injuries.
- **Draw handling:** league/PvP matches can end drawn; cup/campaign knockout matches go to **Golden Goal overtime (2:00)** then a 3-round **Surge Shootout** (each shootout kick is a full Surge Shot vs. keeper duel, §6.4).

### 3.2 Camera
- **Broadcast-side camera** (default): elevated side view, dynamic zoom 18–30m FOV framing the ball.
- **Sky Cam:** when a ball's apex exceeds 6m altitude, camera smoothly tilts up and pulls back to frame the aerial duel; on Sky Leap slow-motion (§6.2) it pushes in on the leaping player.
- **Surge Shot cinematic:** 1.2s canned camera cut (skippable in settings) — low angle behind shooter, then whip-pan to goal.

### 3.3 Controls (touch)
Left thumb: floating virtual joystick (movement). Right thumb: context buttons.

| Input | In possession | Out of possession |
|---|---|---|
| **A (tap)** | Short ground pass to best target in joystick direction | Pressure / tackle (tap) |
| **A (hold ≥0.4s)** | **Sky Pass** — vertical lob to targeted teammate (§6.1) | Slide tackle (hold) |
| **B (tap)** | Shoot (power = tap duration up to 0.6s) | Switch player (nearest to ball) |
| **B (hold ≥0.6s)** | **Surge Shot** charge (§6.3), requires 35 team Surge | — |
| **C (tap)** | **Surge Dash** — 3m burst, 10 Surge | Surge Dash to close down |
| **C during airborne ball descent** | **Sky Leap** (§6.2), 20 Surge | Defensive Sky Leap (intercept) |
| **Flick joystick + A** | Driven through-ball along flick vector | — |
| **D-pad tap (small, top-right)** | Faction Ultimate (50 Surge, once armed) | Same |

- All timings/costs are Remote Config variables.
- **Desktop mapping:** WASD/arrows = move · J = A · K = B · L = C · U = Ultimate · Space = switch player. Gamepad API support is P1.
- **Assist layer:** pass targeting uses a scored candidate list (§11.4); auto-face-ball; optional "one-button mode" accessibility setting where A is context-smart (pass/shoot decided by position).

### 3.4 Ball physics
- Custom ball controller on a kinematic-hybrid rigidbody: gravity 9.81 × `gravityScale` (default 1.15 for snappier arcs `[TUNE]`), Magnus curve force from applied spin, drag coefficient tuned so a max-power normal shot travels 24 m/s and a Surge Shot 38 m/s `[TUNE]`.
- Sky Pass solver: given target landing point and desired apex (10–14m), solve initial velocity analytically; landing point leads the receiving teammate's run.
- Determinism: fixed-timestep 60Hz simulation in an accumulator loop decoupled from `requestAnimationFrame`; render layer interpolates. All gameplay randomness from a per-match seeded RNG (enables replays, headless Node simulation, and server-side result plausibility checks).

---

## 4. The Surge System (core differentiator)

### 4.1 Team Surge Meter
- One **shared meter per team**, 0–100, starts each half at 30 `[TUNE]`. Displayed as a glowing arc around the score HUD in the team's faction color.
- **Generation:** +2 completed pass · +4 successful tackle · +6 interception · +8 successful aerial duel · +1 per 3s of possession · +10 conceding a goal (comeback aid) `[TUNE]`.
- **Costs:** Surge Dash 10 · Sky Leap 20 · Surge Shot 35 · Faction Ultimate 50 `[TUNE]`.
- **Design intent:** Surge is a *tempo resource*. Passing teams earn the right to spectacle. The AI opponent obeys identical rules — no cheating meters at any difficulty.

### 4.2 Surge Affinity (player stat)
Each card has **Surge Affinity (40–99)**. It scales the *output* of Surge actions, not the cost:
- Sky Leap height: `8m + 4m × (Affinity/99)` → 8–12m
- Surge Shot speed bonus: `+8 to +14 m/s` scaled by Affinity
- Surge Dash distance: `2.5m + 1.5m × (Affinity/99)`

---

## 5. Design Pillars (tie-breakers for implementation decisions)
1. **Earn the spectacle** — Surge moments are paid for by good football; if a feature lets players skip the earning, cut it.
2. **Vertical is the identity** — when in doubt, favor readability and drama of the aerial game over ground-game fidelity.
3. **Fair AI, always** — difficulty is decision quality, never hidden stat or meter cheats.
4. **Session in your pocket** — every mode completable in under 7 minutes; no forced waits, no stamina.
5. **Original IP discipline** — inspired-by tone, zero borrowed names, designs, or assets.

---

## 6. Signature Mechanics

### 6.1 Sky Pass
1. Holder holds **A ≥0.4s**; targeting UI shows up to 3 teammate candidates with vertical beam markers; joystick direction selects.
2. Release: ball is launched near-vertically (apex 10–14m) toward a landing point leading the receiver.
3. Receiver auto-runs to the landing zone; a shrinking **descent ring** appears when the ball starts falling.
4. Both the receiver and any defender within 4m of the landing zone may contest (§6.2).
- Sky Pass itself costs **0 Surge** (the lob is free; the *leap* costs Surge). This keeps the mechanic in constant use while making the payoff a spend decision.
- Ungrabbed Sky Passes land as loose balls — risk of turnover.

### 6.2 Sky Leap & Aerial Action Window
1. During ball descent, pressing **C** with a legal contester triggers **Sky Leap**: the player rockets 8–12m up (Affinity-scaled) with faction-colored contrail VFX. Cost 20 Surge.
2. On reaching the ball, time dilates to **0.4× for up to 0.9s** — the **Aerial Action Window**. Options:
   - **B tap:** header/volley shot (if within 30m of goal)
   - **B hold (needs 35 Surge):** **Sky Surge Shot** — the marquee moment; combines both systems
   - **A:** cushioned header pass to a teammate
   - **Joystick only:** chest trap — land with possession
3. **Aerial duel:** if attacker and defender both leap, contested resolution: `duelScore = Aerial×0.5 + Physical×0.3 + Affinity×0.2 + timingBonus(0–15)` where timingBonus rewards leaping closest to the optimal frame. Higher score wins the touch; loser is knocked into a 0.8s recovery.
4. Landing: winner lands in a superhero pose with a small shockwave decal; 0.3s landing recovery (skipped if they shot mid-air).

### 6.3 Surge Shot (ground)
1. Hold **B ≥0.6s** with ≥35 team Surge inside the attacking half.
2. Charge: 0.7s wind-up, player is tackle-vulnerable during it (risk).
3. Fire: 1.2s cinematic (skippable), ball travels 38+ m/s with the shooter's **elemental trail** (faction VFX) and a screen-space distortion pulse.
4. Elemental rider effects (cosmetic-plus-minor): Pyro shots explode-scatter the keeper's parry 20% farther; Cryo shots that are saved freeze the keeper's redistribution for 1s; Gravis shots dip late (harder for AI keeper prediction); Volt shots have 10% faster charge; Umbra shots visually flicker (no stat effect); Aero shots can be aimed 15% wider; Prism none.

### 6.4 Keeper Duel
Any Surge Shot (ground or sky) on target triggers the **Keeper Duel** resolution:
- `saveChance = clamp(GK_Reflex×0.4 + GK_SurgeGuard×0.3 + positioning(0–20) − shotPower×0.35 − cornerPlacement(0–15), 3%, 85%)`
- If the defending team has ≥25 Surge, the AI keeper may auto-spend 25 for **Surge Block** (+18% saveChance, big VFX clash). In PvP-async both sides' spend logic is AI-driven and symmetric.
- Outcomes: goal / parry (loose ball) / catch. Parries bias toward dramatic rebounds (60% land within 8m of goal).

### 6.5 Faction Ultimates
- Armed via the D-pad button at 50 Surge; one activation per player *card* per match; effects listed in §2.2 table. Ultimates never directly score — they bend the field for a few seconds.

---

## 7. Players, Attributes & Roles

### 7.1 Attributes (40–99)
`Pace, Dribbling, Passing, Shooting, Defense, Physical, Aerial, Surge Affinity` — keepers instead use `GK Reflex, GK Positioning, GK Distribution, GK SurgeGuard, Aerial, Surge Affinity`.

**Overall rating** = role-weighted mean (weights in `roles.json`, e.g. Striker: Shooting .30, Pace .20, Aerial .15, Affinity .15, Dribbling .10, Physical .05, Passing .05, Defense .00).

### 7.2 Roles & Playstyles
Roles: **Striker, Winger, Playmaker, Anchor (defender), Keeper.** Formations for 5v5: `1-2-1`, `2-1-1`, `1-1-2` (keeper implied).
Each card additionally has one **Playstyle** that biases its AI and grants a passive:

| Playstyle | Passive |
|---|---|
| Sky Dominator | +10 effective Aerial in duels |
| Deadeye | Surge Shot corner placement +8 |
| Conductor | Passes generate +1 extra Surge |
| Warden | Tackles inside own third generate +2 extra Surge |
| Sparkrunner | First Surge Dash each possession costs 5 |
| Wallkeeper (GK) | Surge Block cost 20 instead of 25 |

### 7.3 Rarity & growth
- Rarities: **Common (60–74 OVR), Rare (70–82), Epic (78–90), Legendary (85–97)** base ranges.
- **Leveling:** XP items raise level 1→30; each level +0.3 OVR distributed by role weights.
- **Limit Break:** duplicate cards (or universal Star Shards) raise level cap +5 per break, max 3 breaks.
- **Skill Training:** each card has 2 skill slots; consumable Skill Chips add passives (e.g. "Leap cost −2"). Chips are earned, never sold directly for hard currency.

---

## 8. Meta Layer — Team Building (eFootball-structure analog)

### 8.1 Squad
- Player owns a **Dream Squad**: 5 starters + 3 bench (bench = manual substitutions at dead balls, max 2 per match).
- **Team Chemistry:** +1 team OVR per 2 starters sharing a faction (max +2); +1 if formation matches the squad's aggregate role fit. Kept deliberately mild — collection freedom over forced mono-faction teams.
- **Manager cards** (P1, not v1): passive team-wide boosts, mirrors eFootball managers. Architect data model now, ship later.

### 8.2 Economies
| Currency | Source | Sink |
|---|---|---|
| **Credits** (soft) | Match rewards, missions, events | Leveling XP, skill chips, standard draws |
| **Nova Coins** (hard/premium) | IAP, season pass, rare missions | Featured draws, cosmetics, season pass premium |
| **Star Shards** | Duplicate auto-convert, events | Limit breaks of any card |
| **Event Tickets** | Daily grants (5/day, cap 15) | Entry to live events only (quick match & PvP are never gated) |

### 8.3 Gacha ("Star Draws")
- **Standard Banner** (Credits: 3,000/draw): Common 60% · Rare 30% · Epic 8% · Legendary 2%.
- **Featured Banner** (Nova Coins: 250/draw, 10-draw 2,250): same base rates; featured Legendary is 50% of Legendary hits; **pity: guaranteed Legendary at 60 draws** (counter shown in UI, resets on hit, persists across a banner's lifetime, not across banners).
- 10-draws guarantee ≥1 Epic.
- All rates displayed in-UI (compliance). **All rolls are executed server-side in a Cloud Function** — the client never computes gacha outcomes.
- Duplicates → Star Shards (Common 5, Rare 20, Epic 80, Legendary 300).

### 8.4 Monetization surface (v1)
1. Nova Coin packs (5 SKUs: $1.99–$79.99).
2. **Season Pass** ($9.99 / 30-day season): free + premium tracks, 30 tiers driven by match XP; premium tier 30 = choice of one Epic + exclusive cosmetic stadium skin.
3. Cosmetics: jerseys, Surge trail colors, goal explosion effects, stadium skins. Zero stat impact.
4. Starter bundles (one-time, first-purchase double coins).
- **Deliberate exclusions:** no energy/stamina on matches, no loot boxes containing currency, no PvP-entry fees. Retention comes from play, not walls.

### 8.5 Live-ops calendar (systemic, content-driven)
- **Seasons:** 30 days. New featured banner, season pass, division reset (soft reset: drop 2 divisions).
- **Weekly events:** rotating rulesets (e.g. "Low Gravity Week": Sky Leap +30% height; "Surge Flood": meters start at 60). Events are pure Remote Config + reward table — no client update needed.
- **Daily missions:** 3/day (e.g., "Win an aerial duel 5 times") → Credits/Tickets.

---

## 9. Game Modes

### 9.1 Interstellar Cup (Campaign)
- 8 chapters × 6 matches = 48 matches; each chapter themed to one faction's arena with a rule twist in matches 3–6 (e.g., Gaialith chapter: gravity 1.3×, lobs shorter).
- Star objectives per match (win / win by 2 / score a Sky Surge Shot) → up to 3 stars; star totals gate chapter chests (guaranteed Epics at chapters 4 & 8).
- Difficulty curve via AI tiers (§11.6) and opponent OVR from 62 → 90.
- Dialogue vignettes: JSON-driven sequences of (portrait, name, text) — max 6 lines before/after key matches; fully skippable.

### 9.2 Quick Match
vs AI, pick difficulty (Rookie/Pro/Star/Nova), full rewards with diminishing Credits after 10 wins/day (soft cap, not a wall).

### 9.3 Surge Trials (skill minigames)
3 rotating drills reusing match systems, leaderboard-scored weekly: **Aerial Gauntlet** (chain Sky Leap receptions), **Target Break** (Surge Shots at moving target boards), **Ghost Run** (dribble/dash time trial).

### 9.4 Division PvP (asynchronous)
- Ladder: Division 10 → 1, then **Nova League** (Elo-style within Div 1).
- Flow: client requests opponent → Cloud Function returns a **squad snapshot** (roster, levels, formation) of a real player within ±1 division and ±3 team OVR → local match vs AI controlling that squad at difficulty scaled to its division → result posts back with the match seed for plausibility validation (server sanity-checks score vs. OVR delta; absurd results flagged).
- Points: +3 win, +1 draw, 0 loss; promotion at thresholds; weekly reward chest by division; defense is passive (your squad earns small rewards when it "defends" in others' matches — pure server bookkeeping).

### 9.5 Practice Arena
Free-play sandbox, tutorial home. The 7-step onboarding (M6) teaches: move/pass → shoot → Surge meter → Sky Pass → Sky Leap → Surge Shot → squad screen, interleaved into the first 3 campaign matches.

---

## 10. Art, Audio, UX

### 10.1 Art direction
- **Look:** cel-shaded toon — `MeshToonMaterial` with a 2-band `gradientMap`, rim light added via `onBeforeCompile` shader chunk (or one shared custom ShaderMaterial); outlines via **inverted-hull second pass** (scaled backface shells on characters/ball only — cheaper than a full-screen OutlinePass for 10 skinned meshes), saturated faction palettes on a dark cosmic base (space-navy #0B1030, star-cyan #35E0FF, UI accent per faction).
- **Characters:** stylized athletic proportions (~6.5 heads), strong silhouettes per role; 7 base body meshes × faction material variants × jersey system (color mask channels). Face variety via texture atlas — no per-card unique meshes in v1 except 14 "hero" Legendaries (2 per faction) with unique hair/accessory meshes.
- **Stadia (v1: 3):** Meridian Station (neutral orbital ring, star vista), Kryos Glacier Bowl (aurora sky), Volkan Caldera (lava glow horizon). Others P1.
- **VFX:** pooled instanced-quad GPU particles + additive ribbon meshes (`postprocessing` bloom sells the glow); distortion via a small screen-space refraction pass gated by quality tier. Every faction's element must be readable in 0.2s at gameplay zoom. Budget: ≤25k live particles peak on mid-tier mobile browsers, within the §11.10 draw-call budget.
- **Animation set (per outfielder):** idle, run x2, sprint, pass, lob, shot, surge-shot windup+fire, header, volley, leap-up, air-idle, air-shot, land, tackle, slide, knockdown, celebrate x3. Keeper adds dive x4, catch, parry, surge-block. One shared humanoid skeleton across all body meshes; clips authored once and reused via `AnimationMixer` (glTF animations). UI/juice tweening via GSAP or tween.js.

### 10.2 Audio
- Music: synthwave-orchestral hybrid; menu theme, 3 match beds (intensity-layered stems switching on score state), event sting set.
- Implementation: Howler.js (Web Audio API), SFX packed as audio sprites; unlock audio context on first gesture (mobile browser requirement).
- SFX: distinct per-element Surge signatures (cryo shimmer, pyro roar, volt crackle…), crowd bed with swell triggers (shots, goals, duels), UI clicks. Commentator: **P2, not v1** (barks system architected but silent).

### 10.3 UX / Screen map
`Boot → Title → Home Hub` with tabs: **Play** (Campaign/Quick/PvP/Trials/Events) · **Squad** (formation drag-drop, card detail, training) · **Draws** · **Shop** · **Missions/Pass** · **Settings**.
- Match HUD: score+clock top-center, twin Surge arcs flanking it, joystick left, A/B/C cluster right, Ultimate button top-right, pause top-left.
- FTUE rule: no popup chains; one contextual tooltip max per screen visit.
- Accessibility: one-button mode, colorblind-safe faction palette check (elements never distinguished by color alone — shape language per element), haptics toggle, cinematic-skip toggle.

---

## 11. Technical Design (Web / Three.js)

### 11.1 Stack decisions
- **Language & build:** TypeScript (strict), Vite, ESLint + Prettier. Single-page app.
- **Rendering:** Three.js (current release, WebGL2 renderer), `postprocessing` package for bloom (Surge glow), vignette, and the Surge Shot radial-blur cinematic. WebGPU is a non-goal (§16).
- **Physics:** **no physics engine.** Ball ballistics are analytic (§3.4) and player collision is capsule-vs-capsule resolved inside the sim layer. Do not add Rapier/Ammo/Cannon unless aerial-duel contact resolution demonstrably fails without it — the WASM/bundle cost isn't justified for v1.
- **Sim/render decoupling (hard rule):** all gameplay logic lives in `/src/sim` as pure TypeScript with **zero imports of three.js or DOM APIs** (enforce with an ESLint boundary rule). The render layer subscribes to sim events and interpolates. This single rule is what makes the Node headless harness (§12), determinism, replays, and future server validation possible.
- **UI:** all meta screens and the match HUD are **DOM/CSS overlays**, not in-canvas UI — faster to build, accessible, and trivially responsive. Canvas is gameplay-only.
- **State:** lightweight event bus + plain observable stores (zustand acceptable); no heavy framework. React is permitted for meta screens only if it stays out of the match loop.
- **Assets:** glTF/GLB with meshopt compression; KTX2/Basis textures; manifest-driven loader with priority tiers (match-critical → active stadium → cosmetics). No asset >4MB single file.
- **Audio:** Howler.js.
- **Backend:** Firebase Web SDK v10 modular — Auth (anonymous first, Google/Apple account linking), Firestore, callable Cloud Functions, Remote Config, Analytics. **Payments:** Stripe Checkout via Cloud Function session + webhook fulfillment (server-authoritative, same wallet rules as §8).
- **Distribution:** PWA — Workbox service worker (offline shell + asset cache), install prompt, Firebase Hosting deploy. Native wrapping (Capacitor) is P2 and must require zero gameplay-code changes.

### 11.2 Project structure
```
src/
  main.ts            (boot, screen flow)
  core/              (eventBus, saveService [localStorage mirror + Firestore truth],
                      remoteConfigService [offline defaults], assetLoader, quality)
  sim/               (PURE TS — matchState FSM, ballSim, agentSim, surgeSystem,
                      aerialSystem, keeperDuel, rules, seededRng, difficultyProfiles)
  ai/                (utilityBrain, roleBehaviours, surgeBudgetPolicy — imported by sim)
  render/            (matchScene, characterView, ballView, vfxPools, cameraDirector,
                      toonMaterials, outlineHull, postFX)
  meta/              (inventory, squadService, gachaClient, progression, economy,
                      missions, seasons, pvpService)
  ui/                (DOM screens: hub, squad, draws, shop, missions, settings, matchHUD)
  data/              (JSON defs: cards, factions, playstyles, formations, balance)
public/assets/       (glb, ktx2, audio sprites)
functions/           (Firebase Cloud Functions, TypeScript)
tools/sim-harness/   (Node CLI: batch AI-vs-AI matches → CSV)
```

### 11.3 Match flow FSM
Identical states to the design (`Intro → Kickoff → OpenPlay → SetPiece → SurgeCinematic → GoalSequence → HalfTime → Overtime → Shootout → FullTime → Results`), implemented in `sim/matchState.ts`. Sim ticks at fixed 60Hz via an accumulator; think-ticks at 5Hz. The render layer never mutates sim state — input is queued into the sim as commands.

### 11.4 Player agents & AI
Each of the 10 agents runs `Perception (shared blackboard) → Decision (utility scores) → Locomotion (direct steering with avoidance — open pitch, no navmesh)`. Human input overrides Decision for the controlled agent only. Outfield decisions are utility-scored each think-tick (5Hz) over the action set `Pass(target), SkyPass(target), Dribble(dir), Shoot, SurgeShot, Dash, HoldPosition, Press, Tackle, LeapContest`; score = weighted features (lane openness via capsule casts in sim space, distance to goal, pressure, Surge budget policy, role positioning error vs. a formation grid that shifts with ball position). Positioning: home slot from formation + attraction to the ball corridor. Keeper runs a dedicated FSM (Position, Narrow, Dive, Claim, Distribute, SurgeBlock). Per-difficulty Surge budget personalities (`aggression`, `saveForUltimate`, `leapEagerness`) prevent instant meter-dumping. **AI never receives stat or meter cheats — difficulty is decision quality only.** All of it runs headless in Node.

### 11.5 Difficulty tiers
| Tier | Reaction delay | Pass error σ | Think Hz | Surge policy |
|---|---|---|---|---|
| Rookie | 400ms | high | 3 | wasteful |
| Pro | 250ms | med | 4 | balanced |
| Star | 150ms | low | 5 | efficient |
| Nova | 80ms | minimal | 5 | optimal + ultimate timing |

### 11.6 Data model (Firestore)
```
users/{uid}: profile{name, level, avatarId}, wallet{credits, novaCoins, shards, tickets},
             pity{bannerId: count}, division{tier, points}, seasonPass{level, premium}
users/{uid}/cards/{cardInstanceId}: defId, level, xp, limitBreaks, skillChips[]
users/{uid}/squads/{squadId}: formationId, starters[5], bench[3]
snapshots/{uid}: denormalized squad for PvP matchmaking (updated on squad save)
leaderboards/, events/, missions/ per standard patterns
```
Static definitions ship in-client as JSON under `src/data`, typed via zod schemas at load; tunables mirrored to Remote Config with in-client defaults (offline-safe).

### 11.7 Cloud Functions (server-authoritative)
`rollGacha(bannerId, count)` · `claimMission(id)` · `findPvPOpponent()` · `submitPvPResult(matchSeed, score)` (plausibility validation vs. OVR delta) · `grantSeasonRewards()` · `createCheckoutSession(sku)` + `stripeWebhook` (fulfillment). Client never mutates wallet/cards; Firestore security rules: user docs read-own, writes only via Functions.
**Web trust note:** the client is fully inspectable in DevTools. That is acceptable because *all economy is already server-side*; the match sim itself remains client-trust for v1, mitigated by the seed/plausibility check — do not attempt client-side obfuscation, it's wasted effort.

### 11.8 Analytics
Same taxonomy as the design: `session_start, ftue_step{n}, match_start/end{...}, surge_action{...}, sky_leap{won}, surge_shot{scored}, gacha_roll{...}, iap{sku}, division_change{...}, event_enter{id}` via Firebase Analytics for web.

### 11.9 Performance & size budgets (WebGL, mobile browsers)
- **60fps** on iPhone 11 Safari / Snapdragon 778-class Chrome; hard floor 30fps on 2019 devices with an **auto quality stepper**: resolution scale → 0.75, outlines off, particle cap halved, postFX reduced. Quality decisions live in `core/quality.ts`, driven by rolling frame-time.
- ≤ **90 draw calls** in match (WebGL draw calls cost more than native): merged/static stadium geometry, instanced crowd billboards, jersey texture atlas + color-mask channels, pooled VFX.
- Skinned meshes: 10 players ≤ 4k tris each (+ LOD1 2k), ≤ 40 bones/character, one shared skeleton.
- **Load budgets:** ≤ 3.5MB gzipped JS initial bundle; ≤ 8MB critical assets to first playable match; first match reachable in < 15s on 4G. Code-split all meta screens; lazy-load stadiums and hero cosmetics. Total v1 footprint ≤ 60MB, service-worker cached after first visit.
- Memory ≤ 350MB. Handle **iOS Safari WebGL context loss**: listen for `webglcontextlost/restored`, rebuild GPU resources, sim state must survive untouched (another payoff of sim/render separation).

### 11.10 Web-platform requirements
- Mobile: landscape enforcement overlay, Fullscreen API on first gesture, `touch-action: none` on canvas, `visualViewport` handling, prevent pull-to-refresh, wake-lock during matches where supported.
- Lifecycle: pause sim on `visibilitychange: hidden`; on resume, reconcile the match clock (no fast-forward simulation of hidden time — the match simply pauses; PvP is async so this is safe).
- Persistence: localStorage mirror of profile for guest play; Firestore becomes source of truth on sign-in with a guest-merge flow (keep higher wallet/cards union, one-time).
- Browser floor: last 2 major versions of iOS Safari / Chrome / Samsung Internet; feature-detect WebGL2 and KTX2, with a graceful "device not supported" page below floor.

## 12. Balancing Reference (launch defaults)

- Normal shot 24 m/s · Surge Shot 38–44 m/s (Affinity) · sprint 7.4 m/s (Pace 99) / 6.0 (Pace 40) · Surge Dash +6 m/s for 0.5s.
- Expected goals per match target: **3.5–5.5 total** at equal OVR (tune keeper duel constants to hit this).
- Surge economy target: an average team earns ~140 Surge per match → supports roughly 3 leaps + 2 surge shots + 1 dash chain OR 1 ultimate-centric plan. Verify via the Node simulation harness (`tools/sim-harness`, M2 deliverable): headless AI-vs-AI batch sim, e.g. `npm run sim -- --matches 500 --config default` → CSV of goals/surge usage per config. Runs without any browser or GPU.
- Progression pace: F2P player reaches a 78+ OVR squad in ~2 weeks of daily play; first Legendary expected (pity math) within ~5 weeks F2P.

## 13. Success Metrics
Leading: FTUE completion ≥70% · D1 ≥38% · avg 3+ matches/day/active · Sky Leap used in ≥80% of matches by D3.
Lagging: D30 ≥8% · ARPDAU ≥$0.10 by month 2 · PvP participation ≥45% WAU · crash-free ≥99.5%.

---

## 14. Build Plan for Claude Code (milestones & acceptance criteria — web build)

**M0 — Scaffold (foundation)**
Vite + TypeScript project, Three.js bootstrap (pitch plane, lighting, orbit debug cam), ESLint boundary rule enforcing three-free `/sim`, event bus, JSON→typed content pipeline (zod), save service (localStorage), Remote Config service with offline defaults, DOM screen router (Boot→Hub), capsule placeholder characters.
✅ AC: app boots to Hub; match scene renders pitch + 10 capsules at 60fps desktop; 20 sample cards load and validate from JSON; `import three` inside `/sim` fails lint.

**M1 — Ball & one player**
Ball sim (§3.4) incl. Sky Pass solver, single controllable capsule: move (touch joystick + WASD), ground pass to dummy, shoot; camera follow; sim/render interpolation proven (sim at 60Hz fixed, render at display rate).
✅ AC: Sky Pass reaches designated point with 10–14m apex ±0.5m; shots 24 m/s ±5%; sim produces identical state hashes for identical seeds across two runs.

**M2 — Full 5v5 match loop**
10 agents with utility AI, keeper FSM, match FSM, rules (§3.1), DOM match HUD, results screen, difficulty tiers, **Node sim harness** in `tools/sim-harness`.
✅ AC: harness runs 500 headless matches in < 3 min on a laptop; equal-OVR mean 3.5–5.5 goals/match; 30-min browser soak with no softlocks and no detached-node memory growth.

**M3 — Surge systems**
Team meter, Surge Dash, Sky Leap + aerial window + duels (incl. Sky Cam behavior), Surge Shot + keeper duel, Faction Ultimates; placeholder-but-readable VFX via instanced particles + bloom; slow-mo time-scale support in the fixed-step loop.
✅ AC: every §6 mechanic playable via touch and keyboard and used correctly by Star-tier AI; Surge economy harness run hits §12 targets.

**M4 — Meta layer (local-first)**
DOM screens: squad management (drag-drop formation), card detail/leveling/limit break/skill chips, gacha with a *local mock* implementing the exact Cloud Function interface, currencies, missions, quick-match rewards, campaign structure (8 chapters, data-driven, placeholder dialogue).
✅ AC: full loop playable offline as a guest: earn → draw → improve squad → measurable power difference in match.

**M5 — Firebase, payments & PvP**
Firebase Auth (anonymous + linking, guest-merge), Firestore schema §11.6, Cloud Functions §11.7 (gacha moves server-side behind the same interface), async PvP flow with snapshot matchmaking and result plausibility checks, Stripe Checkout + webhook fulfillment, analytics events, season pass service.
✅ AC: two test accounts fight each other's snapshots; wallet mutation from client console is rejected by security rules; gacha rates verified over 10k server test rolls; a Stripe test purchase credits Nova Coins via webhook only.

**M6 — Content, FTUE, polish & ship**
Toon art pass (MeshToonMaterial + hull outlines), 3 stadia, full animation set via AnimationMixer, audio pass (Howler), onboarding FTUE, Surge Trials, events framework, accessibility options, auto quality stepper, PWA (Workbox offline shell, install prompt), performance pass to §11.9, Firebase Hosting deploy pipeline, gacha-rate disclosure screen.
✅ AC: FTUE playtest-clean; 60fps on iPhone 11 Safari; initial-load budgets met (verify with Lighthouse + WebPageTest on 4G throttle); PWA installable; context-loss recovery works mid-match.

Each milestone must end with the game runnable in a browser; do not begin Mn+1 with Mn acceptance criteria failing.

## 15. Content Manifest (v1 launch)
- 112 player cards: 7 factions × (2 Legendary heroes, 3 Epic, 5 Rare, 6 Common) — generate stat lines procedurally within §7.3 ranges, hand-tune the 14 heroes with distinct Playstyle+Ultimate synergies.
- 3 stadia, 3 formations, 6 playstyles, 7 ultimates, 48 campaign matches, 3 Surge Trials, 8 weekly-event ruleset templates, 30-tier season pass table, 4 cosmetic sets.

## 16. Non-Goals (v1)
- **Real-time multiplayer** (largest scope risk; async PvP delivers competition without netcode).
- 11v11, manager cards, commentator audio, guilds/co-op, player trading/market (regulatory risk).
- **Native app wrappers** (Capacitor/TWA) and store IAP — P2, and must require zero gameplay-code changes when they come.
- **WebGPU renderer** — stay on WebGL2 for reach; keep renderer creation isolated so a later swap is contained.
- Full gamepad support (P1; input layer must stay abstraction-friendly).

## 17. Open Questions (for Can, before/while M4)
1. Target soft-launch markets & languages? (TR + EN assumed for v1 localization tables — all strings must go through a localization service from M0.)
2. Gacha pity at 60 vs. 50 — appetite for more generous positioning as a differentiator?
3. 5v5 confirmed, or is 7v7 fidelity to the inspiration worth the AI/readability cost? (Data model supports both; decision needed before M2 tuning.)
4. Season length 30 days vs. 14 days for early live-ops learning speed?
5. Any platform preference for ad monetization (rewarded video for ticket refresh)? Currently excluded entirely.
6. **Web payments:** Stripe Checkout is specced for v1. If the plan is to wrap for app stores quickly, store IAP policies will forbid Stripe for in-game currency inside the wrapped build — decide wrap timing before M5 to avoid double payment work.
