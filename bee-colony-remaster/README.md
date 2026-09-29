# Bee Colony Remaster

Bee Colony'nin (bkz. [bee-colony/](../bee-colony/)) Cube Land referansına göre yeniden kurulmuş prototipi. Three.js, portrait 9:16, tek HTML dosyası; heykeller, shooter'lar, arılar ve efektler kodla üretiliyor.

- **Oyna:** `index.html` (self-contained, çevrimdışı açılır). Ayarlar (dişli) menüsünden istediğin levele atlayabilirsin.
- **Leveller:** `levels/level_N.json` — Cube Colony level editörünün formatı (küpler + kovan kuyrukları, `hidden` / `link` alanlarıyla). Remaster seti (29 Eylül 2026): 35 yüksek çözünürlüklü heykel (560–1740 küp), her levelde 5 slot; skull levelleri 10 / 16 / 22 / 29 / 35. Set açıklaması ve kural denetimi `levels/README.md`, önizlemeler `levels/preview/`.

## Bee Colony'den farkları

- **Sahne:** dekor ve platform yok; heykel koyu lacivert boşlukta, ekranın üst yarısını doldurur, parmakla merkezinden 360° serbestçe döndürülür (2 sn dokunulmazsa kendi kendine sola döner). Delik yok: arı küpü söker ve kadrajın yanından uçup gider.
- **Görüş önceliği:** slottaki kovan önce kameraya dönük ve önü açık küpleri (en yakından başlayarak) hedefler; kısa bir süre hiç göremezse arılar arkayı da arar. Sıkışma yalnızca renk hiçbir yönden ulaşılamıyorsa sayılır.
- **Kuyruk:** kovanlar kübik shooter'lar (arılar ön yüzden çıkar); en fazla 80 arı, hepsi 10'un katı, bölünen renk bir şeritte arka arkaya gelmez. Level 8'den itibaren gizli "?" shooter'lar (önündeki slota çıkınca açılır), level 9'dan itibaren birlikte hareket eden bağlı çiftler, zor levellerde (16/22/29/35) bağlı üçlüler (3 boş slot ister).
- **Arı akışı:** kovan 0,08 sn'de bir arı çıkarır, kovan başına 10 arı yolda, ekranda en fazla 110 arı — büyük heykeller Cube Land süresine yakın biter.
- **Boosterlar** (altta, Cube Land sırasıyla açılır): Geri Al (L6), Slot Ekle (L9), Eşek Arısı (L12), Karıştır (L15), Vakum (L18). Açıldığı bölümde 1 adet hediye; biten booster'daki "+" satın alma panelini açar.
- **Mağaza:** alt bardaki Mağaza sekmesi; Reklamsız teklifi, 3 paket (altın + booster), 6 altın paketi ve günlük bedava altın. Satın almalar test amaçlı.
- **Yolculuk:** alt bardaki sağ sekme; Cube Land'in dikey yolculuk haritası gibi, ama şehir kilidi yerine katalog işlevi görür. Bölüm 1'den yukarı çıkan yol sıradaki bölüme kadar yeşil dolar; her bölüm yolun üstünde bir adım: solda bölüm numarası, sağda hedef heykel. Bitirilenler renkli ve Türkçe isimli, diğerleri gri ve kilitli.
- **Ekonomi:** 1000 altınla başlanır, bölüm sonu 30 altın (reklamla ×2). Paketler: Geri Al ×3 900, Slot Ekle ×1 1800, Eşek Arısı ×2 1600, Karıştır ×3 900, Vakum ×1 1800.
- **Son dalga:** kuyrukta kalan kovanlar boş slotlara sığınca kendiliğinden yerleşir, HUD gizlenir ve oyun 3x hızlanır.
- **Ayarlar:** altı arka plan varyantı (Sarı varsayılan · Lacivert / Orman / Bal / Beyaz / Gri) renk kutucuklarından seçilir (test amaçlı).
- **FTUE:** L1 (dokun / uyuyan kovan / uyandırma), L2 (döndür / 2x); booster'lar açıldıkları levelde, gizli "?" (L8) ve bağlı çift (L9; kart kapanınca Slot Ekle balonu) ilk göründüklerinde tam ekran "Yeni Engel!" kartıyla, gizli cep (L5) ve üçlü bağ (L16) tek balonla tanıtılır. Türkçe.
- **Cepler:** 35 levelin 34'ünde en az bir renk heykelin içinde tamamen kapalı (ör. Lastik Ördek, Hediye Kutusu, Yılbaşı Çanı, Kumbara, Hazine Sandığı, Kraliçe Arı); o rengin kovanı cep açılana kadar uyur, oyuncu soyarak keşfeder, kuyruk sırası bu yüzden önemli.

Canlı: https://joygamemobiletechnology.github.io/games/bee-colony-remaster/
