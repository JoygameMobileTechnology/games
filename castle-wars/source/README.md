# Castle Wars

A landscape browser game for phones: take turns launching comic rockets from three castle inhabitants, collapse enemy masonry, protect your core, and survive the rising water. Play against one AI or another player on the same local network. A computer runs the Node.js host and owns the simulation for both modes. The target browser is **Chrome on iPhone 12 and newer**, including Pro and Pro Max models, in landscape orientation.

## Run

Requires **Node.js 22 or newer** and npm. From this directory:

```sh
npm install
npm run dev:lan
```

Open **http://localhost:3000** on the host computer. On a phone, open the host's LAN address printed by the server, such as `http://192.168.1.20:3000`. Both devices must use the same local network. Keep the terminal and host computer running during play.

The game serves its code and artwork locally. Internet access is needed to install dependencies; ordinary matches do not need a cloud service, account, or CDN. `npm start` also starts the host; `npm run dev` restarts it when server files change.

## Play

- Choose the AI skirmish for solo play. The host runs the opponent, with the same weapons, ammunition, turn rules, and damage rules.
- For LAN PvP, create a room and share its join link or QR code. The other phone opens that link, or opens the same host address and enters the room code. Both players ready up to begin. A room has exactly two player seats.
- Each team panel shows combined shooter health in the main bar (out of the original 300 HP), with a separate core-health bar below it (out of 120 HP). Individual shooter indicators show health and turn order.
- Use landscape orientation. The highlighted inhabitant takes the current turn; surviving inhabitants cycle automatically. There is no walking or manual shooter selection.
- Select a weapon, pull backward from the active shooter's aiming handle, and release to fire. Pull length sets power. The short dotted arc previews only the beginning of the flight. A shot can hit your own castle. Short pulls work too; return within the small starting deadzone or release in the cancel circle to cancel.
- Each match selects Twin Keeps, Bridge Fort or Crown Citadel: different towers, arches, courtyards and shooter positions with exactly mirrored geometry. Rear shooters need higher arcs over their own cover; adjust power as well as angle. Shots can rise as high as their trajectory takes them: there is no sky ceiling or flight timer. A small marker follows a live rocket above the screen until it returns. Only crossing a left/right arena boundary removes a shot without collision.
- Watch the wind arrow and its strength from 0–7. Wind stays fixed for one turn per player, then changes for the next pair. It affects rockets, the dotted aiming guide, and the AI. The castles are farther apart, so angle, power and wind all matter.
- A turn gives you **20 seconds** to act. After your single action resolves, the opponent plays. Letting the timer expire passes the turn without spending ammunition.
- Every construction kit places floating cover inside your castle’s original rectangular footprint, with two extra block rows above its roof. The dashed preview outlines this area. Choose an empty spot above water; no supporting wall or floor is required. The gap and enemy castle are outside your construction area. A valid placement uses the whole turn and one charge; an invalid placement spends nothing.
- Anvil Rockets explode on impact, hop straight up, then land at the same point for a smaller second explosion. Each launch spends one charge; the hop ignores wind.
- Destroy the enemy core or eliminate all three opposing shooters to win. Cores have 120 HP: three direct basic/lob hits or two direct Anvil hits destroy an exposed core. Stronger weapons can do it faster. Ordinary rockets tear multi-brick holes through fragile upper floors, dropping shooters and collapsing disconnected sections. Reinforced lower walls remain tougher, but repeated hits break them too. Falling causes minor damage, while falling rubble can crush shooters.

Both players receive the same six advanced unlocks, one after each pair of turns. The selection varies by match and ends in an absurd weapon. Basic weapons have infinite ammunition. Advanced weapons usually have one or two charges; unused charges remain available, and no ammunition refills after the sixth unlock. Construction is part of this shared progression.

Regulation lasts **four minutes**. If the match is unresolved, sudden death adds at most **six turns**, three per side. Water rises after each turn and covers the playable map on the sixth rise. Drowning the last shooters of both teams in the same rise is a draw. Shots disappear on contact with water with a plop, so submerged cores cannot be hit. Any airborne shot and its follow-up impacts finish before the next turn or water rise. A shot still in flight at four minutes finishes before sudden death begins, so long arcs can extend match time.

The Entire Moon shatters into cratered fragments, Saturn bursts into sweeping rings and satellite trails, and Pocket Star erupts in a pulsing supernova. Destroying a core triggers a 3.2-second crystal-charge, fracture and explosion finale. Both players watch the battlefield before the result screen and fanfare appear; an explosion that kills the last shooter instead plays in slow motion for two seconds, then shows the result. Sudden-death drowning uses a one-second “glup glup” finish. Rubble-only crew deaths remain immediate, and core destruction retains its 3.2-second finale if conditions overlap. Combat is already over during these cosmetic seconds. Reduced motion and the sound/shake controls remain supported.

At the result screen, request a rematch. Both human players must accept; a fresh match resets castles, ammunition, and water swaps the starting side, and selects a different castle formation. Refreshing the same browser tab can recover its seat during the reconnect grace period. The host continues match time while a phone is disconnected or backgrounded.

## Checks and implementation

```sh
npm test
npm run check
```

Tests use Node's built-in test runner. Simulation checks cover gameplay rules; WebSocket integration checks exercise room creation, readiness, action ownership, ammunition, duplicate commands, reconnects, rematches, and malformed messages. Tests can inject shorter timers directly into `createServer`; there is no public debug route that changes match rules.

| Path | Responsibility |
| --- | --- |
| `GDD.md` | Reviewed game design and acceptance criteria |
| `INTERFACE.md` | Shared simulation, snapshot, and network contracts |
| `server/index.js` | HTTP hosting, LAN room sessions, authoritative clock, WebSockets, and AI orchestration |
| `shared/game.js` | Gameplay simulation, action validation, destruction, trajectories, turns, and water |
| `shared/formations.js` | Pre-designed mirrored castle blueprints, spawn positions and seeded layout selection |
| `shared/presentation.js` | Shared effect durations and authoritative result-presentation timing |
| `shared/content.js` | Arena constants, weapon definitions, ammunition, and escalation pools |
| `public/` | Browser interface, release-safe touch controls, canvas rendering, and audio |
| `tests/` | Simulation and server integration tests |

Browser clients send action intentions to `/ws`. The server validates the connection's seat, match, turn, command identity, sequence, unit, weapon, and available ammunition before applying an action. Clients render snapshots; they cannot submit damage or declare a winner. AI actions go through the same gameplay validation.

Castle collapse uses connected groups of structural tiles: unsupported groups fall vertically and settle as persistent physical debris that can crush inhabitants or support later construction. This model does not simulate rotating rigid bodies.

`GET /health` reports host availability. `GET /api/host` provides local connection addresses. `GET /api/qr?code=ROOM&origin=HOST_ORIGIN` creates a room-link QR code; QR codes do not contain private reconnect tokens. Shared modules are available at `/shared/` and all browser assets are served by the same host.

Balance values live in the shared game and content modules. Keep rule changes synchronized with the GDD and tests. This first build is a skirmish game; campaigns, accounts, permanent upgrades, public matchmaking, a castle editor, and native app-store packages are outside its scope.

## LAN troubleshooting and validation limits

- Use the computer's LAN address on phones. `localhost` on a phone refers to the phone itself.
- Permit incoming Node.js connections through the host firewall if the operating system asks. Use a normal shared Wi-Fi network: guest networks and access points with client isolation can block device-to-device connections.
- Disable a VPN if it prevents local routing, and grant local-network browser access if the phone asks for it.
- Keep the host awake. Closing the server interrupts all its rooms; this version does not migrate hosts or recover matches after a server restart.
- A disconnected seat has a **10-second grace period** by default. Gameplay and timers continue; expiry can cause a forfeit. Returning in another browser without the reconnect token cannot recover that seat.

Automated checks and desktop browser testing at phone-sized viewports do not establish performance or touch behavior in Chrome on a physical iPhone. Real iPhone 12 or newer devices running Chrome and the target Wi-Fi network still need a playtest, including rotation, backgrounding, reconnection, audio, heavy destruction, and two-phone PvP. Desktop viewport checks are a separate form of validation, not a substitute for that device test. The balance numbers are starting values, not measured competitive balance.


## Publishing copy

This source folder belongs to the separate GitHub Pages release. The original development workspace was left unchanged. Run `npm run build` to produce `../index.html`: a self-contained solo edition using the same engine and AI. Its multiplayer menu explains how to run this Node/LAN version instead. Solo browser time pauses while the tab is hidden or suspended; Node-hosted matches keep their original timing and reconnect rules. Reloading the standalone page starts a fresh session.
