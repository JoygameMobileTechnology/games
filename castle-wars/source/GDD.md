# Castle Wars Game Design Document

Version 0.2 | Working design incorporating owner answers | 7 September 2026

Castle Wars is a mobile artillery duel in which players cycle through inhabitants inside their castles, pull back with a finger and release to launch rockets and missiles. Blast through reinforced lower floors, collapse upper sections and expose the protected enemy core. Win by reducing that core to zero health or eliminating the opposing shooters. Building tools patch holes and create cover. A shared arsenal escalates after each pair of turns, with a different selected lineup between matches.

This document specifies a later Codex build; it does not request implementation now. Owner-confirmed rules are distinguished from provisional implementation and balance details. Regulation lasts four minutes. If neither side wins, rising-water sudden death adds up to six turns, three per side. This explicitly supersedes the original four-minute total cap. Numeric values are starting points for playtesting, not measured balance results. Castle Wars is a working title drawn from the project name.

## 1 Confirmed requirements

| ID | Requirement |
| --- | --- |
| R01 | Opposing castles attack each other using rockets and missiles. |
| R02 | Weapons fire from the active inhabitant inside each castle. Shooters cycle each turn and eliminated shooters are skipped. |
| R03 | Destroy the opponent’s castle or eliminate all its shooters to win. Protect your own castle and inhabitants. |
| R04 | Provide a selectable palette. Stronger weapons unlock after each pair of individual turns, one per player. Both sides receive the same sequence, selected differently between matches. Defaults have infinite ammo; powerful weapons have limited ammo, usually one charge or two for moderately strong weapons. Unused ammo is retained. |
| R05 | Four minutes of regulation, followed if necessary by six sudden-death turns. Water rises after each turn and covers the entire map by the sixth rise. Simultaneous final-team drowning in one rise is a draw. |
| R06 | Provide PvE against exactly one AI opponent. |
| R07 | Provide PvP over a local network, using Node.js to serve mobile devices on that network. |
| R08 | Use Worms Reloaded and Castle Busters as gameplay references. |
| R09 | Minimize assumptions, ask questions during design, and make the eventual implementation clear enough for Codex. |
| R10 | Turn-based slingshot input: drag a finger backward and release to fire. |
| R11 | Use a 2D side view with breakable castles. Reinforced lower floors are harder to penetrate but can be destroyed, causing upper sections to collapse. |
| R12 | Castle destruction means reducing a protected, visibly health-metered core to zero HP. |
| R13 | Occasionally unlock bridge or platform building weapons that place physical cover for shooters or the core. |
| R14 | Use mobile browsers with a computer running Node.js on the same LAN for both PvE and PvP. |
| R15 | Comical cartoon destruction in landscape orientation. |
| R16 | Each player has 20 seconds to take an action. Both see its resolution, then the opponent's turn begins. Each castle starts with three shooters. |
| R17 | Falling shooters take minor damage; shooters hit by or trapped under rubble take high damage or can die instantly. |
| R18 | Show a short dotted opening arc while aiming. Projectiles touching water disappear with a comic plop; underwater targets cannot be shot. Core destruction remains a valid win during sudden death. |

### Reference interpretation

Worms Reloaded supports the direction of turn-based artillery, selectable comic weapons and opposing forts. Its official store page calls the relevant mode Forts or Fort mode. This GDD does not assume that all Worms mechanics belong in this game. [Worms Reloaded on Steam](https://store.steampowered.com/app/22600/Worms_Reloaded/)

Castle Busters supports the direction of destructible castles, unit placement and victory through either castle destruction or unit elimination. Its developer describes those two victory routes; its Google Play listing describes real-time combat. These references therefore leave the pacing choice open. [Developer description](https://epicoro.com/en/projects/castle-busters/) · [Google Play listing](https://play.google.com/store/apps/details?id=com.epicoro.castleclashers)

The supplied [AppMagic link](https://appmagic.rocks/google-play/castle-busters/com.epicoro.castleclashers) returned no readable description during research. The primary sources above were used instead. References inform mechanics and pacing; the proposed names, characters, castles, interface, sound and art are original.

## 2 Confirmed decisions and remaining choices

The owner answered the initial design questions. These decisions are confirmed and override earlier proposals.

| ID | Decision | Confirmed direction |
| --- | --- | --- |
| D01 | Combat and input | Alternating turns; pull backward and release to fire |
| D02 | Perspective and destruction | 2D; breakable lower supports cause upper collapse; lower material is tougher |
| D03 | Weapon progression | Symmetric unlock after two individual turns; a selected lineup varies between matches; unused ammo retained |
| D04 | Delivery | Browser clients; computer Node.js host for both modes |
| D05 | Castle defeat | Protected core reaches zero health |
| D06 | Shooter control | Three inhabitants; automatic turn cycle; killed shooters are permanently removed; falls hurt and rubble can crush |
| D07 | Endgame | Sudden death starts after four minutes and lasts at most six extra turns; simultaneous drowning is a draw |
| D08 | Defense | Limited-use construction weapons in the shared unlock sequence; using one is the turn's action |
| D09 | Art and orientation | Comical cartoon destruction in landscape |

The owner has also confirmed the 20-second action window, immediate progression after resolution, three shooters, minor fall damage, dangerous rubble, a short aiming arc and core victory during sudden death. The phrase “two rounds, one for each player” is interpreted as two individual turns, called a paired round throughout this document. This latest clarification replaces the earlier every-personal-turn wording.

The owner confirmed six selected advanced entries per match, ending in an absurd weapon. After all six unlock, players use their retained ammo and infinite defaults; there are no further grants. Remaining proposals requiring later review are the final regulation input cutoff, precise balance values and one AI difficulty. The latest owner request removes all projectile height and lifetime limits; target phones are confirmed below. Do not infer a campaign, permanent progression, voluntary shooter movement or a castle editor from the references.

## 3 Intended experience and initial scope

The player chooses between breaking into the core chamber, shooting an exposed inhabitant, undermining a lower floor and placing cover. The automatic shooter cycle changes the available launch angle each turn. Destroying an enemy floor can open a route, injure its inhabitants and leave survivors buried beneath falling masonry. Stronger weapons steadily make these exchanges more ridiculous.

The proposed first playable scope is one mirrored arena, three pre-designed castle formations selected per match and mirrored for both sides, three mechanically identical shooters per team, two default weapons, a sequence of advanced offensive and construction weapons, one AI difficulty and two-player LAN rooms. Mirrored geometry and a shared unlock sequence make balance easier to inspect. Castle layout, health, materials and weapon values are data rather than hardcoded exceptions.

The owner has confirmed three shooters and in-match building tools. A pre-match castle editor, voluntary unit movement, unit classes, campaign, permanent upgrades, accounts, currencies, shops, advertisements, public matchmaking, spectators and native app packaging remain outside the proposed first-build scope. PvE initially means repeatable skirmishes against one AI, not a campaign. Confirm any later additions separately.

### Core loop

1. Open the LAN URL and choose AI Skirmish or LAN Duel.
2. Enter with a protected core, three shooters and the same unlock sequence as the opponent.
3. The next living shooter in the cycle becomes active; receive a shared unlock when a paired round completes.
4. Choose an unlocked weapon. Pull backward and release to attack, or place an available construction tool.
5. Both players watch the shot, damage and falling structure resolve.
6. The opponent takes its turn. Continue as weapons become stronger and cover changes.
7. At four minutes, enter six-turn rising-water sudden death if no side has won.
8. Show the result and offer a fresh match or rematch.

## 4 Match rules and time limits

The 20-second action window, immediate progression after resolution and sudden death after four minutes are confirmed. Resolution budgets and detailed phase-boundary rules below are engineering proposals, identified so they can be tuned without silently changing the game.

### Turn sequence and shooter rotation

One round pairs one turn from each side. The server randomly selects the starting side; swap it on a rematch. Keep each team's roster in a stable spawn order, proposed as lowest position to highest. Its first turn uses its first living shooter, its next turn uses the next living shooter, and so on, wrapping and skipping dead units. A surviving shooter retains its roster position after falling. With one survivor, that shooter acts every personal turn.

The server advances the roster cursor when a turn ends, whether the player attacked, built or timed out. It never rotates to a dead shooter. Players may inspect other inhabitants but cannot choose a different active shooter. There is no voluntary walking in the initial profile. A completed pair of turns, rather than a successful hit, advances weapon progression.

Each turn provides up to 20 seconds to choose a weapon and commit its action. Releasing a valid slingshot drag commits an offensive shot. Using a construction weapon consumes the same single action and its ammunition. Palette browsing and aiming do not spend the action; their time counts against the 20 seconds. Invalid input does not spend ammo or extend the deadline. Timeout passes the turn without firing or spending ammunition.

After commitment, disable further action input. Both players watch the authoritative projectile, explosion and collapse. Begin the opponent's turn as soon as gameplay effects resolve. Do not fill the unused aiming time with forced waiting. An inactive player may inspect the arena and weapon descriptions but cannot attack or place cover.

### Regulation and transition

The regulation clock begins when the first aiming turn becomes available, after a proposed four-second countdown. It lasts 240 seconds. The server owns this clock; menus, disconnections, inactive tabs and animations do not pause it. Show both the current action timer and regulation time remaining.

Projectile flight has no height or lifetime limit. A shot above the visible sky continues under gravity and wind until it collides or exits the left/right arena bounds. Keep the action in resolution until every projectile, child, rebound and scheduled damage pulse completes. Afterward, allow up to two seconds for remaining structural settling before deterministic adjudication. Cosmetic particles may fade afterward without blocking the next turn or changing damage.

The implementation stops accepting regulation actions at 234 seconds and clips the final aiming timer to that cutoff. If there is no action to resolve, show the approaching-water warning until 240 seconds. Do not start a new regulation aiming turn after the cutoff. If a committed shot is still airborne at 240 seconds, finish its full action before entering sudden death. The six-second input cutoff remains an implementation choice; it is no longer a projectile lifetime or action-resolution ceiling.

Track the next entitled side and roster cursor explicitly at the boundary. If the current turn committed an action or timed out at the cutoff, that turn ends and the other side begins sudden death. Do not manufacture an extra empty regulation turn or restart a spent turn. If an effect destroys a side before sudden death starts, end the match normally.

### Sudden death and water

At 240 seconds, or after a still-resolving regulation action finishes, enter sudden death and retain current damage, positions, ammunition, shooter order and unlock progression. The next entitled side acts first. Play at most six individual turns, alternating sides, so each gets three opportunities unless the match ends earlier. Every turn still has the 20-second action window and counts toward the next shared unlock.

After each sudden-death action resolves, or after an idle turn times out, raise water once. Predefine six monotonically increasing water heights from just below the arena ground to above the highest legal shooter or building position. Proposed heights are equal sixths of that vertical span; tune them with the castle layout. The sixth rise must cover the entire playable map. Never allow construction outside that final height limit.

Display the next waterline before each turn. Water is lethal when its new level reaches a shooter's marked head point; it bypasses health, cover and construction. At each rise, evaluate all shooters against the new waterline and eliminate them in one batch. If both teams lose their last shooters in that same rise, declare a draw. If only one team loses its last shooter, the other wins. Do not adjudicate temporary height order during the water animation, which would contradict the confirmed simultaneous-drowning rule.

A shooter falling into existing water is also eliminated when its head crosses the current waterline; this does not wait for the next rise. Batch casualties within one physics tick as usual. Water cannot be blocked, repaired away or reset by a building tool. It does not directly damage the core. Construction can preserve elevated footing and cover, but cannot teleport or lift inhabitants. Core destruction remains a valid victory condition during sudden death, as confirmed by the owner. A submerged core is protected from shots by the water rule below.

### Projectiles and submerged targets

Water is a collision boundary for every offensive projectile. At first contact, remove the projectile with a small splash and funny plop sound, without explosion, penetration, splitting or later pulses. On equal-distance water and solid hits, water takes priority. A cluster child obeys this independently; projectiles newly engulfed by a rise also disappear. Rate-limit overlapping plop sounds without changing collision outcomes.

Submerged targets cannot receive projectile or blast damage, including splash from a nearby above-water explosion. Damage queries require an exposed target point above the waterline and an unobstructed path that does not cross water. A partially submerged core can still be hit on an exposed portion; a fully submerged core cannot. Pulses already scheduled below the new waterline are canceled. Water does not remove solid rubble or core collision, but projectiles cannot travel through water to reach them. Structural impacts remain a separate damage source.

### Maximum duration and result rules

| Phase | Duration contract |
| --- | --- |
| Opening | Proposed four-second countdown |
| Regulation | Four minutes of elapsed active-match time |
| Action choice | Up to 20 seconds each turn |
| Action resolution | Complete all airborne shots and damage pulses, then up to two seconds of structural settling |
| Sudden death | At most six turns, with full shot resolution before each water rise |
| Result presentation | Core destruction: 3.2 seconds; fatal shooter blast: two seconds; drowning: one second |

Regulation targets four minutes followed by at most six sudden-death turns. Uncapped flight can extend individual actions and the regulation transition; there is no fixed wall-clock match maximum. Do not advertise this ruleset as a four-minute maximum game.

A side loses when its core reaches zero HP or every shooter is eliminated. A detached or fallen core is not automatically destroyed. Apply all damage and support consequences belonging to one authoritative tick before checking defeat. If both sides are defeated in that tick, declare a draw; otherwise the first resolved defeat ends the match. Freeze gameplay after the result so late projectiles cannot reverse it.

The six water rises guarantee a terminal survival result by the end of sudden death. Never use elapsed match time to delete an airborne shot or force the next water rise. A suspended host or unresolvable collapse still interrupts the match rather than inventing a health tiebreak. Physics fallback behavior is specified in section 5.

## 5 Castles and inhabitants

### Protected core and reinforced lower floors

Use a side-on arena with opposing castles and a gap. The first arena has indestructible neutral ground and a bounded building region for each team. Fit both castles within the normal landscape view; allow inspection zoom without hiding the aiming controls. Decorative scenery has no collision or structural support role.

Each castle has a central core with a visible health bar, surrounded by several layers of destructible material. The core starts with 120 HP; each shooter starts with 100 HP. Core defeat means HP reaches zero. Detachment, falling, submersion and losing a particular percentage of walls are not substitute defeat conditions.

| Material | Proposed HP per tile | Penetration resistance | Purpose |
| --- | --- | --- | --- |
| Upper masonry | 18 | 1 | Breakable rooms, walls and floors |
| Reinforced lower masonry | 65 | 3 | Tougher foundations and core approaches |
| Constructed bridge | 45 | 1 | Narrow cover and replacement support |
| Constructed terrain | Per kit in section 7 | 2 | Compact cover and patching breaches |

Resistance is a game value spent by penetrating projectiles, not real-world engineering. Construction HP is authored once in each kit definition; the material supplies its resistance and collision behavior. Ordinary blasts damage all these materials; no player castle tile is invulnerable. Lower sections require repeated hits or later penetration weapons. Neutral ground is distinct in appearance and is the only indestructible foundation surface.

A default rocket cannot damage the core through several intact walls simply because its blast radius overlaps the core. Direct projectiles collide with material. For each blast, intervening intact structural material fully blocks damage to shooters and cores behind it. Structural tiles instead receive a wider, attenuated pressure wave: use 1.8 times the weapon blast radius for material damage, multiplying transmitted damage by 0.6 per intervening masonry tile, 0.3 per reinforced tile, 0.4 per constructed bridge tile, and 0.25 per constructed terrain tile. This opens multi-brick holes and removes firing floors without increasing the damage radius against inhabitants. Apply the explosion against one pre-impact geometry snapshot, then remove destroyed pieces. A subsequent pulse or projectile can use the newly opened hole. Penetrators explicitly spend resistance to breach material before detonating.

Show cracks and missing tiles so repeated shots visibly make progress. Keep health changes must correspond to an actual exposed path, penetration or physical impact. Core destruction triggers a comic whole-castle defeat presentation, but cosmetic destruction after the result cannot change the winner.

### Structural support and collapse

The first implementation should use a bounded tile structure with explicit intact neighbor bonds and dynamic falling chunks. Proposed cap is 160 structural tiles per starting castle. Validate that initial rooms, core and all shooters are supported and that each shooter has a usable launch aperture.

Find support paths through intact structural bonds to ground-contact material. When shots break tiles or bonds, detach components that no longer have a valid support path. Upper floors and their occupants then fall under gravity. Destroying enough low support must reliably collapse the connected upper section. One missing decorative brick must not count as a foundation collapse.

Detached components become server-owned collision chunks. They collide with terrain, supported castle structure, cores and shooters. Settled rubble remains physical obstruction and cover, with destructible health, until destroyed. Decorative fragments are separate cosmetic effects and never cause damage. The UI and art must make that distinction readable.

A fallen core moves with the collapsing structure and remains damageable at its new position. Its proposed own-landing damage is 10 HP per tile dropped beyond the first, capped at 60 HP per action. An incoming chunk can separately damage it using the chunk-impact bands below. These are distinct event types and must not count the same landing twice. Core health must actually reach zero before castle defeat. Do not snap it back into the original chamber or instantly kill it on detachment.

The physics prototype must establish a reproducible chunk split, support test and settling method before art production. Proposed limit is 32 dynamic collision chunks across the arena; merge adjacent fragments conservatively rather than dropping dangerous debris. Never remove a chunk touching a shooter merely to reduce load.

If a collapse has not settled within its two-second gameplay budget, use a deterministic downward sweep to its valid resting contacts, apply remaining impacts exactly once and settle it. If no valid nonoverlapping placement can be resolved, produce a logged interrupted match rather than deleting a core or trapped shooter. This is an implementation proposal to validate, not a claim that the solver already exists. Visual animation must agree with authoritative final positions.

### Shooter falls and crushing

Three shooters start at different vertical positions in each fortress. They automatically cycle in stable roster order. They cannot be revived or voluntarily moved in the first profile. Falling changes a survivor's world position but not its place in the turn order. A fallen shooter can fire from its current resting position when its turn returns.

Falling shooters take minor damage. Proposed formula is 5 HP for each tile fallen beyond the first, capped at 20 HP per action. This is intentionally less dangerous than being struck or buried by falling structure. Leaving the playable bounds eliminates a shooter; water uses its separate lethal rule.

Falling structural chunks can injure or crush inhabitants. Proposed impact bands, subject to playtesting, are 10 HP for a one-to-two-tile chunk, 50 HP for three-to-five tiles and 120 HP for six or more tiles after a fall of at least one tile. Apply the same incoming impact band to a core or structural tile directly struck by that chunk. A shorter fall causes no impact damage, although physical burial can still crush a shooter. Since a shooter starts with 100 HP, a heavy collapse can kill instantly. Small cosmetic particles do no damage. Combine repeated contact callbacks for one chunk impact against one target into one damage event.

A shooter physically trapped between settled rubble and a solid surface with insufficient space for its collider is crushed and eliminated. Being safely sheltered beneath an intact ceiling is not burial. Use authoritative collision geometry to distinguish the two. Camera feedback must show the fall or crushing cause rather than making health disappear without explanation.

### Shared damage behavior

Offensive explosions, penetration and falling structure can damage the owner's team as well as the opponent. Each impact has a unique event ID to prevent duplicate damage. Clamp HP at zero. A core is one damageable entity even if its collider spans multiple tiles.

For an unobstructed explosion, measure distance to the nearest point on the target collider and reduce damage linearly from the listed center maximum to zero at the listed radius. Round once after modifiers. Each tile receives its own damage; each cluster child or shockwave pulse is a separate event. Destroyed material and killed shooters cannot absorb or receive later duplicate damage as if still alive.

## 6 Slingshot controls and weapon palette

### Pull back and release

At turn start, emphasize the automatically selected living shooter. Touch its aiming handle and drag backward. The projectile points in the opposite direction to the pull; drag length sets power. Releasing a valid pull fires immediately. There is no separate Fire button and no tap-to-confirm after release.

Proposed normalized power is pull distance divided by the configured maximum pull distance, clamped from zero to one. Start with a 12 CSS-pixel dead zone and a 120 CSS-pixel full-power distance, then tune on real phones. Releasing inside the dead zone cancels without spending the action. Angle comes from the inverse drag vector. Mirror the starting aim direction for the opposing side but preserve the same physical gesture.

Show the pull band, arrow and power indication without covering the shooter. Show the confirmed short dotted arc for the initial part of flight, proposed as approximately the first third. Do not show a guaranteed landing point. Shots may hit friendly walls if obstructed, and the guide must reflect the same launch origin and collision geometry as the authoritative rules.

Capture the initiating pointer. A second finger, operating-system gesture, pointer cancellation, app backgrounding or losing capture must never accidentally fire. Provide a visible cancel area; releasing there cancels the pull. Palette dragging must not count as aiming. Mouse down, pull and release provide a desktop testing equivalent. Input accepted after a deadline is rejected with a clear timeout response, regardless of a late local animation.

Every offensive projectile starts at the active shooter's current muzzle. The client cannot supply a spawn point. Keep the muzzle clear of the shooter's own collider, but never teleport a projectile through a blocked wall. A guided weapon may add a target selection before the pull, not steering after commitment.

### Palette and unlock communication

Keep a compact quick-access strip for defaults, the newest unlock and construction, with an expandable palette for the full inventory. Show icon, name, behavior, ammo and current selection. Preview the next two unlocks, labeled by the shared paired-round boundary, and provide an expandable progression list. A long escalation sequence must not become a row of unreadable icons.

Differentiate available, selected, locked and empty with text or shapes as well as color. At each new unlock step, briefly announce the same unlock to both players without pausing the clock. Previously unlocked weapons remain usable while ammo remains. No construction tool is an extra action outside the turn system.

Selection closes the palette. The new weapon may be highlighted, but must not silently replace the player's selected weapon during a pull. If the selected weapon is spent, visibly return to the basic rocket on the next turn. Defaults always remain available.

## 7 Symmetric match arsenals and construction

### Unlock cadence and match selection

Both players begin with the default weapons. After two individual turns have completed, one by each side, unlock the next advanced entry for both players simultaneously. Repeat after every pair of completed turns. Timeouts and construction actions count as turns; hits and kills do not accelerate progression. This is the interpretation of the owner's latest “two rounds, one for each player” wording.

Before the match, the server selects one shared, escalating lineup from the weapon library. The same selected weapons, order and ammunition apply to both sides, including the AI. Different matches use different lineups, and no match includes the whole library. Use a server seed to reproduce a lineup and avoid an identical consecutive lineup where possible. Random selection happens during setup, not independently for each player's turn.

Each match contains six advanced entries, as confirmed by the owner. The proposed composition is an improved projectile, a light construction tool, a specialist missile, a stronger construction tool, an extravagant attack and an ultimate. Each slot draws one compatible weapon from its pool. This guarantees defense and escalating offense without requiring every library weapon to appear. The slot count is confirmed; the pool composition and individual weapons are design proposals.

An unlock grants the listed ammo once. Players can save it indefinitely within that match and select it on a later turn. Moderately stronger attacks may receive two shots; the largest attacks and construction tools usually receive one. Defaults remain infinite. Construction entries increase protection instead of damage and occupy ordinary advanced unlock slots, following the owner's clarification.

Keep lineup, unlock progress and unused ammo through sudden death. A partial pair at the phase boundary remains partial; do not grant a bonus unlock simply for entering sudden death. After the sixth advanced unlock, keep the available arsenal with its remaining ammo and stop further grants, as confirmed by the owner. Defaults remain available; rotating to a different shooter never replenishes a spent weapon.

### Proposed weapon library

Names, pools, order constraints and numeric balance are proposals. Damage is the unobstructed center maximum; radii are in tile widths. Pick one entry from each numbered pool. All offensive entries launch from the active shooter using the same slingshot gesture.

| Pool | Candidate weapon | Ammo | Damage or protection | Radius or footprint |
| --- | --- | --- | --- | --- |
| Default | Basic Rocket | Infinite | 60 damage | 1.5 |
| Default | Lob Rocket | Infinite | 60 damage; higher arc | 1.5 |
| 1 | Anvil Rocket | 2 | 90 damage + 45 on return | 1.8; return 1.17 |
| 1 | Pinball Payload | 2 | 85 damage; two bounces | 1.9 |
| 2 | Bridge Kit | 1 | Three tiles, 45 HP each | Three-by-one |
| 2 | Barricade Kit | 1 | Three tiles, 45 HP each | One-by-three |
| 3 | Drill Comet | 1 | 130 damage; penetration 3 | 1.8 |
| 3 | Signal Seeker | 2 | 140 damage; limited homing | 2.0 |
| 4 | Terrain Kit | 1 | Four tiles, 70 HP each | Two-by-two |
| 4 | Fortress Kit | 1 | Six tiles, 55 HP each | Three-by-two |
| 5 | Firework Flock | 1 | Five children, 55 each | 1.2 per child |
| 5 | Excavator Express | 1 | 280 damage; penetration 8 | 2.8 |
| 5 | Accordion Apocalypse | 1 | Three pulses, 100 each | 2.0 then 2.8 then 3.6 |
| 6 | Pocket Star | 1 | Five pulses, 100 each | 4.0 |
| 6 | The Entire Moon | 1 | 600 damage | 5.0 |
| 6 | Saturn Delivery | 1 | 220 impact plus four children of 100 | 2.5 then 1.8 each |

**Default rockets.** Basic Rocket is a predictable ballistic projectile. Lob Rocket trades horizontal speed for an easier high arc at the same damage. Both have infinite ammo. Their launch-speed ranges are content values to tune for useful trajectories across the arena. High arcs can leave the visible sky and return without a flight deadline.

**Anvil Rocket.** A heavy missile explodes on contact, then hops straight up 60 world pixels over 700 ms and returns to the same point for a smaller second explosion: 45 damage at 65% of the first radius. Wind does not move this hop. One launch spends one charge and turn. Water cancels the secondary blast; a terminal win stops gameplay immediately.

**Pinball Payload.** Bounce off non-water solid surfaces twice, then explode on the third contact. Proposed speed retention is 70 percent per bounce. A collision with a shooter or core detonates immediately. This gives an indirect route into rooms while preserving visible collision rules.

**Drill Comet and Excavator Express.** A penetrator spends its budget on crossed material resistance. If budget covers the next tile, destroy the tile, subtract its resistance and continue. Otherwise detonate on that surface. Never drill through cores, shooters, water or neutral ground. Budget 3 breaches one reinforced tile or three upper tiles; budget 8 can breach two reinforced tiles and two upper tiles. The late weapon has much stronger damage and splash.

**Signal Seeker.** Before pulling, optionally designate a living enemy shooter; default to the first living enemy in roster order. After 0.4 seconds, the missile steers toward it at a proposed maximum of 60 degrees per second. It still hits walls and water. If the target dies, continue on the current heading. There is no mid-flight player steering.

**Firework Flock.** Split at the apex, or at 1.2 seconds if no apex occurs, into five children in a fixed symmetric fan. Only children explode. If the parent hits a solid surface before splitting, produce one child-strength explosion and end. A water collision always produces only a plop. No child can split again.

**Accordion Apocalypse.** A telescoping missile generates three expanding impact-centered pulses at 0, 0.25 and 0.5 seconds. Each uses updated geometry, allowing an earlier pulse to break cover for a later pulse. Surviving targets may take damage from each pulse.

**Pocket Star.** A tiny rocket becomes a miniature star, emitting five pulses at 0.15-second intervals. Use exaggerated light and particles without introducing a separate gravity simulation. Collision, cover and the water rule still apply.

**The Entire Moon.** The active shooter launches a ludicrous moon-shaped missile with a large collision body and catastrophic blast. It can strike friendly cover and destroy the owner's castle. Its single blast remains occluded by intact material; it is not a guaranteed win or an off-screen strike.

**Saturn Delivery.** On a solid impact, a ringed missile deals its central explosion and emits four satellite rockets in a fixed outward fan. Each satellite can explode once. A parent lost in water emits none. Each satellite follows its full trajectory, with no inherited lifetime limit.

Parents and descendants have no age or vertical-position expiry. A projectile whose center crosses x < −80 or x > 2080 exits harmlessly; leaving the top of the visible arena does not remove it. Collisions, weapon-specific splitting, water and terminal match results retain their normal handling. All damaging effects finish before turn progression. Tiles already breached remain destroyed. New particles cannot create extra damage.

### Construction action rules

Construction kits are ordinary limited-use advanced weapons. Selecting and successfully placing one spends the active shooter's whole turn and one charge. Both sides receive the same selected kit in each construction slot. There is no bonus build plus shot, repair currency or free placement between turns.

Selecting a kit shows its grid-aligned footprint as a ghost. Drag it to a valid location and release to commit. Every kit can float anywhere inside its owner’s original castle rectangle, extended two block rows above the roof. No kit can be placed in the gap or enemy castle. The allowed bounds remain stable after destruction and appear as a dashed aiming outline. Invalid placement gives a clear reason, spends nothing and leaves the remaining action time available. Offer a cancel target. The active shooter performs the construction animation so the action visibly belongs to the current inhabitant.

Every placement must stay within its legal bounds and above water, and avoid overlapping any shooter, core or solid material. All four kits need no support and stay at their chosen position. Their individual tiles remain physical, destructible floating anchors and can support attached structure. Each complete footprint must fit within the original castle bounds plus the two overhead rows. Preview every tile's validity and place the complete footprint atomically.

Placed material has the listed health, uses the material resistance in section 5 and participates in collision, support, occlusion and collapse. It can patch a breach or support a floor before the next attack. It cannot restore core HP, revive units, overlap an enemy or lift a shooter by spawning inside it. Water ignores it. Reject placements intersecting current water; otherwise a legal platform may still be swallowed by the next rise.

### Balance validation

Record the selected lineup, core and shooter wins, crushing deaths, water wins, draws, match length, unlock slots reached and first-player win rate. Compare lineups rather than assuming equal rarity means equal strength. Check that all selected specialists can penetrate reinforced cover over repeated shots and that construction cannot create indefinite safety.

If ordinary matches end before interesting unlocks, tune early damage and cover. If every game reaches water, increase late pressure before changing the confirmed timing. Test saving limited ammo for a later shooter in the cycle. No balance results are claimed in this GDD.

## 8 PvE opponent

PvE uses exactly one AI controlling its own castle and three automatically cycling shooters. It has the same action window, arsenal, ammo, building rules, damage, water and victory checks as a human. It receives no hidden health, weapon or accuracy advantages. The Node.js host runs both sides' rules.

At turn start, the AI evaluates legal actions from the active shooter only. Consider exposed enemies, routes to the core, weakened lower supports, dangerous self-damage and useful cover placement. A bounded sample of weapon, angle and power candidates uses the same trajectory and occlusion logic as the simulation. Prefer a winning shot; otherwise score expected damage, structural access and survival. Construction is a real candidate rather than an unused player-only feature.

During sudden death, score the next waterline, likely collapse of high perches and elimination of surviving shooters. Do not waste a building kit on already submerged positions or assume it blocks water. The AI cannot move a shooter voluntarily or change the turn order to avoid flooding.

Proposed first difficulty is Normal, with configurable aiming error and occasional choice among several strong legal actions. It must not read the other player's unsubmitted pull gesture. Use a seeded random source to reproduce decisions. Error magnitude is a playtest value, not a promise of a particular win rate.

Show a brief aiming gesture and normally commit within two seconds. Cap planner candidates and elapsed computation so it cannot block the simulation. If planning fails, attempt a legal basic shot from the active shooter or pass. Log the fallback. Both modes use the same authoritative validation interface.

No mid-match pause, host-free offline mode, campaign or extra difficulty tier is implied. These remain later scope decisions. A server crash interrupts PvE just as it interrupts LAN PvP.

## 9 Screens and presentation

| Screen | Required information and actions |
| --- | --- |
| Start | AI Skirmish, LAN Duel, sound and motion settings |
| LAN lobby | Room code, join link or QR, two seats, connection state, Ready |
| Match | Core bars, crew health and order, active shooter, palette, pull guide, 20-second timer, regulation clock or water-rise counter |
| Palette | Selected match arsenal, next unlock, ammo, tool footprints and descriptions |
| Result | Win, loss, draw or interrupted; cause; surviving crew and core status; Rematch and Leave |

Keep the camera stable while pulling. Track flight only when needed, then show consequential collapse before returning for the next turn. The release gesture is the firing action; do not add a separate Fire button. Show the next shooter in each roster so automatic rotation is predictable.

At sudden death, replace the regulation clock with Sudden death, remaining turns and the next marked waterline. Distinguish blast, minor fall, crushing, drowning and core-destruction feedback. A water collision must produce a small comic plop, not an explosion that suggests damage.

Use at least 44-by-44 CSS-pixel controls as the proposed interface baseline and test on actual phones. Account for browser chrome and safe areas. A portrait rotate prompt must not pause the server clock. Do not require fullscreen or orientation-lock permission for core play.

Provide mute, reduced motion and screen shake, weapon text alongside icons, team shapes as well as colors, and clear turn and low-time cues. Begin audio after a user interaction. Large effects must not obscure surviving shooters, the aiming handle or the next waterline.

Use original comical cartoon inhabitants and exaggerated machinery. Initial assets are one arena background, material and rubble variants, core damage states, two team treatments for one shooter, weapon icons and projectiles, construction ghosts, splash/water effects and a small set of launch, impact, collapse, plop, unlock and result sounds. Prove gameplay with temporary art before producing the full set.

## 10 Node server and LAN architecture

### Hosting and joining

The confirmed delivery model uses a laptop or desktop running Node.js. The proposed implementation is one process serving the mobile browser client, bundled assets, lobby, AI, rules and authoritative simulation. The host may also run a player's browser, but does not need to be a participant. Opening the game on a phone does not make that phone a Node.js server. Native applications and host-free PvE are outside the confirmed delivery model.

The eventual repository should expose one documented startup command, proposed as `npm run dev:lan`, which serves both client and game connection from one LAN origin. Bind the development server explicitly to a LAN-accessible interface such as `0.0.0.0` and print actual interface URLs for joining, such as `http://192.168.1.20:3000`. That address is an example, never a hardcoded address. Phones must use the host’s LAN IP, not `localhost` or `0.0.0.0`. [Node.js server binding](https://nodejs.org/api/net.html#serverlisten)

Room flow is Create room, share URL or QR, join second seat, both Ready, countdown, match, result. The server rejects a third player. Rematch requires both human players to accept, resets all game state and swaps the first side. In PvE, the AI is ready automatically.

The QR contains a join URL and room code, never a reconnect credential. The phone’s native camera can open it; offer manual address entry as a fallback. Bundle fonts, images, sound and game code locally. After dependencies are installed, ordinary matches should require no internet service, login or CDN.

Use a Node WebSocket implementation with native browser WebSocket clients. The `ws` library is a candidate, not a locked dependency. Keep framework versions open until implementation, then pin and document the tested versions. [ws documentation](https://github.com/websockets/ws)

Ordinary HTTP on a LAN IP is not the browser’s secure localhost context. Core play must not depend on service workers, installability, in-page camera access, screen wake lock or other secure-context-only features. If those become requirements, specify trusted HTTPS and WSS delivery and test the target phones. [Secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts)

### State ownership and synchronization

The server owns simulation, collision, damage, inventories, unlocks, turn progression and the match result. Clients send intentions and render authoritative state, including water level, completed rises, automatic roster cursors and selected match lineup. They may preview aim and interpolate motion, but never decide damage or victory. The AI calls the same action-validation interface as a human.

Proposed simulation cadence is 30 fixed steps per second, with ordered gameplay events and state snapshots at 10 per second while actions resolve. Send an immediate state update for turn changes, unlocks, reconnects and results. Render locally at a target of 60 frames per second, with 30 acceptable on the eventual minimum device. These are prototype budgets, not measured performance claims.

Use swept collision tests for fast projectiles so they cannot tunnel through thin tiles. Server simulation can share trajectory functions with client previews without requiring every phone to reproduce physics deterministically. Use a server seed for any random choices. Structural rubble and crushing collisions are authoritative. Only cosmetic fragments are client-side presentation derived from destruction events.

Use a monotonic server clock for deadlines. On overload, deadlines remain real elapsed time rather than slowing with missed frames. Bound catch-up work and reject late actions; record an interrupted result if the host cannot maintain a trustworthy simulation. Host suspension beyond the deadline must not grant extra play on resume.

### Commands and data contracts

Every gameplay command includes `protocolVersion`, `matchId`, `commandId`, `turnId` and a monotonically increasing client sequence. The authenticated room seat comes from the connection session, never from a claimed player ID. Validate the expected browser origin, message type and payload size and rate-limit malformed or excessive traffic without logging reconnect tokens. The server acknowledges accepted actions or rejects them with a stable reason code and current state revision.

| Message | Minimum payload or meaning |
| --- | --- |
| createRoom and joinRoom | Mode or room code; protocol version |
| ready and rematch | Player readiness for the appropriate lobby or result state |
| fire | Shooter ID, weapon ID, angle, normalized power, optional target ID |
| placeConstruction | Active shooter ID, kit ID and grid-aligned placement anchor |
| resume | Opaque seat token and last received state revision |
| ack or reject | Command ID, accepted revision or reason code |
| snapshot | Complete state, lineup and unlock step, roster cursors, water level and rises, revision, server time and deadlines |
| events | Ordered projectile, damage, collapse, elimination and unlock records |
| matchResult | Exactly one winner or draw/interrupted status and reason |

Before applying an action, check phase, turn ownership, the automatically active living shooter, permitted weapon, unlock, ammunition, finite numeric values, angle and power bounds, optional target legality and the deadline; for construction also validate footprint, castle bounds, water and overlap. Reject duplicate command IDs without spending resources twice. A repeated acknowledged action returns its prior outcome. Old turn IDs cannot fire in a new turn.

Proposed state records are `MatchState` for phase, globally unique turn ID, sudden-death turn index, paired-turn progress, active side and shooter, roster cursors, water heights and rise count, deadlines, revision and result; `CastleState` for core, structural tiles and physical rubble; `UnitState` for owner, roster order, position, health and support; and `InventoryState` for the selected lineup, shared unlock index and remaining ammo. Weapon definitions contain behavior, damage, radius, lifetime and resource rules. Arena definitions contain geometry, tile types, core and spawn positions. Validate those content files at startup.

Keep simulation, server transport, client presentation and content in separate modules. Select rendering and physics libraries during the prototype against the confirmed 2D browser and Node.js requirements. Store balance values once rather than copying them into UI, AI and server code.

### Disconnection and background behavior

Mobile tabs may suspend rendering and throttle timers in the background. The server therefore continues the match clock independently, and a returning client must obtain a full snapshot before actions are enabled. [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)

Proposed reconnect policy: retain a seat for 10 seconds after detected connection loss, keep all match deadlines running, then award a disconnect forfeit to the connected opponent. A terminal gameplay result reached during grace takes precedence. If both players remain absent through their grace periods, interrupt the match without a winner. Do not add AI takeover. The timeout and forfeit policy needs confirmation before implementation.

Issue an opaque reconnect token when assigning a seat and retain it for refresh recovery within that browser tab. A reconnect replaces the old socket atomically; it must not create a second seat or accept stale queued shots. Detect half-open connections with server heartbeats and handle socket errors explicitly. [WebSocket connection behavior](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/WebSocket)

If the Node.js host exits, clients show Host disconnected and an interrupted match. They cannot invent a winner. The initial scope has no host migration or persistent recovery after server restart. Troubleshooting should explain same Wi-Fi, host firewall access, local-network browser permissions and Wi-Fi client isolation; test these on the chosen network and phones.

## 11 Build sequence for Codex

Preserve confirmed decisions and resolve remaining consequential proposals with the owner before building systems that depend on them. Record confirmed choices in section 2 and update conflicting rules, data and tests together. The GDD is the source of truth; implementation convenience must not silently redefine victory or delivery.

| Stage | Deliverable | Exit condition |
| --- | --- | --- |
| 0 | Agreed reference profile and target device list | Confirmed owner decisions preserved; remaining proposals reviewed or explicitly delegated |
| 1 | One local artillery exchange | Automatic shooter cycle, pull-release firing, cover, collapse and both victory routes demonstrated |
| 2 | Complete timed rules and arsenal | Shared selected lineups, paired unlocks, construction, water and time contracts work |
| 3 | PvE skirmish | One legal AI completes games without blocking the server |
| 4 | LAN duel | Two real phones join, play, reconnect and agree on one result |
| 5 | Mobile presentation and tuning | Target-device checks pass and basic balance problems are addressed |

Deliver the source, locked dependencies, a host startup guide, a content guide for weapons and castles, and instructions for running the focused checks. Build the simulation and its tests before expensive art production. Do not create unrelated backend services or native wrappers as part of this profile.

Suggested later implementation prompt: Read GDD.md, confirm the decision register, and implement the agreed stages in order. Preserve four-minute regulation, the six extra sudden-death turns and both victory routes. Ask when a missing product decision would change the core rules. Validate PvE and two-device LAN PvP before calling the game complete.

## 12 Acceptance and validation

These checks are evidence the later build must produce. They have not been run because this task creates a GDD rather than a game.

| ID | Acceptance condition |
| --- | --- |
| A01 | A valid backward drag and release fires from the automatically active living shooter's muzzle. Dead-zone release, cancellation and a second finger cannot accidentally fire. |
| A02 | Three shooters rotate in order, skip deaths and retain order after falling; an idle or construction turn also advances the cursor. |
| A03 | Reinforced lower tiles need more damage or penetration than upper tiles; destroying supports makes the connected upper section fall. |
| A04 | Intact walls protect the core from occluded blast damage. A breach exposes it. Only zero core HP causes castle defeat. |
| A05 | Falls inflict minor damage; heavy impacts and physical burial can kill. Ordinary overhead shelter does not falsely count as crushing. |
| A06 | Every selected offensive weapon follows its collision, damage, water and resource rules. Default ammo stays infinite; unused advanced ammo persists. |
| A07 | Both sides receive the same six-entry lineup and unlock at the same paired-turn boundary. No refill occurs after the sixth unlock. Different matches omit different library weapons. |
| A08 | Valid construction spends one charge and the action. Invalid placement spends nothing. New material provides physical cover and support and remains destructible. |
| A09 | Core defeat, final-shooter defeat and same-tick mutual defeat produce exactly one correct terminal result. |
| A10 | Regulation reaches zero at 240 seconds; an airborne action completes before sudden death starts, preserving the next entitled side. |
| A11 | Sudden death contains at most six individual turns, three per side, with one water rise after each. The sixth rise covers the legal play area. |
| A12 | A rise eliminating both teams' last shooters is a draw. Falling into existing water is lethal. Platforms cannot block or reverse water. |
| A13 | Every projectile touching water disappears with a plop and no damage or descendants. Submerged targets cannot receive projectile or blast damage. |
| A14 | Core destruction still wins during sudden death when the core has an exposed, hittable portion. |
| A15 | Exactly one AI follows the same shooter cycle, arsenal, building, water and timing rules and has a bounded planning fallback. |
| A16 | Two supported real phones complete a LAN duel through the documented Node.js startup and join flow. |
| A17 | Both clients agree on health, rubble, roster cursor, inventory, water and result after resolution and reconnect. |
| A18 | Duplicate, stale, malformed and opponent-owned commands cannot cause unauthorized actions, double spending or a crash. |
| A19 | Refresh, backgrounding, Wi-Fi loss, a third participant and host termination follow the specified recovery or interruption behavior. |
| A20 | After setup, assets and ordinary matches need no internet connection, remote content or cloud service. |
| A21 | Aim input stays bounded at 20 seconds; airborne shots cannot expire by age or height. Sudden death has at most six completed turns and waits for each shot before raising water. |
| A22 | Touch and presentation remain usable on the agreed phones, including the largest collapse and weapon effects. |

Use deterministic simulation tests for damage, occlusion, support, crushing, victory, water, timing and resource ownership. Use server integration tests for validation and reconnects. Use physical iOS Safari and Android Chrome checks for touch, browser chrome, audio, backgrounding and LAN access. Desktop emulation alone does not prove the mobile experience.

Stress 320 initial castle tiles, the dynamic-chunk cap, cluster children, pulses, repeated placements and maximum retained rubble. Set a named minimum phone before claiming performance. Proposed render target is 60 fps with 30 acceptable on that device; authoritative simulation should retain its 30 fixed steps per second. Instrument step duration and physics fallback usage.

Proposed cosmetic caps are 150 fragments and 200 particles per client at once, with reduced effects on slower phones. Cosmetic limits must never remove physical rubble or alter authoritative damage. If simulation cannot stay within its budget, reduce collision complexity or revise the prototype model explicitly; do not conceal the change in effects code.

For balance, start with at least 20 alternating-side human or supervised matches and a larger reproducible AI batch. Record lineup, initiative, duration and victory cause without claiming statistical certainty from the small sample. Investigate unreachable arcs, early collapses that dominate every match, weak building tools and water timing advantages. Stop expanding scope when the approved design and acceptance conditions are met.

## 13 Remaining review items

The owner has answered the core gameplay and arsenal questions. Preserve those answers in implementation: six shared advanced unlocks per selected lineup, no ammunition refresh after the final unlock, and infinite defaults. The remaining items below are explicitly proposed details for the implementation review.

The following are explicit design or implementation proposals, not hidden assumptions:

1. A six-second final regulation input cutoff. Projectile travel is uncapped per the latest owner request; a long shot delays sudden-death entry until its action completes.
2. A bounded tile-and-chunk collapse model with the proposed material values, support rules, crushing bands and deterministic settling fallback.
3. One mirrored arena, three pre-designed formations selected per match, and no voluntary shooter movement or pre-match editor. The formation variety is now owner-confirmed.
4. One Normal AI difficulty with tunable error and no campaign in the first build.
5. Ten seconds of reconnect grace followed by forfeit, no AI takeover and interruption when the host is lost.
6. Target Chrome on iPhone 12 and newer, with scalable landscape layouts for Pro and Pro Max. Physical-device validation remains necessary.
7. Proposed weapon names, candidate pools, damage, ammunition and construction footprints, which require playtesting.

Codex should ask about consequential departures, explain the tradeoff and update this document. Silence does not convert these proposals into confirmed requirements. Routine technical choices may be delegated after the owner reviews the profile.


## Implemented playtest revision — 7 September 2026

The owner requested more convoluted symmetrical castles, distinct team artwork, stronger explosion feedback, reliable partial-power release, wind changing after one turn per player, and greater castle separation. This revision supersedes earlier arena/presentation defaults.

- The canonical arena is 2000×900. Physical castle layouts mirror exactly, with a rear watchtower, staggered firing galleries, crosswalks, braces, mezzanine and reinforced vault chambers. Moss Guard and Cinder Crew use distinct decorative materials and heraldry without changing collision geometry.
- Authoritative wind has fifteen levels (−7 through +7); each level applies 10 world pixels/second² of horizontal acceleration. Both players use the same wind for a pair of completed turns, then a different seeded level is selected. Timeouts, construction and sudden-death turns count. The HUD shows direction and strength; trajectory previews and the AI use the same force.
- Superseded by the unlimited-sky revision below: projectile travel no longer has a height, age or action-resolution expiry, including child projectiles.
- Release always samples the final pointer position, including short drags with no intermediate move event. Clearing pointer capture cannot cancel a shot already being released. A tap or a release within six screen pixels of the starting point cancels; partial power above that deadzone fires normally.
- Explosion presentation scales with weapon radius, using local impact flashes, fireballs, expanding shockwaves, sparks, smoke, debris, recoil and layered audio. Reduced-motion and screen-shake settings remain respected.


## Pre-designed formation revision — 7 September 2026

The owner confirmed different pre-designed formations between matches, with wind and viable trajectories for shooters positioned behind castle cover. This supersedes the single-layout proposal and the previous watchtower/gallery blueprint.

- **Twin Keeps:** unequal watchtowers joined by a firing bridge, a vaulted hall and a recessed courtyard shooter.
- **Bridge Fort:** a broad viaduct with deep arches, gatehouses and a protected courtyard battery.
- **Crown Citadel:** a crowned central keep, a raised rear outpost, nested halls and a low forward shooter.
- Select one formation on the host using the match seed, independently of weapon/wind selection. Mirror every physical tile, shooter and core for the opposing side. Team materials and heraldry differ cosmetically. Both clients receive the same formation metadata. Rematches exclude the previous formation.
- Preserve the 1,048-world-pixel gap between the front castle edges, three shooters per team, protected 120-HP cores, destructible lower armor and construction rules. Initial structures must support themselves under the normal gravity solver.
- Every starting shooter must have at least one enemy-reaching arc with each infinite default weapon at both wind extremes, through the intact castle geometry, including trajectories above the visible sky. A shallow shot may hit the shooter's own wall, and full power may overshoot; varying power and elevation is part of the skill requirement.
- Show the formation name under the round number and an aiming hint for rear positions. Retain only the short dotted initial-flight guide. A live-rocket marker at the upper scene edge tracks an actual projectile above the screen, without revealing its future landing point.
- The AI considers lofted routes and roof targets using the same public geometry, wind and trajectory simulation. Its seeded aim error may miss but must not turn a validated starting firing lane into an immediate own-roof collision or a trajectory with no useful predicted landing.


## Easier destruction revision — 7 September 2026

The owner requested much easier castle destruction and frequent shooter falls. Upper masonry is now 18 HP (previously 40); reinforced lower walls are 65 HP (previously 100). The lower walls remain tougher than upper floors, and a fresh reinforced tile survives one ordinary direct basic-rocket hit.

Every explosive attack applies a structural pressure wave with 1.8 times its normal damage radius. Intervening material attenuates that wave rather than completely blocking it, so one hit can break several adjacent floor bricks and disconnect supports. Visual impact clouds reflect this larger structural reach. Shooter/core blast damage and range, pre-blast cover protection, protected core health, formations, physical rubble and timing remain unchanged. Minor landing damage remains capped at 20 HP per shooter per action; heavy falling rubble and burial retain their separate lethal rules.


## Floating barricades and vulnerable cores — 7 September 2026

The owner requested unrestricted barricade placement and confirmed that unsupported barricades should stay in midair as floating cover. Barricades now use the whole battlefield rather than a team's build region, with no support requirement. They still snap to the grid, must fit above ground and water without overlapping occupied space, spend their normal single charge and action, and have three destructible 45-HP bricks. Their floating anchor survives removal of adjacent support; destroying the barricade can release other structure resting on it. Other construction kits retain their support and region rules. The final flood still covers the highest legal supported shooter position.

Core health is reduced from 300 to 120 HP. An exposed core now takes three ordinary direct Basic/Lob Rocket hits or two direct Anvil Rocket hits under the existing collision and blast-falloff model. More powerful weapons may destroy it in one hit. Intact castle walls still shield the core, water still protects submerged targets, and victory still requires the core to reach zero HP or all opposing shooters to die.


## Separate crew and core HUD — 7 September 2026

Each team's main health bar represents the cumulative remaining health of all three original shooters, divided by their combined maximum health (normally 300). Eliminated shooters contribute zero health while remaining in the denominator. Show current/max HP numerically. Directly below, display a separate labeled core-health bar in a distinct warm shade, with its own current/max HP (normally 120). Retain individual shooter health and active/next indicators beneath both meters. Both sides use the same hierarchy; health bars have accessible names and values.


## Planetary impacts and core finale — implemented revision, 7 September 2026

The Entire Moon breaks into cratered lunar shards and icy dust. Saturn Delivery sends tilted gold rings sweeping outward with satellite trails. Pocket Star blooms into a miniature supernova with a corona, rays and accents for its actual damage pulses. These effects and their sound signatures are cosmetic; blast damage, projectile children and ammo rules stay authoritative.

A core reaching zero HP emits one destruction event at its actual position. The crystal charges and cracks for 580 ms, ruptures into gold and team-colored fragments, then fades over a total 3.2 seconds. Its intact sprite disappears. Both players remain on the battlefield with actions disabled until the finale ends, then see the result and hear its fanfare. A planetary hit that eliminates the last shooter also completes its effect before results. Simultaneous core destruction animates both cores and retains the draw. The winner is locked immediately; presentation adds no combat time. Reconnect resumes the same timeline, and rematches wait for its end. Reduced motion uses calmer fading emblems and fragments; effect counts and sound voices are bounded for mobile rendering.


## Construction, Anvil rebound and crew endings — latest revision, 7 September 2026

This revision supersedes the earlier unrestricted Barricade rule: all construction kits now float, but only within the owner’s original castle rectangle plus two rows above its roof. Placement stays atomic and consumes its existing charge and turn; water and occupied spaces remain invalid. The Anvil impact-and-return behavior is defined above.

When an explosion deals the killing blow to the last shooter, that exact blast plays in slow motion for two seconds before victory/defeat appears. Nonfatal explosions keep normal speed. The host locks combat and the winner immediately; clients slow the visual impact, sparks and casualty presentation, using its authoritative event ID and deadline. Planetary fatal blasts retain their distinct artwork but use the same two-second crew finish.

Per the owner’s clarification, falling rubble and ordinary falls do not get slow motion. A sudden-death drowning ending instead plays one second of “glup glup” audio with bubbles before results. Both last crews drowning still draws. Core destruction retains its existing 3.2-second finale, including when it overlaps a crew defeat. Rematches wait for presentation to finish; reconnect resumes the remaining time without replaying effects or sound.


## Unlimited sky trajectories — latest revision, 7 September 2026

The owner confirmed that shots must never despawn because they travel high above the screen. Remove vertical out-of-bounds checks and projectile flight timers for every weapon and descendant. Preserve the existing horizontal exit margin, collisions, water plops, weapon-specific splitting and terminal-match cleanup. Keep the offscreen rocket marker visible while a shot is above the scene.

Wait for the entire action before rotating shooters, accepting another shot or raising water. A long regulation shot may finish after the four-minute clock reaches zero; sudden death then begins with the next entitled side. The AI may choose high arcs. Its 12-second forecast horizon limits planning work only and is never applied to the live simulation.
