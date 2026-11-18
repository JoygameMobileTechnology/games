# Cube Buddies — Parkur Ekibi

`index.html` dosyasını Chrome, Edge veya Safari ile aç. Kurulum, sunucu ve internet gerekmez. Three.js r160, arayüz, karakterler, ses üretimi ve oyun kodu tek dosyanın içindedir. WebGL (donanım hızlandırması) gerekir.

## Meydan

Ekran dikey bir telefon yerleşimidir; yukarıdan aşağıya:

- **Resim.** Meydanın ortasında, kameradan bakınca 2D bir piksel resmi gibi okunan ama gerçek küplerden kurulu bir yapı durur. Her hücre üst üste dizilmiş küplerden bir sütundur: bazı yerler yüksek, bazıları alçaktır. Küpler alındıkça resim eksilir ve alttaki katmanlar ortaya çıkar. İlk bölüm *Ejder Hazinesi*: 21×29 hücre, 996 küp, yükseklik 1–4; ejder altınlarının üstünde oturur, o yüzden gövdesi söküldükçe altından altın çıkar.
- **Yan yollar.** Resmin sağında ve solunda en az üç hücre genişliğinde açık koridor vardır. Ekip kamyondan inince bu yollardan yürür, küpünün hizasına gelince o yandan resmin üstüne çıkar; küpü alınca yine yandan iner ve aynı yoldan kamyonuna döner.
- **Beş park cebi.** Resmin hemen önünde yan yana beş cep vardır. Kamyonlar kasaları resme dönük park eder; ekip kasanın arkasındaki şeritten yükler.
- **Şerit ve bekleyen kamyonlar.** En altta sıradaki kamyonlar sütunlar halinde, burunları kameraya dönük bekler: gerçek kamyon modelleri, kasalarının üstünde kaç küp istedikleri yazar. Her sütunun ilk iki kamyonu görünür, gerisi `+9` gibi bir sayıyla belirtilir.

Çevrede açık renk kaldırım, korkuluk ve deniz, birkaç lamba, saksı, bank ve ağaç vardır; hepsi kaldırımın üstündedir, ekibin yürüdüğü zemine de kamyonların geçtiği yerlere de girmez.

## Oyun

- Sıranın başındaki bir kamyona dokun. Kamyon sütunundan geri geri çıkar, şeritten ilerler ve soldan ilk boş cebe geri geri girer; kabininden o rengin ekibi iner. Beş cep de doluysa kamyon yerinden çıkmaz. Aynı anda tek kamyon manevra yapar; arka arkaya gönderilenler sırayla gelir, kendi sütunlarında bekler. Manevra üç parçadır — bulunduğu sıradan çeyrek dönüşle çıkış, boş şeritte ilerleme, gideceği yere çeyrek dönüşle giriş — bu yüzden hiçbir kamyon bir diğerinin içinden geçmez.
- Ekip, kendi rengindeki küpleri toplayıp kamyonun kasasına atar; küpler orada istiflenir. Üstünde başka küp duran küp alınamaz; yapı hep tepeden aşağı sökülür. Park etmiş kamyonun önündeki sayı yüklenen / istenen küp sayısıdır (örneğin 3/12) ve kasadaki küplerle birlikte artar; dolunca ekip kamyona biner, kamyon şeritten meydanın yakın kenarına doğru çıkıp gider ve cep boşalır.
- Her sütunda yalnızca en öndeki kamyon seçilebilir; o gidince arkadakiler bir sıra ilerler.
- Rengindeki bütün küplerin üstü kapalı olan kamyon sallanır ve sayacı sarıya döner; kamyona ya da sayacına dokunup sıraya geri gönderebilirsin. Kamyon yüküyle birlikte kendi sütununun başına döner, sütundakiler ona yer açmak için bir sıra geri çekilir; sonra yeniden gönderildiğinde kaldığı yerden devam eder.
- Sürükle: kamerayı döndür. Tekerlek / iki parmak: yakınlaş. Çift tık: kamerayı sıfırla.
- `1` `2` `3` `4`: sütundaki kamyonu gönder. Boşluk: mola. Üstteki ▶ düğmesi oyunu kendi kendine oynatır, `1×` düğmesi oyunu hızlandırır. Normal tempoda simülasyon gerçek zamanın 1,7 katı hızla akar (eski `2×` düğmesinin hızı); düğme `2×` yazınca 2,3 katına çıkar. Kamyon manevraları ve sıradaki kamyonların ilerleyişi öncekinin yaklaşık 3 katı hızlıdır. Bölüm sonundaki süre gerçek saniyedir.
- 151 bölüm, 22 renk ve toplam 103.761 küp var. 1. bölüm resim bölümüdür; ondan sonraki 150 bölüm eski üç boyutlu yapılardır ve aynı meydanda, aynı ceplerle oynanır (numaraları bir kaydı: eski 1. bölüm artık 2. bölüm). 2–6. bölümler parkuru öne çıkarmak için elle tasarlandı: İkiz Kuleler, Merdiven, Kale, Sütun Ormanı ve Köprü; `scripts/intro-levels.cjs` ile üretilir (`npm run design:intro`). Sol üstteki bölüm düğmesinden herhangi bir bölümü seçebilirsin. Adres sonuna `?level=151` ekleyerek doğrudan bir bölümü açabilirsin. Son bölümden sonra tekrar dizisi 31. bölümden başlar; bu dizide 52, 72, 92 ve 112 atlanır.

## Parkur

Karakterler yürüyerek tırmanmaz; yol bulucu her geçişi bir parkur hareketi olarak seçer. Zeminde yürümek ucuzdur; yapının üstünde enine gitmek biraz, boyuna gitmek çok daha pahalıdır ve önden ya da arkadan yapıya çıkmanın ayrıca bedeli vardır. Bu yüzden ekip tek bir noktadan yapıya dalmaz: yan koridordan küpünün hizasına kadar yürür, oradan içeri girer. Boşluğun üstünden uzun atlayışlar bu bedelin dışındadır.

- koşu, arada çember/yan takla
- tek basamak: sıçrama, öne takla veya yan takla
- alçak duvar: zıplayıp kenara tutunma ve kendini yukarı çekme
- yüksek duvar: duvarda dikine koşu, tepede kenara tutunma ya da takla ile üstüne çıkma
- boşluk: bir çatıdan diğerine uzun atlayış; hedef daha yüksekse kenarı yakalayıp yukarı çekilme
- iniş: kenardan uzağa doğru geniş bir yayla atlayış; öne/arkaya takla, burgu veya çift takla
- küpü alma: önce küpün yanında durulacak bir yer aranır — küpün kendi seviyesinde, hemen yanında ya da yandaki aynı yükseklikteki küpün üstünde. Böyle bir yer yoksa karakter küpün üstüne çıkıp ayağının altından alır. Aşağıdan zıplayarak küp alınmaz
- dönüş: küpü alan karakter yapının sol veya sağ yanından koridora atlar, inişte dizlerini kırıp toparlanır ve kamyona döner. Ön kenarın hemen yanındaysa öne, yükleme şeridine doğru iner. Yapının ortasındaysa önce üstten en yakın yan kenara gider. Dönüş atlayışı sabit yatay hız ve yerçekimiyle hesaplanır; mesafe uzunsa önce kenara yaklaşır. Kalkışta diz kırma ve inişte ağırlık karşılama vardır. Dönüş koşusu zeminde kalır; tekrar yapıya tırmanmaz. Atlayış önü kapalıysa önce açık bir yan kenara gider
- dönüş koridoru: alçak küplerin çevresinde taşıdığı küpün dönüşünü de kapsayan boşluk bırakır. Yan koridorlar yapının önündeki şeride, o da kamyonların arkasındaki yükleme noktalarına bağlanır; yapı söküldükçe açılan, yeterince geniş iç geçitler de kullanılır; çapraz kestirmeler tampon alanları kesemez. İniş noktası kamyona güvenli bir zemin rotasıyla bağlı olmalıdır
- hareket izi: üst gövde yüksekliğinde, ekranda hep dik duran, kuyruğa doğru incelen kısa ve yarı saydam bir renk izi hızlı hareketi hafifçe vurgular; kameraya doğru koşarken de görünür; durunca kısa sürede yumuşakça söner
- teslim: kamyonun arkasındaki şeritte zıplayarak atış; ekipten üçü kasanın hemen arkasında, ikisi bir adım geride durur
- uzun parça: her bölümde birkaç çift yan yana aynı renkli küp 2 uzunluğunda tek bir çubuktur (yaklaşık 30 küpte bir, en çok 8). Çubuğu iki kişi alır: ilki bir ucun yanına gelip çömelerek bekler, ekipten biri öbür uca gelir ve ikisi aynı anda kaldırır. Kamyona yakın olan önden gider, diğeri bir çubuk boyu arkadan aynı yoldan ve aynı hareketlerle izler; çubuğu taşırken takla atılmaz. Kamyonda ikisi birlikte zıplayıp atar. Çubuk 2 küp sayılır; kamyonun yalnızca 1 küpe yeri kaldıysa fazlası aynı renkteki başka bir kamyona (park etmiş ya da sıradaki) sayılır. Yanında basacak yer yoksa iki kişi çubuğun üstüne çıkıp alır; ortak bulunamazsa ilk gelen bir süre sonra vazgeçer
- boş durmak yok: alınan küpün üstünde duran ya da üstünden geçen karakter, küp çekilirken taklayla sıçrayıp yoluna devam eder (ayağının altındaki küp çekilen karakterin oradan ilk adımı da koşu değil sıçramadır); iki karakter birbirinin altındaki küpü istiyorsa yan yana geçip yer değiştirir ve kendi ayağının altındakini alır; işi kalmayan karakter kamyonun yakınında elleri arkada, sıkılmış gibi yavaşça dolaşır, arada durup yapıya bakar (eller arkada, belde ya da bir el yüzde). Küpleri başka bir rengin altında kalmış ve o rengin kamyonu henüz gelmemişse nadiren saatine uzun uzun bakar, sonra sırada bekleyen kamyonlara döner ve başının üstündeki baloncukta beklediği rengin kamyonu belirir. Bir kamyon gelince ya da biri kendi küplerinin üstünü açmak üzereyken bekleyenler dizlerini kırıp pür dikkat küplere bakar; iş çıkmazsa yeniden gezinmeye döner; iş çıkınca ya da kamyon dolunca yürüyüşü bırakır

Azaltılmış hareket tercihi açıksa taklalar, dönüşler, hareket izleri ve parçacıklar kapanır; zıplamalar kalır.

## Geliştirme kontrolü

Oyunu oynamak için gerekmez. Testler için:

```sh
npm install
npx playwright install chromium
npm test
```

Sistemde Chrome varsa test onu kullanır (`CHROME_PATH` ile değiştirilebilir). Test; çevrimdışı açılışı, gerçek WebGL çizimini, molayı, pencere odağını, 320/390/768/1440 px yerleşimlerini (bekleyen kamyonların ekrana sığdığını, en az 44 px dokunma alanı ve okunur sayılar olduğunu), üç parkur test sahnesinin otomatik oyunla tamamlanmasını, küp sayımının hiç bozulmamasını, kamyonların — bekleyen, manevra yapan, park etmiş, giden — hiçbir karede iç içe geçmediğini, üstü kapalı küpün hiç alınmadığını, ekibin hareketsiz kaldığı sürenin %10'un altında olduğunu, parkur hareketlerinin gerçekten yapıldığını ve yeniden başlatmayı kontrol eder. Uzun simülasyonlar `cubeBuddies.hold()` + `cubeBuddies.advance()` ile çizim yapmadan aynı simülasyon üzerinde ilerletilir.

`tests/plaza.cjs` meydan yerleşimini resim bölümünde denetler: resmin gerçekten sütun sütun küp olduğunu ve yükseklik farklarını, iki yandaki koridorları, telefon ekranlarında resim / cepler / bekleyen kamyonlar sırasını; elle gönderilen bir kamyonun park edip ekibini indirmesini ve sayacın kasadaki yükle birlikte artmasını; beş cep doluyken altıncı kamyonun yerinden çıkmamasını ve boşalan cebin yeniden kullanılmasını. Sonra bölümün tamamını otomatik oynatıp her karede şunlara bakar: kimse bir küpün içinde değil, kimse artık olmayan bir küpün üstünde koşmuyor, kimse ışınlanmıyor (kare başına en uzun yer değiştirme bir sıçrama kadar), her küp yanında ya da üstünde durularak alınıyor, her yükleme kendi kamyonunun arkasından yapılıyor, işi olan kimse takılı kalmıyor; ekip yapıya yanlardan çıkıyor, iki koridor da hem gidişte hem dönüşte kullanılıyor ve dev sıçrama (ışınlanma) hiç devreye girmiyor. Son olarak üstü kapalı bir rengin kamyonunun beklemesini, sıranın başına geri dönmesini ve sonra işini bitirmesini denetler.

## Bölüm verileri

`levels/catalog.json` her bölümün tam hücre dizilimini (x, sonra z, sonra y), renklerini, kamyon sütunlarını, sayılarını, zorluk ve ek mekanik alanlarını tutar. `npm run build:levels` veriyi doğrular ve tek HTML içine paketler; oyun açılırken ağ isteği yapılmaz. Izgaranın son z satırı kamyonlara en yakın ön sıradır; yapı meydanda ortalanır, ön sırası hep aynı yerde durur, derin yapılar geriye doğru uzar.

Resim bölümleri `scripts/picture-levels.cjs` içinde iki harita olarak durur: üstten görünen resim (`art`, her harf bir renk) ve her hücrenin kaç küp yüksek olduğu (`relief`). `under` kuralı üstteki küplerin altında hangi rengin olduğunu söyler. `npm run design:pictures` resimleri kataloğun başına yazar (`"picture": true`), kamyonları bölümü üstten sökerek dağıtır ve HTML'i yeniden paketler; yeni bir resim eklemek için listeye bir kayıt eklemek yeter.

Kamyon renkleri, kapasiteleri ve başlangıç sütun sıraları katalogla aynıdır. Mevcut parkur kuralları uygulanır: yalnızca üstü açık küpler toplanır; tıkanan kuyrukta uygun kamyon öne alınabilir. Buz, kilit, bağlantı ve garaj etiketleri veri dosyasında korunur; bu etiketler için ayrı oyun mekaniği uygulanmaz.

`npm test` ayrıca 151 bölümün birebir hücre/palet/sayaç bütünlüğünü, bölüm seçimini ve farklı boyutlardaki yapıların yeni meydanda oynanışını doğrular. Dönüş testleri ayrıca küp tamponlarını, iç koridorları, köşe kesmelerini, iniş açıklığını ve sabit yerçekimini denetler. Parkur hareketleri için üç küçük test sahnesi `?practice=1` ile açılır. Tüm 151 bölümü otomatik oynatmak için `ALL_LEVELS=1 node tests/levels.cjs` kullanılır.

Three.js MIT lisansıyla dosyaya gömülüdür; lisans başlığı korunmuştur.
