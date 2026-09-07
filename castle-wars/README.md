# Castle Wars

A landscape artillery game with three shooters, breakable castles, wind, floating cover and an arsenal that escalates to planetary destruction. Pull back from the glowing shooter and release to fire. Destroy the enemy core or eliminate its crew to win. Four minutes of regulation are followed by up to six rising-water turns; high shots finish their full flight.

## Play

[Play Castle Wars](https://joygamemobiletechnology.github.io/games/castle-wars/). The published page runs solo games against the AI entirely in the browser. It needs no game server or external assets. Use landscape on phones; the target is Chrome on iPhone 12 and newer, including Pro and Pro Max.

The **Challenge a friend** option remains visible. Selecting it explains that multiplayer requires the Node/LAN edition and offers hosting instructions or solo play. GitHub Pages cannot host the WebSocket server.

## Rebuild the published page

```sh
cd castle-wars/source
npm ci
npm run build
npm test
npm run check
```

The build writes `castle-wars/index.html`, inlining the shared simulation, AI, renderer, sound, interface and styles. It uses the existing game rules; the solo transport runs the match locally. Commit the rebuilt file with source changes. The repository's existing Pages workflow discovers this folder through `index.html` and `game.json`.

## Run the Node/LAN edition

```sh
cd castle-wars/source
npm ci
npm start
```

Open the host address printed in the terminal on two devices using the same Wi-Fi. This serves the multiplayer-capable application; it does not serve the standalone HTML above. See [source/README.md](source/README.md) for room creation and troubleshooting.

The original development project is separate and unchanged. This folder contains the publishing copy, its source and tests. Solo matches pause when the tab is hidden or suspended, then resume when you return. Browser reloads start a fresh solo session; there is no cloud save or online matchmaking.
