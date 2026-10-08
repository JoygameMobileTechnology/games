# Matchmaking theme artwork

The chosen duel theme selects both a full-page paper illustration and a blue-left / red-right portrait ink layer. The theme card reuses that theme's paper, while its tile continues to follow the selected Eastern or Western collection. The gold VS cloud ornament is shared.

| Theme | Portrait ink | Paper | Exact prompts and generation provenance |
| --- | --- | --- | --- |
| Ming porcelain | `ming-porcelain-ink.webp` | `ming-porcelain-paper.webp` | [Generation details](ming-porcelain-art.json) |
| Dancheong | `dancheong-ink.webp` | `dancheong-paper.webp` | [Generation details](dancheong-art.json) |
| Stained Glass | `stained-glass-ink.webp` | `stained-glass-paper.webp` | [Generation details](stained-glass-art.json) |
| Dutch Golden Age | `dutch-golden-age-ink.webp` | `dutch-golden-age-paper.webp` | [Generation details](dutch-golden-age-art.json) |

All illustrations were generated with built-in imagegen using the user's October 8 references. PNG outputs were encoded to WebP; ink transparency is preserved. The CSS retains the approved gentle ink treatment: opacity 0.42 and saturation 0.78. Paper is veiled separately for text legibility.

The previous generic bamboo/blossom design is hidden from the active game. Its source, artwork, generation prompt and runnable standalone build are preserved locally in `backups/matchmaking-generic-2026-10-08/`. That directory is excluded from Git and production assets.

Runtime selection lives in `src/matchmaking-art.js` and `src/matchmaking-page.jsx`. Explicit asset paths allow the standalone packager to embed every theme.
