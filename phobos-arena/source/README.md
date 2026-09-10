# Phobos Arena source

See [the game README](../README.md) for play, build and local LAN instructions.

Run `npm ci`, then `npm test` for the game regressions. In this shared repository, also run `node --test tests/shared-cache.test.mjs` to check that the Terra Bellum and Pacman workers preserve neighboring caches. `npm run build:pages` generates `dist-pages`; `npm run lan` builds and serves the separate local LAN edition.
