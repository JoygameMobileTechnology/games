# They Chase Us!

Geri geri koşan okçu prototipi (hybrid-casual runner + roguelite kart seçimi). Three.js, portrait 9:16, tek HTML dosyası, tüm geometri ve ses kodla üretiliyor.

- **Oyna:** `index.html` (self-contained, çevrimdışı açılır). `?debug=1` ile debug paneli (seviye seçimi, kart verme, god mode, canlı CONFIG).
- **Kaynak:** `source/` — Vite projesi. `npm install && npm run build` → `dist/index.html` (buradaki `index.html` bu çıktıdır).
- **Tasarım:** `source/GDD.md` (EN) / `source/GDD-tr.md` (TR). Tüm denge sayıları `source/src/config.js` içinde.

- **v2 (auto-attack):** [v2/](v2/) — nişan yok, oklar menzildeki en yakın düşmana kendiliğinden gider, sadece sağa-sola kaydırma; ana menü yükseltmeleri HP / Attack Speed / Damage, hordelar daha kalabalık. Canlı: https://joygamemobiletechnology.github.io/games/they-chase-us/v2/
