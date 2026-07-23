# Game Experiments — Developer Guide

Tek dosyalık HTML oyun prototiplerini tuttuğumuz repo. Her oyun kendi klasöründe yaşar, push'ladığın anda otomatik deploy olur — konfigürasyon, build, liste düzenleme yok.

## Kurulum (bir kere)

```bash
git clone https://github.com/JoygameMobileTechnology/game-experiments.git
cd game-experiments
```

## Yeni oyun ekleme

1. **Klasör aç** — klasör adı URL'in olur (küçük harf, tire ile):

   ```
   benim-oyunum/
   └── index.html
   ```

2. **`index.html` self-contained olsun**: CSS ve JS inline, harici asset yok (tek dosya = tek prototip). Mobil test edilecekse `<meta name="viewport" content="width=device-width, initial-scale=1">` eklemeyi unutma.

3. **(Önerilir)** Hub kartı için `game.json` ekle:

   ```json
   {
     "title": "Benim Oyunum",
     "description": "Ana sayfadaki kartta görünecek tek satırlık açıklama."
   }
   ```

   Eklemezsen kartta oyunun `<title>` etiketi (o da yoksa klasör adı) görünür, açıklama boş kalır.

## Push'lama

```bash
git add benim-oyunum
git commit -m "Add benim-oyunum prototype"
git pull --rebase && git push
```

- Doğrudan `main`'e push'luyoruz; herkes farklı klasörde çalıştığı için conflict normalde çıkmaz. Push'tan önce `git pull --rebase` yapman yeterli.
- Push sonrası **Actions** sekmesindeki "Deploy Pages" koşusu ~1 dakikada biter; yeşile dönünce oyun yayındadır.

## Oynama / paylaşma

- **Ana sayfa (tüm oyunlar):** https://expert-adventure-77kk9m7.pages.github.io/
- **Senin oyunun:** `https://expert-adventure-77kk9m7.pages.github.io/benim-oyunum/`

Site private: yalnızca bu repoya erişimi olan org üyeleri görebilir ve tarayıcıda **GitHub'a girişli olmak şart** (telefonda da). Link açılmıyorsa önce github.com'a giriş yap.

## Yerelde önizleme

```bash
node scripts/build-hub.mjs          # hub + oyunları ./_site altına üretir
python3 -m http.server -d _site 8080
# http://localhost:8080
```

## Dokunma listesi

- Kök dizine `index.html` **koyma** — ana sayfa her deploy'da otomatik üretiliyor.
- `.github/` ve `scripts/` klasörlerini değiştirme (deploy altyapısı).
- Başkasının oyun klasörünü düzenleme; değişiklik gerekiyorsa sahibiyle konuş.
