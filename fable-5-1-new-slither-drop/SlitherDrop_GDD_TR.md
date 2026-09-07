# 🕳️ SlitherDrop — Oyun Tasarım Dokümanı

> *Drop Away'in renk eşleştirmeli ızgara mantığını, Gecko Out'un yılan tarzı sürükleme hareketiyle birleştiren bir bulmaca oyunu.*

---

## İçindekiler

1. [Oyuna Genel Bakış](#1-oyuna-genel-bakış)
2. [Temel Konsept](#2-temel-konsept)
3. [Oyun Öğeleri](#3-oyun-öğeleri)
   - 3.1 [Izgara Tahtası](#31-ızgara-tahtası)
   - 3.2 [Çöp Adamlar](#32-çöp-adamlar)
   - 3.3 [Delikler](#33-delikler)
4. [Mekanikler](#4-mekanikler)
   - 4.1 [Delikleri Sürükleme (Yılan Hareketi)](#41-delikleri-sürükleme-yılan-hareketi)
   - 4.2 [Renk Eşleştirme Kuralları](#42-renk-eşleştirme-kuralları)
   - 4.3 [Çöp Adam Toplama](#43-çöp-adam-toplama)
   - 4.4 [Delik Kapasitesi ve Kaybolma](#44-delik-kapasitesi-ve-kaybolma)
5. [Kazanma ve Başarısızlık Koşulları](#5-kazanma-ve-başarısızlık-koşulları)
6. [Bölüm Tasarımı Yönergeleri](#6-bölüm-tasarımı-yönergeleri)
7. [Örnek Bölüm Çözümü](#7-örnek-bölüm-çözümü)
8. [Görsel ve Ses Yönü](#8-görsel-ve-ses-yönü)
9. [İlerleme Sistemi](#9-ilerleme-sistemi)
10. [Teknik Notlar](#10-teknik-notlar)

---

## 1. Oyuna Genel Bakış

**Başlık:** SlitherDrop *(çalışma adı)*
**Tür:** Casual Bulmaca
**Platform:** Mobil (iOS / Android)
**Oyuncu Sayısı:** Tek oyunculu
**Oturum Süresi:** Bölüm başına 1–3 dakika
**Hedef Kitle:** 10 yaş ve üzeri casual bulmaca severler

**Kısa Tanıtım (Elevator Pitch):**
> Renkli delikleri ızgara üzerinde kayan bir gecko gibi sürükleyip eşleşen çöp adamları yutun — ama rotanızı dikkatle planlayın, çünkü geçtiğiniz her hücre bir kuyruk bırakır ve her deliğin iştahı sınırlıdır.

---

## 2. Temel Konsept

SlitherDrop, iki farklı mobil bulmaca mekaniğini birleştirir:

| Mekanik | Kaynak Oyun | SlitherDrop'taki Rolü |
|---|---|---|
| Izgara üzerinde sabit duran, deliklerle/bloklarla renk eşleştirilen çöp adamlar | Drop Away | Bulmaca düzenini ve toplama hedeflerini tanımlar |
| Izgara üzerinde sürüklenebilir yılan tarzı hareket | Gecko Out | Deliklerin oyuncu tarafından nasıl hareket ettirileceğini belirler |

Temel gerilim: delikler yılan gibi hareket eder (gövde, başın izlediği yolu takip eder), bu yüzden rota planlaması önemlidir. Bir delik, bir çöp adamın altından yalnızca renkler eşleşiyorsa geçebilir ve kapasitesini dolduracak kadar çöp adam topladığında kaybolur.

---

## 3. Oyun Öğeleri

### 3.1 Izgara Tahtası

- Kare hücrelerden oluşan dikdörtgen bir ızgara (örn. 6×8, 7×9).
- Her hücre **boş** olabilir, bir **çöp adam** içerebilir veya bir **deliğin** parçası tarafından doldurulmuş olabilir.
- Izgara sabittir; kaymaz ve dönmez.
- Izgara dışındaki hücreler duvardır — delikler oraya hareket edemez.

---

### 3.2 Çöp Adamlar

- **Görünüm:** Tek bir düz renkle çizilmiş, küçük ve basit çöp adam karakterleri.
- **Yerleşim:** Bölüm başında belirli ızgara hücrelerine sabitlenir. Oyuncu tarafından **hareket ettirilemezler**.
- **Renkler:** Her çöp adamın tek bir rengi vardır (örn. kırmızı, mavi, yeşil, sarı, mor, turuncu).
- **Davranış:** Eşleşen renkteki bir delik, altlarındaki hücreye girdiğinde çöp adam toplanır (içine düşer).
- **Durum:** Toplandıktan sonra çöp adam tahtadan kaybolur ve deliğin doluluk sayacı 1 artar.

> ℹ️ Tahtada aynı renkten birden fazla çöp adam bulunabilir. Farklı renkteki çöp adamlar, kendileriyle eşleşmeyen delikler için engeldir.

---

### 3.3 Delikler

- **Görünüm:** Bir veya daha fazla ızgara hücresini kaplayan, renkli ve düzensiz şekilli bir açıklık.
- **Şekil:** Delikler birbirine bağlı birden fazla hücreye yayılabilir (örn. L şekli, T şekli, düz çizgi, 2×2 kare). Şekil, bölüm tasarımıyla belirlenir.
- **Renk:** Her deliğin, toplayabileceği çöp adamlarla eşleşmesi gereken tek bir rengi vardır.
- **Kapasite:** Deliğin başlangıç boyutunda kapladığı ızgara hücresi sayısına eşittir. 3 hücre kaplayan bir delik en fazla 3 çöp adam toplayabilir.
- **Hareket:** Sürükleme ile oyuncu kontrolünde. Yılan gibi hareket eder: baş öncülük eder, gövde tam olarak aynı yolu izler.
- **Birden Fazla Delik:** Bir bölümde aynı anda farklı renk ve şekillerde birkaç delik bulunabilir.
- **Kaybolma:** Bir delik, kapasitesine eşit sayıda çöp adam topladığında doyar ve tahtadan kaybolur.

> ⚠️ Bir delik, **farklı** renkteki bir çöp adamın bulunduğu hücreye giremez. O hücre, söz konusu delik için duvar görevi görür.

---

## 4. Mekanikler

### 4.1 Delikleri Sürükleme (Yılan Hareketi)

Oyuncu, deliklerle **sürükleyerek** etkileşime girer:

1. **Seçme:** Bir deliğin herhangi bir hücresine dokunup basılı tutarak deliği seçin.
2. **Sürükleme:** Herhangi bir yöne kaydırın. Deliğin "başı" (öncü hücre) sürükleme yönüne doğru hareket eder; tüm gövde hücreleri, başın izlediği yolu tekrarlayarak birer adım takip eder.
3. **Yol Sadakati:** Deliğin gövdesi, başın izlediği yolu birebir izler. Baş önce sola sonra yukarı döndüyse, gövde de takip ederken sırayla sola sonra yukarı kıvrılır.
4. **Izgaraya Kilitli:** Hareket ızgaraya oturtulur. Bir sürükleme hareketi = adım başına bir hücre. Hızlı sürüklemeler art arda birden fazla hücre ilerletebilir.
5. **Kendi Üzerinden Geçmeme:** Bir deliğin gövdesi kendi üzerine binemez.
6. **Diğer Deliklerden Geçmeme:** Delikler, başka deliklerin doldurduğu hücrelerden geçemez.

> 🐍 Her deliği bir gecko/yılan gibi düşünün. Herhangi bir andaki şekli, ziyaret ettiği son N hücreyle belirlenir; N, deliğin mevcut uzunluğudur.

---

### 4.2 Renk Eşleştirme Kuralları

| Senaryo | Sonuç |
|---|---|
| Delik, **eşleşen renkte** bir çöp adamın bulunduğu hücreye girer | ✅ Çöp adam toplanır, deliğin doluluk sayacı artar |
| Delik, **eşleşmeyen** bir çöp adamın bulunduğu hücreye girmeye çalışır | ❌ Engellenir — delik o hücreye giremez |
| Delik **boş** bir hücreye girer | ✅ Serbestçe izin verilir |
| Delik, **başka bir deliğin** doldurduğu hücreye girer | ❌ Engellenir |

Renk eşleştirme katıdır — kısmi eşleşme veya joker yoktur (ileri bölümlerde özel bir mekanik olarak tanıtılmadığı sürece).

---

### 4.3 Çöp Adam Toplama

- Bir deliğin başı, aynı renkte bir çöp adam içeren hücreye girdiğinde çöp adam anında toplanır.
- Çöp adam kaybolur (kısa bir animasyonla aşağı düşer).
- Deliğin dahili doluluk sayacı 1 artar.
- Delik, toplama sonrasında normal şekilde hareket etmeye devam eder.
- Rota art arda eşleşen hücrelerden geçtiği sürece, bir delik tek bir sürükleme hareketinde birden fazla çöp adam toplayabilir.

---

### 4.4 Delik Kapasitesi ve Kaybolma

- Her deliğin, başlangıçta kapladığı ızgara hücresi sayısına eşit bir **kapasitesi** vardır.
  - Örnek: 3 hücreli L şeklinde bir deliğin kapasitesi 3'tür.
- Delik çöp adam topladıkça **doluluk sayısı** artar.
- **Doluluk sayısı = kapasite** olduğunda delik dolmuş olur:
  - Bir doyum animasyonu oynatır (örn. parlar, küçülür, patlar).
  - Tahtadan **tamamen kaldırılır**.
- Gövdesi birden fazla hücreyi kaplarken kaldırılan bir deliğin tüm hücreleri anında boşalır.

> 💡 Tasarım çıkarımı: Bir delik, geçtiği her hücre için (eşleşiyorsa) bir çöp adam toplar. Gövde uzunluğu oyun sırasında asla kısalmaz — yalnızca doluluk sayacı artar. Deliğin ızgara üzerindeki uzunluğu, kaybolana kadar sabit kalır.

---

## 5. Kazanma ve Başarısızlık Koşulları

### ✅ Kazanma Koşulu
Bölüm şu durumda **tamamlanır**:
- Tüm çöp adamlar toplanmıştır (tahtada sıfır çöp adam kalmıştır), **VE**
- Tüm delikler doldurulup kaldırılmıştır (tahtada sıfır delik kalmıştır).

Her iki koşul aynı anda sağlanmalıdır. Oyun, yıldızlar/puan içeren bir zafer ekranı gösterir.

### ❌ Başarısızlık / Tıkanma Koşulu
Geleneksel anlamda bir "başarısızlık" yoktur — oyuncu geri alınamaz bir hamle yapamaz (delikleri her zaman geri sürükleyebilir). Ancak:
- Oyuncu bir **çıkmaza** girerse (hiçbir delik, eşleşmeyen çöp adamlar tarafından engellenmeden eşleşen bir çöp adama ulaşamıyorsa), bir **ipucu** veya **sıfırlama** seçeneği sunulur.
- Meydan okuma modları için isteğe bağlı bir **hamle sayacı** eklenebilir; hamle limitinin aşılması, bölümü yeniden başlatma uyarısını tetikler.

---

## 6. Bölüm Tasarımı Yönergeleri

### Zorluk Kademeleri

| Kademe | Izgara Boyutu | Renk Sayısı | Delik Sayısı | Delik Şekilleri | Notlar |
|---|---|---|---|---|---|
| Öğretici | 4×5 | 1–2 | 1–2 | Düz (2 hücre) | Sürükleme ve renk kurallarını öğretir |
| Kolay | 5×6 | 2–3 | 2–3 | Düz, L şekli | Basit rotalama, tuzak yok |
| Orta | 6×7 | 3–4 | 3–4 | L, T, S şekilleri | Delikler dikkatle sıralanmalı |
| Zor | 7×8 | 4–5 | 4–5 | Karmaşık çok hücreli | Renkle engelleme, rota planlaması gerekir |
| Uzman | 8×9+ | 5–6 | 5–6 | Her şekil | Dar koridorlar, birbirine bağımlı delikler |

### Tasarım İlkeleri

1. **Her bölüm çözülebilir olmalıdır.** Yayımlamadan önce çözüm yollarını doğrulayın.
2. **Renkle engelleme bilinçli olmalıdır.** Eşleşmeyen çöp adamlar, oyuncuyu delikleri rastgele değil yaratıcı biçimde yönlendirmeye zorlamalıdır.
3. **İşlem sırası önemlidir.** Engellemeyi önlemek için bazı delikler diğerlerinden önce hareket ettirilmelidir. İyi bölümler, ileriyi düşünen oyuncuları ödüllendirir.
4. **Varsayılan olarak çıkmaz sokaklardan kaçının.** Özel olarak bir bulmaca öğesi olarak tasarlanmadığı sürece, deliklerin her zaman en az bir eşleşen çöp adama ulaşabilecek bir yolu olmalıdır.
5. **Kapasite, arzla eşleşmelidir.** Bir bölümdeki tüm deliklerin toplam kapasitesi, tahtadaki toplam çöp adam sayısına tam olarak eşit olmalıdır (böylece kazanma koşulu her zaman ulaşılabilir olur).

---

## 7. Örnek Bölüm Çözümü

### Bölüm Kurulumu (5×5 ızgara, 2 renk)

```
[ ][ K ][ ][ M ][ ]
[ ][ K ][ ][ M ][ ]
[ ][ ][ ][ ][ ]
[🔴]────[🔴]  [🔵]──[🔵]
[ ][ ][ ][ ][ ]
```

- **Kırmızı Delik:** L şeklinde, 3 hücre, kapasite 3. Sol altta başlar.
- **Mavi Delik:** Düz, 2 hücre, kapasite 2. Sağ altta başlar.
- **Kırmızı Çöp Adamlar:** Toplam 3 adet, 2. sütunda, 1–3. satırlarda.
- **Mavi Çöp Adamlar:** Toplam 2 adet, 4. sütunda, 1–2. satırlarda.

### Çözüm Yolu

1. Oyuncu **Kırmızı Deliği** 2. sütun boyunca yukarı sürükler → 3 kırmızı çöp adam toplanır → Kırmızı Delik kaybolur.
2. Oyuncu **Mavi Deliği** 4. sütun boyunca yukarı sürükler → 2 mavi çöp adam toplanır → Mavi Delik kaybolur.
3. Tahta temizlenir → **Bölüm Tamamlandı!**

Daha zor bölümlerdeki zorluk: mavi çöp adamlar kırmızı deliğin yoluna yerleştirilebilir ve oyuncuyu etraflarından dolaşmaya zorlar.

---

## 8. Görsel ve Ses Yönü

### Görseller

- **Sanat Tarzı:** Parlak, düz (flat), çizgi film tarzı. Kalın dış hatlar. Her iki kaynak oyunun neşeli tarzından esinlenir.
- **Çöp Adamlar:** Yuvarlak kafalı ve düz renkli gövdeli, basit ve ifadeli çöp adamlar. Boşta animasyonları (hafif zıplama, göz kırpma).
- **Delikler:** Kenarında rengiyle uyumlu hafif bir parlama bulunan renkli boşluklar olarak çizilir. Başı kuyruktan ayırmak için yılan gövdesi, aynı rengin biraz daha açık tonunda olmalıdır.
- **Izgara:** İnce ızgara çizgileri, açık nötr arka plan. Hücrelerde yumuşak bir doku.
- **Toplama Animasyonu:** Çöp adam deliğe doğru uzar, ardından "yutma" efektiyle içine düşer.
- **Delik Kaybolması:** Doyan delik dalgalanır, beyaz parlar ve renkli parçacık patlamasıyla içe çöker.

### Ses

- **Çöp Adam Toplandı:** Yumuşak, tatmin edici bir "pop" veya "yutma" sesi.
- **Delik Kayboldu:** "Vuuş + çan" sesi.
- **Geçersiz Hamle:** Sessiz, boğuk bir "tık" — cezalandırıcı değil, sadece bilgilendirici.
- **Bölüm Tamamlandı:** Neşeli kısa bir müzik, konfeti parçacıkları.
- **Arka Plan Müziği:** Her dünya temasına özel, döngüde çalan lo-fi veya hafif ambient parça.

---

## 9. İlerleme Sistemi

### Dünya Temaları
Her dünyanın (~20 bölüm) kendine özgü bir görsel teması vardır:

| Dünya | Tema | Tanıtılan Mekanik |
|---|---|---|
| 1 | Çayır | Temel sürükleme ve renk eşleştirme |
| 2 | Şehir | Çok hücreli delik şekilleri |
| 3 | Okyanus | 4+ renkli bölümler |
| 4 | Volkan | Dar koridorlar, zorunlu sıralama |
| 5 | Uzay | Uzman seviye rotalama, 6 renk |

### Meta Sistemler (İsteğe Bağlı)
- ⭐ **Yıldız Derecelendirmesi:** Hamle sayısına veya süreye göre bölüm başına 1–3 yıldız.
- 💡 **İpuçları:** Bir sonraki en iyi hamleyi vurgulayan, sınırlı sayıda ipucu.
- 🔄 **Geri Al Düğmesi:** Son sürükleme hareketini geri alır (sınırlı veya sınırsız, tasarım tercihi).
- 🏆 **Günlük Meydan Okumalar:** Liderlik tablosu sıralaması olan, süreli özel bölümler.

---

## 10. Teknik Notlar

### Izgara Temsili
- Tahta, hücrelerden oluşan 2 boyutlu bir dizi olarak saklanır.
- Her hücre şunları izler: `isEmpty`, `stickmanColor` (boşsa null), `holeId` (delik yoksa null).

### Delik Veri Yapısı
```
Hole {
  id: string
  color: Color
  cells: List<GridPosition>   // baştan kuyruğa sıralı
  capacity: int               // = başlangıçtaki cells.length
  filledCount: int            // 0'dan başlar
}
```

### Hareket Doğrulaması (adım başına)
```
canMoveTo(hole, targetCell):
  eğer targetCell sınırların dışındaysa → ENGELLE
  eğer targetCell farklı renkte bir çöp adam içeriyorsa → ENGELLE
  eğer targetCell başka bir delik tarafından doldurulmuşsa → ENGELLE
  eğer targetCell deliğin kendi kuyruğuysa (sonraki adım) → İZİN VER (kuyruk oradan ayrılacak)
  aksi halde → İZİN VER
```

### Toplama Tetikleyicisi
```
onHoleEntersCell(hole, cell):
  if cell.stickmanColor == hole.color:
    removeStickman(cell)
    hole.filledCount += 1
    if hole.filledCount == hole.capacity:
      removeHole(hole)
      checkWinCondition()
```

### Kazanma Kontrolü
```
checkWinCondition():
  if allStickmen.count == 0 AND allHoles.count == 0:
    triggerLevelComplete()
```

---

*Doküman sürümü: 1.0 | Durum: Konsept / Ön Üretim*
