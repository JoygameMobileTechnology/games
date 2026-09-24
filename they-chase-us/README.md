# They Chase Us!

Geri geri koşan okçu prototipi (hybrid-casual runner + roguelite kart seçimi). Three.js, portrait 9:16, tek HTML dosyası, tüm geometri ve ses kodla üretiliyor.

- **Oyna:** `index.html` (self-contained, çevrimdışı açılır). `?debug=1` ile debug paneli (seviye seçimi, kart verme, god mode, canlı CONFIG).
- **Kaynak:** `source/` — Vite projesi. `npm install && npm run build` → `dist/index.html` (buradaki `index.html` bu çıktıdır).
- **Tasarım:** `source/GDD.md` (EN) / `source/GDD-tr.md` (TR). Tüm denge sayıları `source/src/config.js` içinde.
