# Bee Colony Remaster

Bee Colony'nin (bkz. [bee-colony/](../bee-colony/)) Cube Land referansına göre yeniden kurulmuş prototipi. Three.js, portrait 9:16, tek HTML dosyası; heykeller, shooter'lar, arılar ve efektler kodla üretiliyor.

- **Oyna:** `index.html` (self-contained, çevrimdışı açılır). Ayarlar (dişli) menüsünden istediğin levele atlayabilirsin.
- **Leveller:** `levels/level_N.json` — Cube Colony level editörünün formatı (küpler + kovan kuyrukları, `hidden` / `link` alanlarıyla). 35 level; skull levelleri 10 / 16 / 22 / 29 / 35.

## Bee Colony'den farkları

- **Sahne:** dekor ve platform yok; heykel koyu lacivert boşlukta, ekranın üst yarısını doldurur, parmakla serbestçe döndürülür (2 sn dokunulmazsa kendi kendine sola döner). Delik yok: arı küpü söker ve kadrajın yanından uçup gider.
- **Görüş kuralı:** slottaki kovan yalnızca kameraya dönük ve önü açık küpleri hedefler; rengi görünmüyorsa uyur, heykel çevrilince uyanır. Sıkışma yalnızca renk hiçbir yönden ulaşılamıyorsa sayılır.
- **Kuyruk:** kovanlar tombul blok shooter'lar (en fazla 80 arı, yuvarlak sayılar). Level 8'den itibaren gizli "?" shooter'lar (önündeki slota çıkınca açılır), level 13'ten itibaren birlikte hareket eden bağlı çiftler.
- **Boosterlar** (altta, Cube Land sırasıyla açılır): Geri Al (L6), Slot Ekle (L9), Wild Bee (L12), Shuffle (L15), Vacuum (L18).
- **FTUE:** L1 (dokun / uyuyan kovan / uyandırma), L2 (döndür / 2x), booster'lar açıldıkları levelde tanıtılır. Türkçe.
- **Pocket levelleri:** 13 Rubik Küpü, 18 Bal Kabağı, 23 Doğum Günü Pastası, 28 Arı Kovanı, 33 Balık — renkler heykelin farklı bölmelerinde gizli, oyuncu soyarak keşfeder.

Canlı: https://joygamemobiletechnology.github.io/games/bee-colony-remaster/
