# Game Experiments

Single-file HTML game prototypes, one folder per game, deployed via GitHub Pages.

The hub page (site root) is **generated automatically** by `scripts/build-hub.mjs` on every push — do not create a root `index.html` by hand.

## Adding a game

1. Create `<game-name>/index.html` (self-contained: inline CSS/JS, no external assets). The folder name becomes the URL slug: `/<game-name>/`.
2. Optionally add `<game-name>/game.json` for the hub card:
   ```json
   { "title": "My Game", "description": "One-line description shown on the hub." }
   ```
   Without it, the game's `<title>` tag (or the folder name) is used and the card has no description.
3. Push to `main`. The Pages workflow scans every folder containing an `index.html`, rebuilds the hub, and deploys the site. Nothing else to edit.

## Local preview

```bash
node scripts/build-hub.mjs   # builds ./_site
python3 -m http.server -d _site 8080
```

## Games

| Game | Path |
|------|------|
| 2048 VS | `2048-vs/` |
