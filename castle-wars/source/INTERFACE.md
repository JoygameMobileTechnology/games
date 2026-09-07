# Implementation contract

This implementation follows GDD.md, using its proposed balance values as initial tuning defaults. The Node.js server owns match state and runs the AI; browser clients submit actions and render snapshots. Shared simulation modules are browser-compatible ES modules without Node imports.

## Engine API

- `createGame({id, seed, firstSide=0, now=0, config={}, formationId?, excludeFormationId?})` returns a game containing `.state`.
- `tickGame(game, now)` advances authoritative time to monotonic milliseconds; fixed physics steps internally, bounded catch-up.
- `applyAction(game, side, action, now)` returns `{ok, reason?}`. Action has `kind:'fire'|'build', unitId, weaponId, angle, power, targetId?, x?, y?`. Angles in radians: right is zero; positive points DOWN. It only accepts the active unit, turn, inventory, etc. Server separately validates command identity and turnId.
- `snapshotGame(game)` returns the public serializable state described below.
- `getMuzzle(state, unit, angle)` returns `{x,y}` (unit is a unit record).
- `launchVelocity(weapon, power, angle)` returns `{vx,vy}`.
- `previewTrajectory(state, unitId, weaponId, angle, power)` returns an array of `{x,y}` points for the short guide. Shared physics used by client.
- `predictShot(state, unitId, weaponId, angle, power)` returns `{x,y,hitId?,points}` for the first impact (bounded pure helper for AI).
- `endGame(game, winner, reason, interrupted=false)` used for server disconnect outcomes.

`shared/content.js` exports `WORLD` with width, height, groundY, tileSize, gravity; `WEAPONS` keyed by id; `DEFAULT_WEAPONS` array of ids. Each weapon: `{id,name,kind:'fire'|'build', description, short, icon, color, pool, ammo, damage?,radius?, speedMin?,speedMax?, footprint?:{w,h},floating?:boolean,...}`. All game coordinates are pixels in canonical world. The arena is 2000×900, groundY 750, tileSize 28. `ARENA` exports mirrored castle, island, flag and build-region anchors; `RULES.predictionHorizonMs` is 12000 and bounds forecast computation only, never live projectile lifetime. Live projectiles have no height or age expiry; only x < −80 or x > 2080 removes them without collision. All tiles, units and cores use top-left x,y and w,h. Projectiles use center x,y.

Core health is `RULES.coreHp` (120); both `hp` and `maxHp` initialize from it.

Every construction kit has `floating:true`. `getBuildBounds(state, side)` returns `{x,y,w,h}` from the original `formation.bounds[side]`, extended upward by two tile rows and clipped at y=0. Bounds do not shrink with destruction. The entire grid-aligned footprint must fit within these bounds, above water, without overlapping a core, shooter or solid tile. Region violations return `OUTSIDE_BUILD_REGION`. Every constructed tile is a destructible floating anchor; support is not required.

Material tuning is owned by `MATERIALS`: 18-HP masonry and 65-HP reinforced initial tiles, with construction health supplied by each kit. `RULES.terrainBlastRadiusScale` is 1.8. Structural targets use that wider radius and multiply blast transmission through each intervening material; body/core targets retain the weapon radius and binary cover protection. All targets use the same pre-blast tile snapshot, making shielding independent of iteration order. Explosion events carry `radius` (body damage) and `terrainRadius` (structural reach/cosmetic scale).

## Public state

`{matchId,now,formation,phase,turnId,activeSide,activeUnitId,turnDeadline,regulationEndsAt,elapsed,round,completedTurns,wind,waterY,waterRise,suddenDeath,suddenTurns,lineup,unlockedCount,teams,tiles,projectiles,events,result}`

`formation` is `{id,name,description,bounds:[{x,y,w,h},...],islands:[{left,right},...],flags:[{side,x,y},...]}`. `shared/formations.js` owns three frozen blueprints and independent seeded selection. `formationId` forces an engine fixture; otherwise `excludeFormationId` avoids the previous layout on rematch. All collision geometry and spawns are mirrored by the engine. Formation selection does not change the arsenal or wind random stream. The renderer uses the selected bounds and banner positions.

`wind` is `{acceleration,level,changesAfterTurns}`: signed horizontal acceleration in world pixels per second squared, display level −7…7, and turns until the next change. It is seeded and shared by both players, changing after each two completed turns, including timeouts and sudden death. `projectileAcceleration(state, weapon)` supplies the same wind/gravity for simulation, preview and AI.

phase is countdown, aim, resolve, transition, water, or ended. `now` and deadlines are milliseconds; elapsed is active-match seconds. Include countdownEndsAt. `round` starts at 1. `lineup` is six ids. `unlockedCount` starts at 0 and maxes at 6. `teams` index corresponds to side 0/1; each team `{side,core:{id,x,y,w,h,hp,maxHp},units:[{id,side,order,x,y,w,h,hp,maxHp,alive,needsArc}],ammo:{weaponId:count},cursor}`. Unlimited ammo is -1. Flat `tiles` retain physical rubble with `{id,side,x,y,w,h,hp,maxHp,material,falling?,constructed?,floating?}`. Projectiles contain `{id,side,weaponId,x,y,vx,vy,r}`. Events are a bounded recent list with unique id, type (launch,explosion,damage,collapse,death,core-destroyed,plop,unlock,water,turn,result,build), x/y where relevant, and value/weaponId/side as needed. Result is null or `{winner:0|1|null,reason,interrupted,endedAt,presentation}`. `endedAt` freezes the combat clock. `presentation` is null or `{startsAt,endsAt,cores,explosions}`, using the same authoritative milliseconds as `now`. The arrays retain original effect event IDs/timestamps, even after ordinary events are trimmed. A `core-destroyed` event contains `{id,type,at,x,y,side,coreId}` and is emitted only when positive core health reaches zero.

AI uses a deterministic budget of up to 144 first-impact predictions plus at most five final aim-variation checks. It considers roof targets and lofted lanes for rear shooters, keeps defaults in the candidate budget, and rejects self-hits and unfinished trajectories. Seeded error still allows enemy-side ground/water misses. Planning runs once per AI turn on the host.

## Wire API

WebSocket endpoint `/ws`. Client sends JSON:

- `{type:'create',mode:'ai'|'pvp',name}`; AI creation starts a countdown immediately, PvP opens lobby.
- `{type:'join',code,name}`; room code uppercase 5 chars.
- `{type:'ready',ready:true}`, `{type:'rematch'}`, `{type:'leave'}`.
- `{type:'resume',code,token}` preserves a seat on refresh.
- `{type:'action',protocolVersion:1,matchId,turnId,commandId,sequence,action:{...}}`.
- `{type:'ping',sentAt}` -> pong.

Server sends `{type:'joined',roomCode,side,resumeToken}`, then `{type:'state',you:side,room:{code,mode,players:[{name,connected,ready}],rematch:[bool,bool]},state:gameSnapshotOrNull}`. Also `{type:'ack',commandId}`, `{type:'error',code,message,commandId?}`, `{type:'left'}`, `{type:'pong',sentAt,serverNow}`. Room codes and resume tokens are distinct. Snapshot contains all UI state and events. Server pushes every 100ms plus important transitions. Client should dedupe event ids. Server uses `performance.now()` for time; clients interpolate remaining time relative to snapshot arrival.

HTTP `/api/host` returns `{urls:[LANOrigin],port}` and `/api/qr?code=ROOM&origin=ENCODED_ORIGIN` returns a QR SVG for the join URL. `/health` returns status. Plain browser ES modules are served from public/ and `/shared/`. No bundler or runtime CDN.

## Acceptance approach

Node built-in test runner for engine/server. Browser interaction and real two-client WebSocket matches. Do not claim physical-phone testing if devices are unavailable. Preserve 240s regulation, 20s aim, complete airborne trajectories before turn progression, six shared unlocks, three cycling units, six extra sudden-death turns, water plop and simultaneous-rise draw. Do not add bonus modes or accounts. High-quality original cartoon rendering using native canvas primitives is appropriate for dynamic destructible game art.

## Final destruction presentation

Combat immediately enters `ended` and locks the winner. Clients keep the battlefield visible until `result.presentation.endsAt`, suppress action controls, then reveal the result and play its fanfare once. Core effects last 3200 ms; Moon/Star effects last 2400 ms and Saturn effects last 2600 ms from each original event. Reconnect resumes the remaining timeline without replaying expired effects. Rematch requests before the deadline return `FINALE_ACTIVE`. Noncombat disconnect/leave/interruption results have no presentation delay. Event overflow discards old damage events before action effects so a large blast stays visible.


## Rebound and crew-finish revisions

Anvil `reboundMs:700`, `reboundHeight:60`, `reboundDamage:45`, and `reboundRadiusScale:0.65` define its secondary impact. After the original 90-damage impact, its projectile carries `rebound:{x,y,startedAt,durationMs,height}`. It returns to that exact origin without wind drift, emits one smaller `child:true` explosion, and does not recurse. Its full hop completes even after a long incoming flight. Turns wait for all projectiles and scheduled pulses, then allow up to two seconds for debris settling. Sudden-death entry and water rises wait for that resolution too. Water contact cancels it with a plop; terminal results still stop gameplay immediately.

A blast damage/death event carries its original `explosionId`. Death events include `lastShooter` when that transition removes the crew’s final living shooter. `result.presentation.finish` is `{at,endsAt,event,events,deaths}` for fatal explosion victories, with exactly 2000 ms between at/endsAt. The renderer claims these event IDs before processing the normal stream and stretches 700 ms of impact motion over that interval. This overrides the ordinary planetary duration for a crew-only win. Optional `drowning:{at,endsAt,deaths}` instead lasts 1000 ms for a sudden-death drowning result, with bubbles and residual-age-aware gulp audio. Falls/rubble do not receive either crew-finish effect. A simultaneous core finale retains its longer deadline. All result variants remain authoritative, immutable across repeated snapshots, and recoverable on reconnect.
