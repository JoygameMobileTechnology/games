# Cube Buddies — Parkur Ekibi

`index.html` dosyasını Chrome, Edge veya Safari ile aç. Kurulum, sunucu ve internet gerekmez. Three.js r160, arayüz, karakterler, ses üretimi ve oyun kodu tek dosyanın içindedir. WebGL (donanım hızlandırması) gerekir.

## Oyun

- Alttaki (geniş ekranda sağdaki) sıradan bir kamyon seç. Kamyon öndeki yoldan gelir, boş park yerlerinden en uzaktakine geri geri girer ve kabininden o rengin ekibi iner. Yolda aynı anda tek kamyon manevra yapar; arka arkaya gönderilenler sırayla gelir.
- Ekip, kendi rengindeki küpleri toplayıp kamyonun arkasına atar; küpler orada üst üste istiflenir. Üstünde başka küp duran küp alınamaz; yapı hep tepeden aşağı sökülür. Kamyonun üstündeki sayı yüklenen / istenen küp sayısıdır (örneğin 3/7); dolunca ekip kamyona biner, kamyon yüküyle yola çıkıp gider ve park yeri boşalır.
- Her sütunda yalnızca en üstteki kamyon seçilebilir. Alttaki renklere ulaşmak için önce üstlerindeki küpleri kaldırman gerekir.
- Rengindeki bütün küplerin üstü kapalı olan kamyon sallanır; ona dokunup sıraya geri gönderebilirsin.
- Sürükle: kamerayı döndür. Tekerlek / iki parmak: yakınlaş. Çift tık: kamerayı sıfırla.
- `1` `2` `3` `4`: sütundaki kamyonu gönder. Boşluk: mola. Üstteki ▶ düğmesi oyunu kendi kendine oynatır, `1×` düğmesi oyunu hızlandırır: `2×` yazar, gerçek hız 1,7 kattır.
- 150 bölüm, 22 renk ve toplam 102.765 küp var. İlk beş bölüm parkuru öne çıkarmak için elle tasarlandı: İkiz Kuleler, Merdiven, Kale, Sütun Ormanı ve Köprü. Ayrık kuleler, basamak sütunlar ve köprüler ekibi kuleden kuleye atlamaya yönlendirir; yüksek kulelere duvardan koşmak, basamaklardan sıçrayarak çıkmaktan pahalı olduğu için ekip sıçramayı seçer. Bu bölümler `scripts/intro-levels.cjs` ile üretilir (`npm run design:intro`); kamyon sırası, önce üstteki küpleri alan bir deneme oyunuyla dağıtılır. Sol üstteki bölüm düğmesinden herhangi bir bölümü seçebilirsin. Adres sonuna `?level=150` ekleyerek doğrudan bir bölümü açabilirsin. 150. bölümden sonra tekrar dizisi 30. bölümden başlar; bu dizide 51, 71, 91 ve 111 atlanır. Bölüm seçicide 150 bölümün tamamı her zaman erişilebilir.

## Parkur

Karakterler yürüyerek tırmanmaz; yol bulucu her geçişi bir parkur hareketi olarak seçer:

- koşu, arada çember/yan takla
- tek basamak: sıçrama, öne takla veya yan takla
- alçak duvar: zıplayıp kenara tutunma ve kendini yukarı çekme
- yüksek duvar: duvarda dikine koşu, tepede kenara tutunma ya da takla ile üstüne çıkma
- boşluk: bir çatıdan diğerine uzun atlayış; hedef daha yüksekse kenarı yakalayıp yukarı çekilme
- iniş: kenardan uzağa doğru geniş bir yayla atlayış; öne/arkaya takla, burgu veya çift takla
- küpü alma: önce küpün yanında durulacak bir yer aranır — küpün kendi seviyesinde, hemen yanında ya da yandaki aynı yükseklikteki küpün üstünde. Böyle bir yer yoksa karakter küpün üstüne çıkıp ayağının altından alır. Aşağıdan zıplayarak küp alınmaz
- dönüş: küpü alan karakter yapının sol veya sağ yanından doğrudan zemine atlar, inişte dizlerini kırıp toparlanır ve kamyona döner. Kamyona yakınsa en yakın boş yükleme noktasına doğrudan atlar. Uzakta ise yan kenardan iner. Dönüş atlayışı sabit yatay hız ve yerçekimiyle hesaplanır; mesafe uzunsa önce kenara yaklaşır. Kalkışta diz kırma ve inişte ağırlık karşılama vardır. Dönüş koşusu zeminde kalır; tekrar yapıya tırmanmaz. Atlayış önü kapalıysa önce açık bir yan kenara gider
- dönüş koridoru: alçak küplerin çevresinde taşıdığı küpün dönüşünü de kapsayan boşluk bırakır. Yapının önündeki kavisli alan dönüş trafiğine kapalıdır; bölüm boyunca küçülmez. Ekip yanlardan gelip bu alanın dışından yükleme şeridine bağlanır. Başka bölgelerde yeterince geniş iç geçitler kullanılabilir; çapraz kestirmeler tampon alanları kesemez. İniş noktası kamyona güvenli bir zemin rotasıyla bağlı olmalıdır
- hareket izi: üst gövde yüksekliğinde, ekranda hep dik duran, kuyruğa doğru incelen kısa ve yarı saydam bir renk izi hızlı hareketi hafifçe vurgular; kameraya doğru koşarken de görünür; durunca kısa sürede yumuşakça söner
- teslim: kamyonun arkasında zıplayarak atış
- uzun parça: her bölümde birkaç çift yan yana aynı renkli küp 2 uzunluğunda tek bir çubuktur (yaklaşık 30 küpte bir, en çok 8). Çubuğu iki kişi alır: ilki bir ucun yanına gelip çömelerek bekler, ekipten biri öbür uca gelir ve ikisi aynı anda kaldırır. Kamyona yakın olan önden gider, diğeri bir çubuk boyu arkadan aynı yoldan ve aynı hareketlerle izler; çubuğu taşırken takla atılmaz. Kamyonda ikisi birlikte zıplayıp atar. Çubuk 2 küp sayılır; kamyonun yalnızca 1 küpe yeri kaldıysa fazlası aynı renkteki başka bir kamyona (park etmiş ya da sıradaki) sayılır. Yanında basacak yer yoksa iki kişi çubuğun üstüne çıkıp alır; ortak bulunamazsa ilk gelen bir süre sonra vazgeçer
- boş durmak yok: alınan küpün üstünde duran ya da üstünden geçen karakter, küp çekilirken taklayla sıçrayıp yoluna devam eder; iki karakter birbirinin altındaki küpü istiyorsa yan yana geçip yer değiştirir ve kendi ayağının altındakini alır; işi kalmayan karakter kamyonun yakınında elleri arkada, sıkılmış gibi yavaşça dolaşır, arada durup yapıya bakar (eller arkada, belde ya da bir el yüzde). Küpleri başka bir rengin altında kalmış ve o rengin kamyonu henüz gelmemişse nadiren saatine uzun uzun bakar, sonra yolun kamyon gelen ucuna döner ve başının üstündeki baloncukta beklediği rengin kamyonu belirir. Bir kamyon gelince ya da biri kendi küplerinin üstünü açmak üzereyken bekleyenler dizlerini kırıp pür dikkat küplere bakar; iş çıkmazsa yeniden gezinmeye döner; iş çıkınca ya da kamyon dolunca yürüyüşü bırakır

Azaltılmış hareket tercihi açıksa taklalar, dönüşler, hareket izleri ve parçacıklar kapanır; zıplamalar kalır.

## Geliştirme kontrolü

Oyunu oynamak için gerekmez. Testler için:

```sh
npm install
npx playwright install chromium
npm test
```

Sistemde Chrome varsa test onu kullanır (`CHROME_PATH` ile değiştirilebilir). Test; çevrimdışı açılışı, gerçek WebGL çizimini, molayı, pencere odağını, 320/390/768/1440 px yerleşimlerini, üç parkur test sahnesinin otomatik oyunla tamamlanmasını, küp sayımının hiç bozulmamasını, kamyonların hiçbir karede iç içe geçmediğini, üstü kapalı küpün hiç alınmadığını, ekibin hareketsiz kaldığı sürenin %10'un altında olduğunu, parkur hareketlerinin gerçekten yapıldığını ve yeniden başlatmayı kontrol eder. Uzun simülasyonlar `cubeBuddies.hold()` + `cubeBuddies.advance()` ile çizim yapmadan aynı simülasyon üzerinde ilerletilir.

## Bölüm verileri

`levels/catalog.json` her bölümün tam hücre dizilimini (x, sonra z, sonra y), renklerini, kamyon sütunlarını, sayılarını, zorluk ve ek mekanik alanlarını tutar. `npm run build:levels` veriyi doğrular ve tek HTML içine paketler; oyun açılırken ağ isteği yapılmaz.

Kamyon renkleri, kapasiteleri ve başlangıç sütun sıraları katalogla aynıdır. Mevcut parkur kuralları uygulanır: yalnızca üstü açık küpler toplanır; tıkanan kuyrukta uygun kamyon öne alınabilir. Buz, kilit, bağlantı ve garaj etiketleri veri dosyasında korunur; bu etiketler için ayrı oyun mekaniği uygulanmaz.

`npm test` ayrıca 150 bölümün birebir hücre/palet/sayaç bütünlüğünü, bölüm seçimini ve farklı boyutlardaki yapıların oynanışını doğrular. Dönüş testleri ayrıca küp tamponlarını, sabit ön alanı, iç koridorları, köşe kesmelerini, iniş açıklığını ve sabit yerçekimini denetler. Parkur hareketleri için üç küçük test sahnesi `?practice=1` ile açılır. Tüm 150 bölümü otomatik oynatmak için `ALL_LEVELS=1 npm test` kullanılır.

Three.js MIT lisansıyla dosyaya gömülüdür; lisans başlığı korunmuştur.
