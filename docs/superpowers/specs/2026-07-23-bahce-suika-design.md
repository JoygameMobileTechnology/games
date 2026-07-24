# Bahçe Suika — Tasarım Spec'i

Tarih: 2026-07-23
Öncül: `bahce-2048` prototipi (aynı bahçe katmanı) — kullanıcı geri bildirimi: "focus katmanı daha akıcı olsun; 2048 şart değil, puzzle + AFK bahçe hibriti kalsın."
Hedef: `bahce-suika/` klasöründe tek dosyalık HTML prototipi.

## 1. Konsept

Focus katmanı Suika (fizikli düşür-birleştir): oyuncu üstten tohum bırakır, aynı iki öğe temas edince bir üst evreye birleşir. Zincirleme birleşmeler kesintisiz akış üretir. Satisfaction katmanı (bahçe) bahce-2048'den birebir: bölgeler, slot ekimi, banka, kilit açılımı, idle büyüme, partikül + ses.

Koruyucu ilkeler aynı: bahçe tahtaya karar yükü döndürmez; kaynak kaybolmaz; bahçe koşular arası kalıcıdır.

## 2. Evrim Zinciri (11 kademe)

🟤 tohum → 🌱 filiz → 🌿 fide → 🌷 tomurcuk → 🌸 çiçek → 🌺 gül → 🍎 meyve → 🪴 çalı → 🌳 ağaç → 🪷 nadir → ⛲ efsanevi

- Yarıçap kademeyle büyür: `r = 4.5 + tier * 2.2` (dünya birimi; kap genişliği 100).
- Bırakılabilir kademeler: 0-4 arası, ağırlıklı rastgele (30/25/20/15/10); sıradaki + bir sonraki önizlemesi görünür.
- Son kademe (⛲) birleşmez; kapta prestij objesi olarak kalır.

## 3. Bahçe Beslemesi (emisyon)

Birleşme sonucu kademe ≥ 4 ise emisyon üretir:

| Yeni kademe | Kaynak |
|---|---|
| 4 🌸 | tohum_tozu |
| 5 🌺 | cicek_ozu |
| 6 🍎 | meyve |
| 7 🪴 | nadir_tohum |
| 8 🌳 | agac_fidani |
| 9-10 🪷/⛲ | efsanevi |

Kaynak → bahçe davranışı (slot ekimi, varyant, hayvan, banka, drenaj, bölge kilidi) bahce-2048 motorundan değişmeden taşınır.

## 4. Fizik (DOM'suz çekirdek)

- Dünya: genişlik 100, yükseklik 130 birim; tehlike çizgisi y=20.
- Adım: sabit dt ile yerçekimi (320 birim/s²), duvar/zemin sekmesi (sönüm 0.35), daire-daire çarpışma (kütle ∝ r², ayrıştırma + impuls).
- Aynı kademe temasında birleşme: a büyür (kademe+1, orta noktaya taşınır, küçük zıplama), b silinir; `merges: [{tier, x, y}]` döner. Kademe 10 birleşmez.
- Determinizm: adım fonksiyonunda rastgelelik yok → CLI'da test edilebilir (`node bahce-suika/test.mjs`, CORE bloğu çıkarma deseni aynı).

## 5. Koşu Ömrü ve Kayıp

- Taşma: hızı ~0 olan bir öğenin üst noktası tehlike çizgisinin üstünde 2 sn kesintisiz kalırsa koşu biter (çizgi bu sırada kırmızı yanıp söner).
- Oyun sonu paneli: skor + "bahçene X kaynak kattın"; "Yeni koşu" yalnız kabı ve koşu skorunu sıfırlar; bahçe/banka/rekor kalıcı.
- Skor: her birleşmede `yeniKademe × (yeniKademe + 1)` puan.

## 6. UI

- Üst ~1/3: bahçe paneli (bahce-2048'in C stili: manzara + ekim patikası + bölge ilerleme başlığı) — değişmeden.
- Altta: toprak kabı (yuvarlatılmış dikdörtgen), üstünde nişancı (parmakla x konumu, bırakınca düşer; 400ms bekleme), tehlike çizgisi, sıradaki/sonraki önizleme, skor/rekor/Yeni/ses HUD'u.
- Öğeler: pastel degrade daire + merkezde evre emojisi; birleşmede pop, doğuşta scale-in.
- Emisyon partikülü birleşme noktasından bahçe slotuna uçar (mevcut flyParticle); chime kademe ile tizleşir (mevcut ses katmanı).

## 7. Kalıcılık

`localStorage` anahtarı `bahce-suika-v1`: `{ fruits:[{tier,x,y}], queue:[cur,nxt], score, best, garden, lastSeen, muted, runEmissions }`. Yükleme doğrulaması: bozuk fruits → boş kap; bahçe iç alan doğrulaması bahce-2048'deki gibi. Hızlar kalıcı değil (yüklemede 0).

## 8. Doğrulama

- CORE (fizik + birleşme + emisyon eşleme + bahçe motoru + idle + persistence) `test.mjs` ile CLI'dan test edilir; bahçe/idle/persistence testleri bahce-2048'den taşınır, fizik testleri eklenir.
- Görsel katman tarayıcıda elle doğrulanır.

## 9. Kapsam Dışı (v2)

Dekor sürükleme, sezonluk içerik, çoklu kap/kap genişletme, combo çarpanları.
