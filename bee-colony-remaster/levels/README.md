# Bee Colony Remaster — yeni level seti (35 level)

29 Eylül 2026. Heykeller eski sete göre çok daha yüksek çözünürlüklü; kuyruklar yeni kurallara göre baştan kuruldu. Bağımsız bir denetim (`verify.ts`) bütün kuralları dosyalar üzerinden tekrar kontrol ediyor: hepsi geçiyor.

## Kurallar ve sonuç

- **Daha çok piksel:** toplam 43.780 küp (eski set 10.577; ×4,1). Level başına 380–1740 küp, heykeller 11–27 küp genişliğinde.
- **Kovanlar:** en fazla 80, hepsi 10'un katı (80/70/60/50/40/30/20/10). Her rengin kovan toplamı heykeldeki küp sayısına birebir eşit.
- **Dağılım:** bölünen bir renk hiçbir şeritte arka arkaya gelmez; aynı rengin kovanları levele yayılır.
- **Slot:** her levelde 5 (Slot Ekle ile 6).
- **Cep kuralı:** 34/35 levelde en az bir renk heykelin içinde tamamen kapalı (başta tek küpü bile görünmez; o rengin kovanı cep açılana kadar uyur). Eksik olan tek level L2 (döndürme FTUE'si). 24 levelde cepler her yerden en az 2 kat örtülü; kalan 10 levelde cebin bir yerinde tek kat örtü var (karpuzun beyaz iç kabuğu, hediye kutusunun köpüğü, uçan dairenin camı gibi; bu cepler daha erken açılır). Cep ipucu balonu L5 Karpuz'da bir kez çıkar.
- **Gizli "?" kovan:** L8'de tanıtılır (ikinci sıranın tamamı gizli), sonra zorluk için kullanılır; şerit önünde asla gizli kovan yok.
- **Bağlı kovanlar:** ancak hepsi kendi şeridinin önündeyken birlikte slota gider (biri arkadaysa öndekine dokunmak bir şey yapmaz). L9'da ön sırada bir ikiliyle tanıtılır (Slot Ekle ile aynı level: önce "Yeni Engel!" kartı, kapanınca Slot Ekle balonu). **Üçlü bağ** yalnız zor levellerde: L16, L22, L29, L35 (L16'da tek seferlik "Üçlü bağ!" balonu).
- **Zorluk:** "kolay level bile kaybedilebilir olmalı" kuralıyla her kuyruk dikkatsiz oyuncuya karşı ölçüldü. Normal levellerde gerçek kazanma %77–96 (400 rastgele oyun, aramada kullanılmayan tohumlarla); zor (💀) levellerde (10, 16, 22, 29, 35) %17–30. Editörün 24 oyunluk bandı da tutuyor (normal %70–100, zor %5–40). Kaybedilemeyen yalnız üç level var: L1–L2 (FTUE) ve L15 Kelebek (3 küp inceliğinde; kanat içindeki kırmızı zar cebi oyunu kilitleyemez).
- **Tanıtım levelleri korunur:** L1 FTUE (yeşil / bej uyur / kırmızı kazar), L2 döndürme (turuncu arka yüz önden görünmez), L8 gizli kovan, L9 bağlı kovan, booster tanıtımları L6 Geri Al, L9 Slot Ekle, L12 Eşek Arısı, L15 Karıştır, L18 Vakum.
- **Eski setin anlaşılmayan şekilleri yok:** donut, külahta dondurma, akide şekeri, ikinci mercan balığı ve arı kovanı çıkarıldı; her konu tek.

## Süre

Bot (1,5 sn bakış, 0,9 sn arayla dokunuş, booster yok) 70 oyunun hepsini kazandı; L16 oyununda bir kez sıkışıp Slot Ekle kurtarmasıyla bitirdi (bot bağlı kovanların hepsi öne gelene kadar bekler). Ortalama 1x: L1–14 **41,4 sn** (Cube Land 37,9 sn), L15–35 61,0 sn; 2x: 28,2 / 39,0 sn. Bot insandan hızlı oynar (düşünme, döndürme yok).

Daha çok küp için arı akışı hızlandırıldı: kovan 0,08 sn'de bir arı çıkarır, kovan başına 10 arı yolda, ekranda en fazla 110 arı; büyük heykellerde arılar orantılı hızlı uçar. Eşek Arısı joker kovanı 30 arı.

## Leveller

| # | Heykel | Küp (eski) | Boyut | Şerit / kovan | Gizli | Bağ | İçte saklı renkler | Kazanma editör / gerçek | Süre 1x / 2x | Cube Land |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Kiraz İkilisi** — FTUE: bej meyve eti kırmızı kabuğun içinde (uyuyan kovan adımı) | 380 (116) | 15x16x7 | 3 / 7 | 0 | — | bej | %100 / %100 | 15 / 11 sn | 15 |
| 2 | **Küçük Yıldız** — FTUE döndürme: turuncu arka yüz önden görünmez | 560 (75) | 25x22x5 | 3 / 10 | 0 | — | beyaz* | %100 / %100 | 19,7 / 15,1 sn | 22 |
| 3 | **Lastik Ördek** — turkuaz banyo suyunda sarı ördek; içine dolan mavi su (cep) | 860 (160) | 17x13x17 | 3 / 21 | 0 | — | mavi | %92 / %92 | 35,4 / 25,8 sn | 29 |
| 4 | **Oklu Kalp** — kırmızı kalbin içinde pembe kalp; okun gövdesi içeriden geçer | 750 (184) | 26x17x7 | 3 / 17 | 0 | — | pembe | %96 / %95 | 33,4 / 21,7 sn | 23 |
| 5 | **Karpuz** — cep tanıtımı: çizgili kabuk > beyaz iç kabuk > kırmızı > siyah çekirdek | 880 (172) | 16x11x10 | 3 / 25 | 0 | — | beyaz, kırmızı, siyah | %96 / %96 | 36,1 / 24,9 sn | 32 |
| 6 | **Mantar** — Geri Al tanıtımı; krem benekli kırmızı şapkanın içi beyaz (cep) | 1010 (107) | 15x14x15 | 3 / 21 | 0 | — | beyaz, kırmızı* | %88 / %96 | 40,9 / 26,5 sn | 39 |
| 7 | **Penguen** — buz kütlesinde atkılı penguen; karnında yuttuğu gümüş balık (cep) | 1210 (378) | 16x19x15 | 3 / 28 | 0 | — | gri | %92 / %92 | 44,9 / 31,8 sn | 44 |
| 8 | **Gülen Güneş** — gizli kovan tanıtımı (2. sıra tamamen "?"); içi kızgın kırmızı | 900 (328) | 21x21x6 | 3 / 22 | 3 | — | kırmızı, pembe* | %96 / %90 | 40,2 / 26,4 sn | 31 |
| 9 | **Roket** — Slot Ekle ve bağlı kovan tanıtımı (ön sırada ikili); içinde gri motor ve ışıklı kabin | 1440 (273) | 17x28x17 | 4 / 29 | 5 | 1 ikili | sarı, gri*, beyaz* | %92 / %88 | 59,4 / 37,4 sn | 65 |
| 10 💀 | **Hediye Kutusu** — ZOR: ambalajın altında köpük, içinde dört oyuncak bölmesi | 1140 (450) | 12x14x12 | 3 / 24 | 5 | 2 ikili | beyaz, kırmızı, yeşil, turuncu, mavi | %25 / %26 | 63,2 / 41,7 sn | 46 |
| 11 | **Çilek** — içi beyaz çilek | 1170 (304) | 13x19x13 | 4 / 27 | 4 | 1 ikili | beyaz, kırmızı* | %79 / %89 | 41,1 / 30,7 sn | 45 |
| 12 | **Kardan Adam** — Eşek Arısı tanıtımı; alt topun içinde buz çekirdeği | 1510 (236) | 19x28x13 | 4 / 34 | 6 | — | turkuaz, turuncu* | %88 / %77 | 53,4 / 38,1 sn | ≥66 |
| 13 | **Yılbaşı Çanı** — altın çanın içinde gümüş öz (cep); ağzından tokmak görünür | 1000 (512) | 13x19x13 | 4 / 24 | 4 | 1 ikili | gri | %83 / %89 | 44,6 / 29,7 sn | 33 |
| 14 | **Uğur Böceği** — kırmızı kabuğun altında katlanmış kahverengi kanatlar (cep) | 1290 (278) | 24x10x17 | 4 / 34 | 7 | 1 ikili | kiremit, kırmızı*, yeşil*, beyaz* | %83 / %87 | 51,7 / 34,6 sn | 40 |
| 15 | **Kelebek** — Karıştır tanıtımı; kral kelebeği desenleri; kanat yüzlerinin arasında kırmızı zar (cep) | 700 (364) | 25x21x3 | 4 / 13 | 2 | 1 ikili | kırmızı | %100 / %100 | 28,6 / 18,1 sn | — |
| 16 💀 | **Balkabağı** — ZOR: oyma yüzden sarı ışık; içinde çekirdek ve mum; üçlü bağ | 1530 (340) | 17x16x15 | 3 / 28 | 7 | 1 ikili + 1 üçlü | sarı, beyaz | %29 / %30 | 102,6 / 64,9 sn | — |
| 17 | **Palyaço Balığı** — pembe deniz şakayığının üstünde palyaço balığı; karnında yuttuğu kırmızı karides (cep) | 920 (244) | 20x19x11 | 4 / 18 | 2 | 1 ikili | kırmızı | %88 / %90 | 36,1 / 24,7 sn | — |
| 18 | **Hamburger** — Vakum tanıtımı; ekmeklerin içi yumuşak bej | 1530 (292) | 15x14x14 | 4 / 31 | 6 | 1 ikili | bej, kahve*, sarı*, kırmızı*, yeşil* | %83 / %90 | 63,3 / 39,7 sn | — |
| 19 | **Baykuş** — dal üstünde baykuş; içi yumuşak gri tüy (cep) | 1340 (232) | 21x20x12 | 4 / 33 | 6 | 3 ikili | gri, bej* | %88 / %83 | 57,9 / 39,4 sn | — |
| 20 | **Sıcak Hava Balonu** — çizgili balonun içi turuncu sıcak hava | 1560 (224) | 13x23x13 | 4 / 28 | 6 | 2 ikili | turuncu | %83 / %83 | 68,4 / 43,8 sn | — |
| 21 | **Ananas** — içinde soluk ananas göbeği | 1130 (232) | 11x25x11 | 4 / 20 | 4 | 2 ikili | bej, sarı* | %88 / %87 | 41,2 / 27,6 sn | — |
| 22 💀 | **Kumbara** — ZOR: altın, banknot, gümüş bölmeleri; üçlü bağ | 1480 (334) | 21x18x11 | 3 / 24 | 6 | 1 ikili + 1 üçlü | yeşil, gri, sarı* | %21 / %20 | 62 / 40,4 sn | — |
| 23 | **Oyuncak Ayı** — içi beyaz pamuk, ortasında kırmızı kalp | 1330 (357) | 17x20x13 | 4 / 24 | 5 | 2 ikili | beyaz, kırmızı*, siyah* | %75 / %83 | 51,1 / 32,9 sn | — |
| 24 | **Deniz Feneri** — kulenin içinde ahşap merdiven, fenerde turuncu alev | 1590 (200) | 21x29x21 | 5 / 30 | 6 | 2 ikili | kahve, turuncu, gri* | %92 / %86 | 63,2 / 41,9 sn | — |
| 25 | **Yelkenli** — ambarda turuncu fıçılar, ortasında sarı hazine | 1050 (268) | 25x26x13 | 4 / 22 | 4 | 2 ikili | turuncu, sarı | %79 / %83 | 33,1 / 24,3 sn | — |
| 26 | **Kurbağa Prens** — nilüfer yaprağında taçlı kurbağa; içinde saklı prensin lacivert pelerini (cep) | 1440 (234) | 19x14x19 | 4 / 32 | 7 | 2 ikili | mavi, siyah* | %88 / %87 | 53,4 / 36,3 sn | — |
| 27 | **Kale** — kalede altın hazine odası ve pembe taht odası; kulelerde merdiven | 1740 (440) | 21x20x12 | 5 / 33 | 7 | 3 ikili | pembe, kahve*, sarı* | %79 / %85 | 58,6 / 39,9 sn | — |
| 28 | **Robot** — gövdede devre kartı, kablolar ve pil; kafada turkuaz beyin | 1570 (437) | 19x27x9 | 5 / 30 | 7 | 3 ikili | yeşil, turuncu, sarı, turkuaz | %83 / %87 | 69,1 / 41,1 sn | — |
| 29 💀 | **Hazine Sandığı** — ZOR: altın yığınının içine gömülü yakut/zümrüt/safir/kehribar kümeleri; iki üçlü bağ | 1660 (302) | 15x13x9 | 4 / 33 | 8 | 1 ikili + 2 üçlü | kırmızı, mavi, turuncu, yeşil, kahve*, sarı* | %25 / %17 | 75,5 / 42,4 sn | — |
| 30 | **Uçan Daire** — kubbenin içinde yeşil uzaylı | 1360 (392) | 21x14x21 | 4 / 29 | 6 | 1 ikili | yeşil, siyah*, gri* | %79 / %82 | 69,8 / 44,4 sn | — |
| 31 | **Kek** — kâğıt kabın içinde bej kek, ortasında reçel | 1610 (524) | 15x21x15 | 5 / 36 | 9 | 3 ikili | bej, kırmızı*, kahve*, pembe* | %88 / %90 | 74,1 / 47,2 sn | — |
| 32 | **Kaktüs** — kaktüsün içinde su, saksıda toprak | 1480 (381) | 17x26x13 | 4 / 36 | 10 | 2 ikili | turkuaz, kahve* | %88 / %85 | 70,5 / 45 sn | — |
| 33 | **Bal Kavanozu** — kareli bez kapaklı bal kavanozu; balın içinde sarı petek (cep) | 1520 (327) | 13x17x13 | 5 / 24 | 5 | 3 ikili | sarı, turuncu*, beyaz*, kırmızı* | %83 / %85 | 65,1 / 38,7 sn | — |
| 34 | **Ahtapot** — kafasının içinde lacivert mürekkep kesesi (cep) | 1590 (326) | 22x18x20 | 5 / 31 | 6 | 4 ikili | mavi | %88 / %85 | 75,8 / 47,4 sn | — |
| 35 💀 | **Kraliçe Arı** — ZOR FİNAL: karnında koyu bal, ortasında krem arı sütü (iki cep); iki üçlü bağ | 1550 (554) | 27x17x11 | 4 / 29 | 6 | 2 ikili + 2 üçlü | kiremit, bej, sarı*, pembe* | %17 / %23 | 61,9 / 38,5 sn | — |

İşaretsiz renkler tamamen kapalı cep; \* yüzeyde az görünüyor, büyük kısmı içeride (kısmi cep). "Editör" editörün 24 oyunluk tahmini (dosyayı editörde açınca görülen sayı), "gerçek" 400 oyunluk bağımsız tahmin.

## Önizlemeler

- `preview/katalog_on.png` — 35 heykel, oyunun açılış kamerasından
- `preview/katalog_34.png` — 35 heykel, 3/4 açıdan
- `preview/detay_on_34_arka_kesit.png` — her level için ön, 3/4, arka ve iç kesit (cepler görünür)
- `preview/oyun_ici.png` — oyun içinden L7, L16, L27, L35

## Editör ve Unity notu

Dosyalar editörün JSON formatında (schemaVersion 1, slotCount 5). **Üçlü bağ** şu an editörde ve Unity'nin ColonyLevelParser'ında yok: orada link tam 2 kovan olmalı. Bu yüzden L16, L22, L29 ve L35 editörde "Link N joins 3 hive(s)" hatası gösterir ve editörden dışa aktarınca üçlü bağlar silinir. Prototip üçlüyü destekliyor (3 boş slot ister, 2 iple çizilir). Editöre ve Unity'ye 3'lü link desteği eklenmeli. Diğer bütün kontroller editör kurallarıyla geçiyor (renk sayımı, çözülebilirlik, kazanma bandı).

## Yeniden üretmek

Heykeller ve kuyruklar kodla üretildi (`Swarmy/bee-colony/scripts/remaster/`):

```bash
cd Swarmy/bee-colony
node scripts/remaster/build.ts            # 35 level -> Swarmy/Remaster levels/level_N.json
node scripts/remaster/verify.ts           # bağımsız kural denetimi
node scripts/remaster/emit.ts             # prototipe aktar (src/levels_data.ts)
```
