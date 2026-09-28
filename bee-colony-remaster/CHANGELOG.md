# Bee Colony Remaster — Değişiklik Günlüğü

Canlı sürüm: https://joygamemobiletechnology.github.io/games/bee-colony-remaster/
(GitHub Pages sayfayı ~10 dakika önbellekte tutar; bir değişiklik görünmüyorsa sert yenileyin.)

## 28 Eylül 2026 — L8 gizli kovan tanıtımı referans gibi

- **L8 Toadstool:** kuyruğun ikinci sırasının tamamı gizli "?" kovan (3/3); ön sıra açık, üçüncü sıra olduğu gibi. Toplam 6 gizli kovan. "Yeni Engel!" kartı canlı board görüntüsü aldığı için üç "?" ile açılıyor.

## 28 Eylül 2026 — Slotlar ve booster çubuğu Cube Land ölçüsünde

- **Slotlar:** yumuşak köşeli, ince açık mavi çizgili koyu kareler; genişlik ekranın %13.5'i, aralık %2 (Cube Land ile aynı). Slot içindeki shooter kareyi dolduracak şekilde %12.1'e büyütüldü; kuyruk sıraları birbirinin arkasına basamaklı (öndeki sıra arkadakini örter). 6 slot çerçeveye sığıyor.
- **Booster butonları:** daire yerine yuvarlak köşeli kare (genişlik %15.4, köşe %22), merkez %94.7, aralık %2.7; mavi şerit %95.4'ten başlar. Kilitli hal gri + kilit + "LV N".

## 28 Eylül 2026 — Yeni Engel kartı, gizli kovan dokusu, iki tonlu halat

- **Yeni Engel! kartı:** Gizli kovan (L8) ve bağlı kovanlar (L13) ilk göründüğünde Cube Land'in "New Item" ekranının karşılığı: tam ekran kart, içinde o levelin board'unun anlık görüntüsü ve dokunan el; altında "Gizli Kovan / Bağlı Kovanlar — Açıldı!" ve tek satır kural. Dokununca kapanır. Bu iki mekanik için balon ipucu kalktı (cep ipucu balon olarak sürüyor).
- **Gizli kovan görünümü:** indigo gövde üstünde tekrarlayan "?" deseni, önde büyük "?" (referansla aynı).
- **Bağlı kovan halatı:** daha kalın; iki yarısı kendi kovanının renginde, farklı renklerde ortadan ayrılır.

## 28 Eylül 2026 — Son dalga ve bölüm sonu

- **Son dalga (finale):** Kuyrukta kalan shooter'lar boş slotlara sığdığı anda (ya da kuyruk boşalınca) kalanlar kendiliğinden slotlara yürür (0.12 s arayla), HUD ve booster çubuğu gizlenir, oyun 3x hızda oynar. Bir oyuncu dokunuşu şart; L1/L2 öğreticilerinde kapalı.
- **Bölüm sonu:** "NEW ITEM" ilerleme çubuğu kaldırıldı; başlık, coin, miktar ve iki buton kaldı.

## 28 Eylül 2026 — Art geri bildirimi turu 2

- **Varsayılan arka plan Sarı.** Ayarlardaki sıra: Sarı · Lacivert · Orman · Bal · Beyaz · Gri.
- **Shooter'larda tek çıkıntı:** iki "kulak" yerine ortada tek, biraz daha geniş bir düğme.
- **Slot ve kuyruk tam karşıdan:** board kamerası ortografik, aşağı eğim yok. Hizalar korundu (slot %68, sıralar %78 / %83 / %88).
- **Süpürge (Vacuum):** renk artık menüden değil, heykelde bir küpe dokunarak seçiliyor (buton → heykele dokun). Süpürülen rengin shooter'ları kuyruktan anında kalkıyor; bağlı çiftin halatı çözülüyor.
- **Booster tanıtım balonu bölümü kilitlemiyor:** oyuncu balonu görmezden gelip devam ederse balon 3 s sonra kendiliğinden kapanır (L6 Geri Al tanıtımı takılabiliyordu).
- **Tutorial eli** booster butonunun tam ortasına basıyor.
- **L6 Candy Heart:** kalbin arkasındaki delik bir mor küple kapatıldı (beyaz iç artık görünmüyor); mor shooter 7 → 8.

## 27 Eylül 2026 — Geri bildirim turu 1b: doğrulama düzeltmeleri (e0f9424)

Ekip kontrolünde "yapıldı" denip çalışmadığı görülen maddeler, referans ekran görüntülerinden ölçülerek yeniden yapıldı.

- **Boşta dönme (C1):** Shooter'a dokunmak heykeli artık durdurmuyor. Yalnızca heykeli sürüklemek veya iki parmakla tutmak durduruyor; dokunuş bittiği anda 2 s sayaç yeniden başlar.
- **Ayarlar ana menüde çalışıyor:** Modal katmanı ana menünün üstüne alındı; bölüm seçme ızgarası oyun başlamadan da dolu geliyor.
- **Heykel pivotu ve 360°:** Dönüş merkezi heykelin hacim merkezine taşındı (önceden tabanındaydı, eğince sallanıyordu). Yatay ve dikey eksende sınırsız serbest dönüş; eğim sınırı kaldırıldı.
- **Ana menü alt navigasyon:** Yükseklik %14 → %11.5 (Cube Land ölçüsü). İkonlar Mağaza / Ana sayfa / Albüm.
- **Slot ve kuyruk hizası:** Slot satırı merkezi %69, kuyruk sıraları %77 / %83 / %88.5; üçüncü sıranın yarısı booster çubuğunun arkasında kalıyor. Heykel merkezi ~%37.
- **Booster çubuğu:** Piksel yerine ekran yüzdesiyle ölçülendirildi: buton genişliği %12.8, buton merkezi %93.75, mavi şerit %95–100.
- **Arı rotası:** Arılar heykelin içinden geçmiyor. Yüz normali boyunca yaklaşma, düz hat heykeli kesiyorsa heykel etrafında çember rota, çıkışta yine normal boyunca uzaklaşıp ekran dışına.
- **Arka planlar 3 → 6:** Beyaz, Gri ve Sarı açık temalar eklendi. Ayarlarda tüm seçenekler renk örneği olarak yan yana; açık temada bölüm başlığı ve ilerleme şeridi koyulaşıyor.
- README güncellendi (görüş önceliği, kübik shooter, son dalga, 6 arka plan, merkezden 360° dönüş).

## 27 Eylül 2026 — Ekip geri bildirimi turu 1 (27f85c2)

25 Eylül paylaşım notu + 27 Eylül ekip geri bildirimi tek listede (A1–D4) toplandı ve uygulandı.

- **A1 Oyun içi hizalar:** Heykel merkezi ~%38; slot satırı ve üç kuyruk sırası referans çizgilerinde.
- **A2 Ana menü hizaları:** Üst satır %8 (avatar, can, coin, ayarlar), "Bölüm N" butonu %70–78, alt navigasyon.
- **A3 Ana menü yanları:** Sol Görevler / Etkinlik / Günlük, sağ Teklif / Reklamsız rozetleri (kilitli yer tutucu).
- **A4 Booster çubuğu:** Yuvarlak butonlar, LV kilit etiketleri, Cube Land hizası.
- **A5 Zor seviye etiketi:** Ana menüde "ZOR SEVİYE" kurdelesi, oyun içinde başlık yanında kafatası etiketi.
- **B1 Kübik shooter:** Yuvarlatılmış küp gövde + iki çıkıntı, parlak materyal, sayı ön yüzde; arılar ön yüzden çıkıyor. Kovan evi modeli kaldırıldı.
- **B2 Görüş önceliği:** Arılar önce gördükleri küpleri alır; 1.5 s boyunca görünen hedef yoksa arkayı / her açık yüzü arar. L2 döndürme adımında oyuncu çevirene kadar bekler. L2 metinleri yeniden yazıldı.
- **B3 En yakın küp:** Hedef seçimi kesin olarak shooter'a en yakın küp (rastgelelik payı 0.3 birim).
- **D1 Son dalga:** Kuyruk boşalınca arı çıkışı ×2, arı üst sınırları ×2, hız ×1.5, "🐝 Son dalga! Arılar hızlandı" bildirimi.
- **D2 Mekanik ipuçları:** Gizli "?", bağlı çift ve cep heykeli için tek seferlik balon açıklamaları.
- **D3 Seviye geçişi:** L35 Rainbow Bear 3 sıraya zorlandı; kafatası oranı %36 → %21.
- **D4 Arka plan varyantları:** Lacivert / Orman / Bal, ayarlardan değiştirilebilir, tercih kaydediliyor.

## 25 Eylül 2026 — Remaster temeli v0.5 (31aead3)

Bee Colony, Cube Land Puzzle referansına göre yeniden kuruldu ve ekibe bu haliyle paylaşıldı.

- **Yerleşim:** Heykel ekranın üst yarısında boşlukta; slotlar ve kuyruk ayrı sabit kamera katmanında; delik/masa yok; arılar küpleri ekran dışına taşıyor.
- **Büyük küpler:** Bir editör küpü = bir küp = bir arı seferi; shooter sayıları editör değerleri (2×2×2 parça denemesi geri alındı).
- **Shooter ekonomisi:** Tek shooter en fazla 80 arı; yuvarlak sayılar (80/60/50/40/30/25/20/15/10); bölünen kovanlar seviyeye yayılır, aynı renk arka arkaya gelmez. Heykel modelleri değişmedi.
- **5 yeni cep seviyesi:** Rubik, balkabağı, pasta, skep kovan, balık; 10. bölümden sonra aralıklarla; toplam 35 seviye.
- **L2 yıldız + FTUE:** Sarı ön / turuncu arka yüz; dokun → uyu → çevir → gör → 2x adımları.
- **Gizli "?" kuralı:** Ön sıradaki shooter hiç gizli olmaz; önündeki shooter slota gidince açılır.
- **Yeni arı modeli:** Bee Colony oranlarında, abstract / minimal, kask yok; instanced çizim.
- **Hareket:** Shooter → slot geçişi yumuşak süzülüş; heykel salınımı kaldırıldı; döndürürken havadaki arılar çalışmaya devam eder.
- **Boşta dönme:** 2 s sonra sola, sadece dikey eksende; bırakılan açıda kalır.
- **Shooter/slot polish:** Cube Land'e yakın form; slotlar dik koyu plaka.
- Booster kilitleri 6/9/12/15/18; ilerleme tarayıcıda saklanır.
