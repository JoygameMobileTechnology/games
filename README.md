# Game Experiments

Single-file HTML game prototypes, one folder per game, deployed via GitHub Pages.

- Hub: `index.html`
- Games: `<game-name>/index.html`

## Games

| Game | Path | Description |
|------|------|-------------|
| 2048 VS | `2048-vs/` | 2048 board as an army generator: live lane battler (Mode 1) or build-then-fight arena (Mode 2) against an AI opponent. |

## Adding a game

1. Create `<game-name>/index.html` (self-contained: inline CSS/JS, no external assets).
2. Add a card to the root `index.html` hub.
3. Push — GitHub Pages serves it at `/<repo>/<game-name>/`.
