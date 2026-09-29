# Bee Colony Remaster — Değişiklik Günlüğü

Canlı sürüm: https://joygamemobiletechnology.github.io/games/bee-colony-remaster/
(GitHub Pages sayfayı ~10 dakika önbellekte tutar; bir değişiklik görünmüyorsa sert yenileyin.)

## 30 Eylül 2026 — Yolculuk

- **Yolculuk sekmesi (Katalog yerine):** ana menü alt barının sağındaki sekme artık Yolculuk; ikonu iğneli bir harita.
- **Yol:** Cube Land'in dikey Journey haritası referans alındı, şehir kilidi yok. Bölüm 1 en altta, yol yukarı doğru 35. bölüme çıkar; sıradaki bölüme kadar yeşil dolar, üstü mor. Zemin deniz; kenarlardan adalar ve kesik çizgili rotalar görünür.
- **Adımlar:** her bölüm yolun üstüne oturan mavi bir kapsül: solda "Bölüm N" ve heykelin adı, sağda o bölümün hedef heykeli. Bitirilen bölümde heykel renkli, yeşil tikli; bitirilmeyenlerde gri, kilitli, adı "???". Zor bölümlerde 💀. Sıradaki bölüm altın çerçeveli ve "SIRADAKİ" etiketli.
- **Gezinme:** ekran sıradaki bölüme ortalanmış açılır; yukarı kaydırınca kilitli heykeller, aşağı kaydırınca toplananlar. Yolun tepesinde kupa ve "N / 35 heykel toplandı" sayacı, dibinde başlangıç kovanı.

## 29 Eylül 2026 — Yeni level seti (35 level, yüksek çözünürlük)

- **35 yeni level:** heykeller baştan, çok daha yüksek çözünürlükte kuruldu. Toplam 43.990 küp (eski set 10.577, ×4,2), level başına 560–1740 küp. Anlaşılmayan eski şekiller (donut, külahta dondurma, akide şekeri, ikinci mercan balığı, arı kovanı) yok; her konu tek. Sırayla: Kiraz İkilisi, Küçük Yıldız, Lastik Ördek, Oklu Kalp, Karpuz, Mantar, Penguen, Gülen Güneş, Roket, 💀 Hediye Kutusu, Çilek, Kardan Adam, Yılbaşı Çanı, Uğur Böceği, Kelebek, 💀 Balkabağı, Palyaço Balığı, Hamburger, Baykuş, Sıcak Hava Balonu, Ananas, 💀 Kumbara, Oyuncak Ayı, Deniz Feneri, Yelkenli, Kurbağa Prens, Kale, Robot, 💀 Hazine Sandığı, Uçan Daire, Kek, Kaktüs, Bal Kavanozu, Ahtapot, 💀 Kraliçe Arı.
- **Kuyruk kuralları:** kovanlar en fazla 80 ve hepsi 10'un katı; her rengin kovan toplamı küp sayısına eşit; bölünen renk hiçbir şeritte arka arkaya gelmez, aynı renk ikiden fazla şeridin önünde durmaz. Slot sayısı her levelde 5.
- **Cepler:** 34 levelde en az bir renk heykelin içinde tamamen kapalı; başta tek küpü görünmez, o rengin kovanı cep açılana kadar uyur (ördeğin içine dolan su, penguenin yuttuğu gümüş balık, çanın gümüş özü, hediye kutusunun dört oyuncak bölmesi, kumbaranın altın/gümüş/banknot bölmeleri, kraliçe arının koyu balı ve arı sütü…). 24 levelde cepler her yerden en az 2 kat örtülü. Cep ipucu L5'te bir kez çıkar.
- **Gizli ve bağlı kovanlar:** gizli "?" L8'den (ikinci sıra tamamen gizli). Bağlı ikili L9'da Slot Ekle ile aynı levelde tanıtılır: önce "Yeni Engel!" kartı, kart kapanınca Slot Ekle balonu. **Üçlü bağ** yalnız zor levellerde (16, 22, 29, 35): üç kovan birlikte gider, 3 boş slot ister, 2 iple çizilir; ilk görüldüğü yerde "Üçlü bağ!" balonu.
- **Zorluk:** her kuyruk dikkatsiz oyuncuya karşı ölçüldü. Normal levellerde gerçek kazanma %77–96 (kolay level de kaybedilebilir), zor levellerde (10/16/22/29/35) %17–28. Yalnız L1–L2 (FTUE) ve ince L15 Kelebek kaybedilemez.
- **Süre:** daha çok küp için arı akışı hızlandı (kovan 0,08 sn'de bir arı çıkarır, kovan başına 10 arı yolda, ekranda en fazla 110). Bot ile 1x ortalama L1–14 41 sn (Cube Land 38 sn), L15–35 56 sn.
- **Eşek Arısı:** joker kovan 30 arı (büyük heykeller için).
- Leveller `levels/` klasöründe (editör formatı), set açıklaması `levels/README.md`, önizlemeler `levels/preview/`. Not: editör ve Unity şu an yalnız ikili bağı kabul ediyor; üçlü bağlı dört level (16, 22, 29, 35) editörde hata gösterir.

## 29 Eylül 2026 — Katalog

- **Katalog sekmesi (Dünya Haritası yerine):** ana menü alt barının sağındaki sekme artık Katalog; ikonu mor kitap üstünde altın küp.
- **İçerik:** 35 bölümün hedef heykeli, bölüm sırasıyla 2 sütunlu ızgarada; aşağı kaydırılarak sona kadar inilir. Resimler oyunun küpleri ve ışığıyla çizilen küçük 3D görüntüler (önden, hafif sol-üstten); sekme açılınca birkaç karede dolar, sonra önbellekten gelir.
- **Kilitli:** bitirilmemiş bölümün heykeli gri ve soluk, sağ altında altın kilit rozeti, isim yerine "???".
- **Açık:** bölüm bir kez bitirilince kart renklenir ve altında Türkçe adı yazar (ör. Kiraz İkilisi, Küçük Yıldız). Sol üstte bölüm numarası, zor bölümlerde sağ üstte 💀.
- Üstte "N / 35 heykel toplandı" sayacı ve ilerleme çubuğu; başlık, lacivert kapitone zemin ve krem kartlar Mağaza ile aynı dilde.
- **Kayıt:** ilerlemeye bitirilen bölümler listesi eklendi (tekrar oynamak çift saymaz). Eski kayıtlarda ulaşılan bölümün altındaki her bölüm bitmiş sayılır.

## 29 Eylül 2026 — Mağaza

- **Mağaza sekmesi açıldı:** ana menünün alt barındaki Mağaza artık kilitli değil; üstteki altın göstergesine dokunmak da mağazayı açar.
- **Özel Teklif:** Reklamsız (TRY 569.99, "POPÜLER").
- **Paketler:** Başlangıç (5,000 altın + her booster ×1, TRY 459.99), Pro (10,000 + ×5, TRY 749.99), Ultimate (25,000 + ×10, TRY 1,149.99). Referanstaki sınırsız can döşemesinin yerine beşinci booster konuldu.
- **Altın Paketleri:** 1,000 / 5,000 / 10,000 / 30,000 / 75,000 / 200,000 altın; TRY 55.99 / 284.99 / 569.99 / 1,439.99 / 2,829.99 / 5,659.99.
- **Günlük Bedava Altın:** günde bir kez +20 altın.
- Fiyat yazıları butona sığacak şekilde otomatik küçülür. Satın almalar prototipte test amaçlıdır; ürün anında verilir, ödeme alınmaz.

## 28 Eylül 2026 — Ekonomi

- **Kalıcı booster envanteri:** booster adetleri artık bölümden bölüme taşınıyor ve kayıtta tutuluyor (önceden her bölüm sabit adetle başlıyordu).
- **Tanıtım hediyesi:** her booster açıldığı bölümde 1 adet bedava verir (bir kez).
- **Satın alma:** adet 0 olunca butonda yeşil "+" çıkar; dokununca satın alma paneli açılır, panel açıkken oyun durur. Paketler: Geri Al ×3 900, Slot Ekle ×1 1800, Eşek Arısı ×2 1600, Karıştır ×3 900, Vakum ×1 1800 altın. Yetersiz altında "Yetersiz altın" uyarısı, harcama yok.
- **Altın:** oyun 1000 altınla başlar; bölüm sonu 30 altın (reklamla ×2). Ekonomi öncesi kayıtlara bir kez 1000 altın ve daha önce tanıtılmış her booster için 1 adet eklenir.
- **İsimler:** Wild Bee / Shuffle / Vacuum yerine Eşek Arısı / Karıştır / Vakum.

## 28 Eylül 2026 — Arkayı arama beklemesi kaldırıldı

- **Görüş önceliği:** görünür küp yoksa kovan artık 1.5 s beklemeden hemen herhangi bir açık yüzlü küpü hedefler. Tek istisna L2 öğreticisi (turuncu kovan oyuncu çevirene kadar bekler).

## 28 Eylül 2026 — Ana menü alt bar + tanıtım kartı düzeltmesi

- **Alt navigasyon:** Mağaza (sol) · Ana sayfa (orta, yükseltilmiş) · Dünya Haritası (sağ, Albüm yerine). Mağaza ve Dünya Haritası kilitli, ikonun sağ üstünde kilit rozeti. İkonlar yumuşak düz vektör (kübik değil); barın üstünde altın çizgi.
- **Yeni Engel! kartları:** eski kayıtlarda gizli/bağlı ipuçları balon döneminde "görüldü" işaretlendiği için kart hiç açılmıyordu. Kartlar artık kendi bayraklarını kullanıyor (herkes bir kez daha görür); aynı levelde iki engel varsa kartlar peş peşe gelir.

## 28 Eylül 2026 — Slot köşeleri gerçekten yumuşak

- **Slotlar:** plakalar düz yuvarlak-köşeli şekil olarak çizildi (köşe yarıçapı %24, dış çizgi %3). Önceki plaka kalınlığı yüzünden köşe %5'te kalıyor, sert kare görünüyordu. Tanıtım kartları canlı board görüntüsü aldığı için otomatik güncellendi.

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
