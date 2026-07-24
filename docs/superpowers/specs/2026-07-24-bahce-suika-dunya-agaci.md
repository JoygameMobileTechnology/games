# Bahçe Suika v2 — Dünya Ağacı Meta Katmanı

Tarih: 2026-07-24
Değişiklik: Bölge/slot bahçesi kaldırıldı. Üst alan artık **tek kahraman ağaç**: tüm birleşmeler ona enerji akıtır, seviye atladıkça ağaç gözle görülür büyür. Alt (Suika kabı) aynen kalır.

## 1. Enerji Ekonomisi (CORE, DOM'suz)

- Birleşme sonucu kademe `t` → enerji: `2^(t-1)` (1, 2, 4, ... 512). Küçükler sürekli damlatır, büyükler patlama yapar.
- Seviye maliyeti: `round(10 × 1.5^seviye)`; MAX_LEVEL = 12. `addEnergy` çok seviyeli atlamayı taşır ve `{kind:'levelup', level}` olayları döndürür.
- MAX'tan sonra taşan enerji `legend` sayacında birikir (prestij).
- Idle: saat başına 6 enerji, tavan 60; dönüşte "🌙 Sen yokken" paneli + varsa seviye kutlaması.

## 2. Ağaç Görseli

- **Prosedürel SVG**: sabit tohumdan (mulberry32 PRNG) deterministik dal topolojisi — kayıt boyunca AYNI ağaç. Topoloji CORE'da (`treeTopology(seed)`), test edilebilir.
- Seviye → görünür derinlik (`1 + floor(sv/2)`) + genel ölçek. Çift seviyeler yeni dal kohortu açar (draw-on animasyonu), tek seviyeler gövde kalınlaşması/yaprak zenginleşmesi (puls + renk).
- Yapraklar: uç noktalarında katmanlı degrade daire kümeleri; sv≥5 çiçek benekleri, sv≥7 meyveler.
- Sakinler (kilometre taşları): sv2 🦋, sv4 🐦, sv6 🐿️, sv8 🐝, sv10 salıncak, sv12 ağaç evi.
- Gökyüzü seviyeyle tonlanır (şafak → gün → altın saat); bulutlar, güneş nabzı, sv≥9 ateşböcekleri.

## 3. Animasyon

- **anime.js v3 (CDN, cdnjs)** — repo'nun "harici asset yok" kuralına kullanıcı onaylı istisna. `window.anime` yoksa zarif düşüş: uç değerler animasyonsuz uygulanır.
- Her birleşme: birleşme noktasından enerji zerresi (✨) sayaca uçar, sayaç dolar.
- Levelup kutlaması: sahne flaşı + ağaç esneme + yıldız saçılımı + yeni dalların çizilerek belirmesi + fanfar.

## 4. Kalıcılık / Doğrulama

- `bahce-suika-v2` anahtarı: `{ fruits, queue, score, best, tree:{level, energy, seed, legend}, lastSeen, muted, runEnergy }`.
- Fizik testleri aynen; bahçe testleri yerine enerji/seviye/topoloji/persistence testleri (`node bahce-suika/test.mjs`).
