# Achievement trophy artwork

The trophy sprite atlas is `public/assets/remake/achievement-trophies.png`.
Generated with the built-in image generation tool for this game on 29 September 2026, from the user's trophy-shelf and achievement-detail references. Original generation: `exec-9a3412cf-e8bf-45e0-9a73-ff01a8ef464e.png`.

The sixteen illustrations are retained for milestone trophy families. Code adds level-specific laurel leaves, crowns and glow; locked trophies are muted. The third sprite row clips its bottom edge slightly to keep the following row's ornament outside the displayed cell. The source PNG is preserved unchanged.

## Generation prompt

Use case: stylized-concept. Asset type: ONE production sprite atlas for a warm Mahjong mobile game's achievement trophy gallery. Create a precisely aligned 4-column by 4-row grid of 16 different hand-painted 2D illustrated achievement trophies, on true transparent background. Each equal square cell has a centered complete trophy with generous 10% transparent inset, perfectly separated from every other cell. No captions, no lettering, no numbers, no UI, no grid lines. All trophies share same front three-quarter perspective and same height, each on a small low circular dark lacquered wood pedestal edged in polished bronze and gold. Rich graceful mobile-game illustration, crisp readable silhouettes, painted volume and beautiful warm cream highlights, elegant east Asian ornamental style, jade green and cobalt porcelain accents, highly polished illustrative game art, not photorealistic. Precise row-major subjects: row1: (1) two upright ivory Mahjong tiles with blue floral motif and green bamboo motif surrounded by a gold laurel wreath; (2) three tall glossy green bamboo stalks; (3) flowing crimson victory banner with simple gold leaf emblem and one ivory tile; (4) two blue-flower tiles encircled by a curling gold ribbon. Row2: (5) a silver heart-shaped medal containing two small ivory tiles; (6) an open cobalt blue and ivory folding fan; (7) a proud tall plume of vivid green reed leaves with one small bamboo tile, in a blue-white porcelain pot; (8) elegant bronze balance scales holding an ivory tile on each side. Row3: (9) four ivory tiles ascending as steps along a sweeping gold ribbon; (10) miniature carved wooden display cabinet containing three patterned Mahjong tiles; (11) ornate five-petal blue and white porcelain flower medallion; (12) three-panel ivory folding screen with delicate monochrome mountain painting. Row4: (13) red silk lantern with gold fittings and small jade tassel; (14) brass compass with jade needle; (15) an ivory and gold eagle with outstretched wings; (16) a glorious gold handled trophy cup with green jade inset. Pedestals have NO text. Keep all edges safely inside their equal cells. Make the atlas square, preferably 2048x2048, transparent alpha background.


## Unique one-time trophies — October 8–9, 2026

All 27 single-level achievements now have their own challenge-specific illustration in `public/assets/remake/achievement-standalone/`. The 16 milestone families keep their existing atlas subjects, conditions, levels and rewards. Single-level family IDs map to explicit image paths in `src/achievement-standalone-art.js`.

The new illustrations were individually generated with the built-in image-generation tool on true transparent backgrounds, then encoded as 384 × 384 WebPs at quality 90 for the gallery and detail view. Original generated PNGs are retained locally in `outputs/achievement-trophies-v2/`. Exact generation prompts, generated-source filenames, artwork mappings and checksums are recorded in [achievement-trophies-v2.json](achievement-trophies-v2.json).

Locked trophies are neutral grayscale. Earned one-time trophies immediately receive their full natural color, without milestone laurels or crowns. Milestone artwork moves through partial grayscale (32%, 18%, 8%, 3%, then 0%) with increasingly rich glow; the former sepia cast and excess saturation are removed. Existing level-to-glory mapping is unchanged for multi-level achievements.

First-shelf standalone artwork and the original atlas warm during menu idle time. Remaining standalone images follow the existing shelf visibility loading, preserving gallery layout. The offline build embeds each image once and reuses a short Blob URL per source.

## Distinct milestone trophies — October 9, 2026

Five reused atlas subjects are replaced by individual illustrations for Familiar Pictures, Lasting Recall, Guided Hand, Returning Rival and Every Setting. They live in `public/assets/remake/achievement-milestones/`, with explicit runtime paths in `src/achievement-milestone-art.js`. All 43 families now have different artwork identities. The 27 one-time trophies and 11 remaining atlas subjects are unchanged.

The built-in image-generation tool produced each replacement separately on a transparent background; exports are 384 × 384 WebP at quality 90. Originals remain in `outputs/achievement-trophies-v3/`. Exact prompts, source filenames and hashes are recorded in [achievement-trophies-v3.json](achievement-trophies-v3.json).

Four-level tracks grow their laurel decoration through 1, 3, 6 and 10 leaf pairs, reaching their full natural color and crown at Level IV. See [four-level achievement balance](achievement-four-level-balance.md) for targets, rewards and save compatibility.
