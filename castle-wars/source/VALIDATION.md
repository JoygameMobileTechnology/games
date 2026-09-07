# First build validation

Checked on 7 September 2026. This records development checks, not a claim of physical-device certification.

## Automated checks

- `npm test`: **33 passing tests** (24 simulation, 9 HTTP/WebSocket integration).
- `npm run check`: passed.
- Gameplay coverage includes ownership and invalid input, scarce ammunition, symmetric unlocks, rotating survivors, reinforced masonry, blast occlusion, penetration, persistent collapse, fall/crush damage, each special projectile behavior, construction, core defeat, mutual elimination, regulation cutoff, flood progression, simultaneous drowning, and host suspension.
- Network coverage includes AI startup, two-player readiness, room capacity, duplicate/stale commands, reconnect credentials and expiry, rematches, QR links, and malformed JSON values that previously could crash message dispatch.

## Browser playthrough

Two independent browser tabs joined a room, readied up, exchanged slingshot shots and received the same castle destruction. Valid cover placement spent its charge and action; invalid placement retained ammunition. Refresh restored the same seat and inventory. The match reached sudden death and ended in a simultaneous-drowning draw at 5:19. A separate solo match exercised the AI and defeat screen.

Landscape viewports checked: **844×390, 852×393, 926×428, 932×430**, plus **844×340** to represent reduced browser height. The portrait fallback was checked at **390×844**. The latest aiming test produced no new console warnings or errors after fixing the power-meter selector. Reconnect no longer replays historical explosion effects.

## AI pacing sample

Twenty seeded AI-versus-AI games used production game timers and a simulated one-second aiming delay. All finished; the starting side won ten. Eighteen reached all six advanced unlocks, and the AI placed cover 58 times across the sample. Median simulated match duration was 93 seconds. These fast automated opponents do not establish human match duration or competitive balance. All sampled wins were crew elimination; core destruction is separately verified by simulation tests.

## Remaining device validation

Chrome on a **physical iPhone 12 or newer**, including Pro and Pro Max, has not been tested here. Run a two-phone Wi-Fi playtest for real touch input, safe-area behavior, sustained frame rate during heavy destruction, audio, rotation, backgrounding, and reconnection. Desktop viewport checks do not replace those checks. The host must remain running and awake.


## Feedback revision — 7 September 2026

- **51 automated tests pass**: 31 engine, 9 network, 5 wind-aware AI and 6 pointer-release regressions. Syntax checks cover all application JavaScript modules.
- The original pointer handler was reproduced canceling a short drag with no intermediate move event and canceling during synchronous capture loss. The revised handler samples pointerup and relinquishes ownership before releasing capture. Browser tests confirmed both 25-pixel and 9-pixel pulls launch visible rockets; the new browser tab reported no warnings/errors.
- Reviewed the wider mirrored arena, distinct team art, and wind HUD at 844×390. Basic and moon explosions were visually inspected at a fixed animation frame at the same size. The temporary effects-preview page was removed afterward.
- New engine checks cover exactly mirrored supported chambers, launch clearance at low/medium/full power including the moon, fixed wind for a paired round, wind changes in sudden death, forecast/actual agreement, and distant shots from all three galleries against either wind extreme. This revision initially used a 4.2-second flight budget; the later unlimited-sky revision removes that budget entirely.
- Twelve further seeded AI-versus-AI matches (seeds 21–32, one simulated second of aiming) all ended without interruption. All twelve reached six unlocks; two reached sudden death, and one ended in a draw. These are development samples, not competitive balance conclusions.
- Renderer and audio smoke harnesses exercised capped overlapping effects, reduced motion, effect expiry, capped audio voices and mute behavior. Physical iPhone touch, sustained performance and actual audio playback remain to be checked on the target devices.


## Annotated browser follow-up — 7 September 2026

The annotated screenshots showed the original client. A disposable live-host room confirmed the newer 125-tile castles at x=140–476 and x=1524–1860, with a 1,048-pixel gap and authoritative wind. The existing browser page was refreshed. The wind HUD was moved out of the centered turn callout and into the marked top-right area below the utility buttons; it remains within safe-area margins and uses a compact phone layout. No physics or castle-balance values changed in this follow-up.

## Pre-designed formations — 7 September 2026

- **67 automated tests pass:** 28 core engine, 15 formation, 9 AI, 9 HTTP/WebSocket and 6 pointer-input tests. `npm run check` passes, including the new shared formations module. The former single-layout geometry fixtures were replaced by stronger all-formation coverage.
- Three silhouettes and shooter arrangements are distinct, exactly mirrored, initially stable under real gravity, and have enclosed destructible cores. Selection is seeded independently of arsenal/wind, and network rematches select a different formation shared by both clients.
- All 72 starting-position/default-weapon/extreme-wind combinations have a valid enemy-reaching trajectory through the intact walls. Twenty-four rear-shooter trajectories were also fired in authoritative simulation and landed at their forecast contacts; the later unlimited-sky revision removes the former lifetime deadline. Large-projectile initial clearance and forecast/flight agreement remain covered.
- The AI tests exercise 108 seeded opening plans across the three formations, both sides, all shooters and both extreme winds. No initial own-roof contacts occur in those fixtures; ordinary misses remain permitted. Identical public state produces the same plan independently of machine timing.
- Visually reviewed Twin Keeps and Bridge Fort at 844×390, Crown Citadel at 932×430, 844×340 and 1280×921. Checked team art, connected masonry, distinct silhouettes, formation name, aiming hint, wind placement and arsenal clearance. Temporary preview files were removed.
- Restarted the host and refreshed the existing game page. A live 844×390 Bridge Fort match showed the rear-shooter hint, changed wind after the turn pair, and a live high-rocket marker. A roughly 39-pixel drag from the rear tower visibly launched a partial-power rocket. The test tab reported no console warnings or errors.
- Six further AI-versus-AI development matches (seeds 33–38, two appearances per formation, production timers and one simulated second of aiming) all ended normally. Five reached six unlocks; all six ended by crew elimination. The sample included 17 construction actions and two attacks with self-damage after construction. This small fast-AI sample does not establish human pacing or competitive balance. On this host, sampled planner median/p95 was about 56/101 ms once per AI turn; physical iPhone rendering and two-device Wi-Fi play remain unverified.

## Fragile castles and frequent falls — 7 September 2026

- **72 automated tests pass** and syntax checks pass. Five new destruction tests prove multi-brick basic-rocket floor breaches, a shielded shooter falling at least 200 pixels and surviving with no more than 20 landing damage, mirrored destruction, repeated-hit reinforced durability, pre-blast crew/core shielding and unchanged body damage radius. Existing fixtures now use the current material health values.
- Changed only material durability and structural blast propagation: upper masonry 40→18 HP, reinforced lower masonry 100→65 HP, structural radius 1.8× the weapon radius, with per-material attenuation through intervening tiles. Body/core blast radius, damage, cover occlusion, fall/crush rules, geometry, controls and timers remain intact. The renderer scales cosmetic blasts to structural reach, within existing effect caps.
- A controlled public-state support-shot probe exercised both default weapons across all three formations for 12 alternating turns per formation/weapon. Before: 72 executed shots, 126 tiles destroyed, 5 collapse events, 15 shots with a ≥20px shooter drop. After: 69 executed shots plus 3 passes, 321 tiles destroyed, 12 collapse events, 54 shots with a drop. Surviving drops increased from 15 to 53; total deaths increased from 2 to 5. No simulation interruptions occurred. This is a targeted-support comparison, not a general player hit-rate or competitive-balance claim.
- The reusable probe and both measurements are in `.work/destruction-probe.mjs`, `.work/destruction-baseline.jsonl` and `.work/destruction-after.jsonl`. No-target turns advance the authoritative clock in small steps; an initial harness-only long clock jump was corrected and excluded from the reported results.
- Renderer smoke checks passed capped effects, reduced-motion rendering and effect retirement. A separate scoped review found no actionable defects in the destruction changes. Physical iPhone performance remains unverified.

## Floating barricades and 120-HP cores — 7 September 2026

- **89 automated tests pass** and `npm run check` passes. New coverage includes nine core-health tests, seven floating-barricade engine tests and one additional PvP integration test.
- Actual launched Basic/Lob Rockets destroy an exposed 120-HP core on the third direct collision, and legitimately unlocked Anvil Rockets on the second, from both sides. Core victory occurs exactly once, with surviving opposing crew. Intact walls shield the weaker core until breached; legacy fixtures use the current core health maximum.
- Both sides can place a barricade in the middle gap, above the opponent and in the uppermost legal grid row. Three physical 45-HP tiles spend one charge and one turn, stay at their coordinates across later actions, intercept projectiles, and can be destroyed. Removing the middle brick leaves the other floating bricks in place.
- Invalid overlaps, underwater placements, off-grid/nonfinite coordinates and battlefield bounds reject atomically. Other kits retain their region and anchoring rules. Shooters standing on the highest floating cover still drown together by the sixth tide.
- Two real WebSocket clients receive identical floating tile state. Replaying a build command neither duplicates tiles nor spends another charge. The shared engine serves both PvE and PvP.
- A disposable 844×390 browser fixture rendered a midair barricade after actual `applyAction` and settling, with spent ammo and correct updated weapon copy. No console warnings/errors were reported. The fixture files were removed afterward. Physical-device testing remains outstanding.

## Separate shooter and core health bars — 7 September 2026

- The main HUD meter now sums living shooters' remaining HP against the maximum of all original shooters, retaining eliminated shooters in the denominator. A separate bronze core meter and numeric current/max values appear below; individual roster indicators remain visible.
- Browser fixtures used the real HUD renderer for partial health, an eliminated shooter, zero health and full health. Verified 165/300 crew = 55% independently of 40/120 core = 33.33%; the opposing team showed 200/300 and 90/120. Empty bars stayed 0/300 and 0/120; full bars were 300/300 and 120/120. Accessible progressbar values matched those numbers.
- Checked 844×390, 844×340, 932×430 and 1280×921 layouts, including a long opposing captain name. The shortest layout now keeps the turn callout below the HUD. No console warnings/errors were reported. Temporary fixture files were removed.
- JavaScript syntax checks and all 16 nearby server/input regressions pass. This change is presentation-only; simulation rules and damage values are unchanged.


## Planetary effects and core finale — 7 September 2026

- **113 automated tests pass:** 101 gameplay/network/input/audio tests plus 12 renderer/effects checks. Syntax checks include both new presentation modules. New coverage includes one-shot core-death events, overkill and fall deaths, mutual core destruction, winning cosmic hits, preservation of visual events during heavy masonry damage, exact deadlines, and unchanged ordinary/noncombat results.
- A real two-client WebSocket test destroys a core, verifies identical finale metadata on both seats and a reconnected seat, rejects an early rematch, and accepts it after the 3.2-second deadline. The winning decision remains immediate.
- Renderer checks exercise each planetary/core animation in normal and reduced motion, finite Canvas coordinates, caps, pulse merging, duplicate snapshots, wall-clock expiry, resumed timelines, no repeated charge audio, removal of the destroyed core sprite, and cleared effects on rematch. Audio checks cover distinct sound scores, the 580 ms core rupture, bounded pulse/satellite accents, 36-voice limits, immediate mute and source cleanup.
- Temporary browser fixtures ran the real application UI and renderer against controlled result snapshots. Core and simultaneous-core results remained hidden at approximately 3.08–3.10 seconds and appeared by 3.44 seconds. Controls stayed inactive during the finale, and fresh matches restored the normal view. Planetary finishes used their shorter shared deadlines. All inspected tabs reported no warnings or errors.
- Visually reviewed Moon shards at 844×390, Saturn rings at 932×430, Pocket Star at 852×393, core destruction at 1280×720 and 844×340, and a reduced-motion double-core finale at 844×390. These are desktop browser viewport checks; the existing physical-iPhone validation limits still apply. Temporary public review files were removed, and the local Node host was restarted with the new event contract.


## Floating kits, Anvil rebound and last-shooter finishes — 7 September 2026

- **140 automated tests pass:** the 139-test full suite passed, then the final Anvil drawing-order regression brought the focused renderer suite to 22. Syntax checks pass. Construction tests cover all four kits, both sides and all formations; exact original bounds plus two roof rows; stable bounds after collapse; persistent unsupported tiles; collisions, water and atomic invalid-placement rejection. The WebSocket construction test confirms shared floating cover.
- Ten Anvil tests cover first and smaller return impacts, identical impact coordinates, no wind drift, one ammo/turn, water cancellation, late-flight and tiny-resolution deadlines, predicted first contact, and a lethal secondary blast owning its own two-second finale. Core-health tests confirm that 120 HP still takes two direct Anvil launches.
- Fatal-blast tests link each lethal death to its source explosion, preserve mutual elimination and immutable results, exclude unrelated prior blasts and rubble/fall endings, and check exact two-second deadlines. Sudden-death single and mutual drowning receive one second instead. Renderer tests prove actual slowed motion, event deduplication, distinct cosmic artwork, reduced motion, late/reconnected snapshots and expired effect cleanup. Audio checks prove two gulp sounds and a trailing bubble finish within one second and resume only their remaining portion.
- Browser fixtures exercised the production application and renderer. At 844×390, an actual drag placed an unsupported Bridge Kit at the upper legal row; all three bricks remained floating after the action. Anvil snapshots showed a roughly 60-pixel rise and two explosions at exactly the same x/y, with radii 50.4 and 32.76. Its projectile now renders above its initial blast so the hop remains visible.
- The normal-rocket last-shooter result stayed hidden at 1.92 seconds and was visible by 2.18 seconds. At 932×430, drowning stayed on the battlefield at .98 seconds and showed results by 1.13 seconds. Controls stayed inactive through both endings and normal match UI returned for a fresh match. Inspected review tabs had no console warnings/errors. Desktop viewport checks do not establish physical-iPhone performance. Temporary public fixtures were removed and the host restarted with the updated rules.


## Unlimited sky trajectories — 7 September 2026

- **150 automated tests pass** and `npm run check` passes. Removed the upper/lower Y cutoff and flight timers; horizontal exits, impacts, water, splitting and terminal-result cleanup retain their behavior. Turns wait for all projectiles and damage pulses, then allow bounded debris settling.
- New sky regressions cover legal Lob shots above y = −500, continuous flights lasting over twelve seconds, both horizontal exits, Saturn children returning to ground or water, regulation overtime and exactly one water rise after a sudden-death shot completes. Anvil regressions confirm a full 700 ms rebound after an eleven-second flight, even with a tiny settling budget.
- The AI regression chooses a high Lob over an obstructed low route, passes above the former ceiling, survives beyond 4.2 seconds and hits the forecast enemy. The 12-second prediction horizon bounds advisory calculation only; it never expires live projectiles.
- Two real WebSocket clients observe identical airborne projectile state beyond 4.3 seconds, reject extra actions during flight, then receive the same impact and next turn. All 12 server integration tests pass.
- A disposable browser fixture at 844×390 used the actual application, renderer and engine. Its legal Lob reached y ≈ −708, remained tracked after 4.2 seconds, showed the existing upper-edge rocket marker, returned to hit enemy masonry and handed over the turn. No browser warnings/errors were reported. These are desktop viewport checks, not physical-iPhone testing. Temporary public fixtures were removed and the local host restarted with the updated simulation.
