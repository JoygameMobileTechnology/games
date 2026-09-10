# Phobos Arena

[Play in your browser](https://joygamemobiletechnology.github.io/games/phobos-arena/)

A fast, gothic sci-fi arena FPS for landscape phones, tablets and computers. Six arenas support bot skirmishes and best-of-three tournaments across Free for all, Duel, Team deathmatch, CTF, One Flag CTF and Juggernaut. Complete matches to earn Favor, with larger rewards for wins, and spend it on characters and cosmetic finishes. No real-money purchases or accounts are required. Contains gore and mature themes.

On touch screens, drag the left side to move, tap left to jump, drag right to aim, and tap right to fire projectile weapons. Hitscan weapons fire when aimed at an opponent. Tap the weapon strip to switch while moving. Keyboard, mouse and gamepad controls can be rebound in Options.

## Local progress and offline play

Your name, statistics, Favor and cosmetics are saved in this browser. Options and Statistics offer **Export backup** and **Choose backup** for moving a profile between browsers or devices. Review the preview before restoring: a restore replaces the current profile. Profiles are specific to the site address; a local LAN address uses a separate profile.

After the menu reports **Cached for offline play**, reopen the same game URL to play solo without a connection. This depends on browser support and available storage. Clearing site data or browser storage eviction can remove both the game cache and your profile, so keep an exported backup. An update waits until all Phobos tabs close before taking over; it does not replace a running match.

## LAN multiplayer

GitHub Pages hosts the solo game. LAN hosting and joining require the separate local server and are unavailable on the Pages site.

On a computer with Node.js 22.12 or newer, open a terminal in the included `source` directory and run:

```sh
npm ci
npm run lan
```

The server prints its local address. Open that address on devices connected to the same local network, choose **LAN Play**, and create a room. Other players can enter its room code after opening the server address, or scan the room QR using their phone's Camera app. A room code identifies a room on that server; it does not locate the server. Keep the server running throughout play. Installing dependencies requires internet access; the running LAN session does not.

## Rebuild this Pages package

From `source`, run:

```sh
npm ci
npm run build:pages
```

The build writes `source/dist-pages`. Copy only its `index.html`, `assets/`, `mark.svg` and `sw.js` into the game package root, replacing the previous generated files. Keep `README.md`, `game.json`, `THIRD_PARTY_NOTICES.md` and `source/` in place. Publish the package at `/games/phobos-arena/`, which is the build's configured URL path.

See [third-party notices](THIRD_PARTY_NOTICES.md) for the bundled libraries and their licenses.
