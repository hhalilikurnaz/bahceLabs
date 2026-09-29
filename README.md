# bahcelabs.com

BahçeLab tanıtım sayfası. Next.js 15 (App Router) üzerinde, tamamen statik çıktı veriyor. Türkçe, İngilizce ve İspanyolca dil desteği next-intl ile sağlanıyor. Kaydırma animasyonları için harici animasyon kütüphanesi yok; sticky konumlama, kaydırma ilerlemesi ve Canvas 2D kullanılıyor.

## Kurulum

```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000/tr
npm run build      # statik çıktı: out/
npm start          # out/ klasörünü yerelde sunar
```

## Klasör yapısı

```
messages/            tr.json, en.json, es.json  ← TÜM metinler burada
src/app/[locale]/    sayfa, yerleşim, KVKK sayfası
src/components/
  Journey.tsx        ANA BÖLÜM: drone videosu → kuşbakışı bahçe → ağaçtan ağaca kaydırmalı yolculuk
  Hero.tsx           yedek hero (görüntü yokken, canvas modu)
  FrameSequence.tsx  videodan çıkarılmış kareleri kaydırmayla oynatan canvas
  OrchardCanvas.tsx  dijital ikiz çizimi (ağaç tespiti, sağlık, rekolte, sulama)
  FeatureStory.tsx   solda bilgi adımları, sağda yapışkan bahçe sahnesi
  Sections.tsx       Nasıl çalışır, Kimler için, Hikâye, Demo, Alt bilgi
  DemoForm.tsx       demo talep formu (KVKK onaylı, bot tuzaklı)
  Header.tsx, Logo.tsx
src/hooks/useScrollProgress.ts   bölüm içi kaydırma ilerlemesi (0..1)
src/lib/journey.ts   yolculuğun zaman çizelgesi, kamera durakları, ağaç koordinatları
src/lib/orchard.ts   bahçe çizim motoru (yedek mod)
src/lib/site.ts      hero modu, medya yolları, e-posta, form ayarı
scripts/             ffmpeg betikleri (kare dizisi, web videosu)
docs/VIDEO.md        yapay zekâ ile hero videosu üretme rehberi ve promptlar
```

## Kaydırma animasyonu nasıl çalışıyor?

1. **Uzun bölüm ve yapışkan sahne.** Hero bölümü 300–420vh yüksekliğinde. İçindeki sahne `position: sticky` ile ekrana sabitleniyor, kullanıcı kaydırdıkça sahne yerinde kalıyor.
2. **İlerleme.** `useScrollProgress`, bölümün ne kadarının kaydırıldığını 0..1 arası hesaplıyor. Kare başına en fazla bir hesap yapılıyor (requestAnimationFrame).
3. **Zaman çizelgesi.** `Hero.tsx` içindeki `sceneFor()` ve `LINE_WINDOWS`, ilerleme aralıklarını olaylara bağlıyor. Örneğin 0.55–0.72 arası tarama çizgisi, 0.60–0.85 arası ağaç tespiti. Değerleri değiştirerek kurguyu ayarlayabilirsin.
4. **Gerçek görüntü (sequence modu).** `FrameSequence`, videodan çıkarılmış webp karelerini ilerlemeye göre canvas'a çiziyor. Kareler seyrekten sıka doğru yükleniyor; hızlı kaydırmada en yakın kare gösteriliyor.
5. **Dijitale geçiş.** Gerçek görüntü katmanı `clip-path` ile yukarıdan kırpılıyor. Çizginin üstünde dijital ikiz, altında gerçek görüntü kalıyor.
6. **Özellikler bölümü.** Soldaki her adım ekranın ortasına gelince (IntersectionObserver) sağdaki sahneye yeni hedef veriliyor. Canvas bu hedefe yumuşak geçiş yapıyor.

## Bahçe yolculuğu (Journey)

`sequence` modunda hero ve özellikler tek bir kaydırmalı bölümdür:

1. **Video:** Drone videosu kaydırmayla oynar. Kaydırma yokken ilk saniyeler yavaşça ileri-geri döner.
2. **İniş:** Video büyüyüp bulanıklaşarak kaybolur, altından kuşbakışı ana fotoğraf çıkar.
3. **Tarama:** Sarı çizgi iner, geçtiği ağaçlar tespit kutusuyla işaretlenir, sayaç artar.
4. **Ağaçlar:** Kamera 4 ağaca sırayla gider: Dijital Bahçe, Ağaç tespiti, Belirti, Rekolte. Solda metin, ağacın yanında veri kartı.
5. **Bahçenin tamamı:** Akıllı sulama ve AI Copilot.

Ayarlar `src/lib/journey.ts` içinde:

- `INTRO`: giriş süreleri.
- `STOPS`: duraklar; her biri için kamera, yakınlık ve katmanlar. Süreler ekran yüksekliği cinsinden.
- `ROWS`: fotoğraftaki ağaç konumları.
- `FOCUS_TREES`: durulan 4 ağaç.

Görseller:

- `public/media/hero-frames/`: videodan çıkarılan kareler (masaüstü 120 × 1280 px, mobil 80 × 768 px).
- `public/media/orchard/`: ana fotoğraf (3344 px, mobil için 1920 px).

Fotoğraf değişirse `ROWS` ve `FOCUS_TREES` koordinatlarını güncelle. Kart metinleri `messages/*.json` içindeki `journey` bölümünde.

## Hero modları

`.env.local` içindeki `NEXT_PUBLIC_HERO_MODE` değeriyle seçilir:

| Mod | Ne zaman | Dosyalar |
|---|---|---|
| `canvas` | Görüntü yoksa yedek | yok |
| `sequence` | Varsayılan: bahçe yolculuğu | `public/media/hero-frames/`, `public/media/orchard/` |
| `video` | Basit döngü video | `public/media/hero.mp4` vb. |

Kare dizisi üretmek için:

```bash
./scripts/extract-frames.sh bahce-drone.mp4 160 100
# src/lib/site.ts içindeki count değerleri 160 ve 100 olmalı
```

Videoyu yapay zekâyla üretme adımları ve promptlar için: [docs/VIDEO.md](docs/VIDEO.md)

## Metin ve dil

- Tüm metinler `messages/*.json` dosyalarında; üç dosyadaki anahtarlar birebir aynı olmalı.
- Yeni dil eklemek için: `src/i18n/routing.ts` içindeki `locales` listesine ekle, `messages/xx.json` oluştur.
- Kök adres (`/`) tarayıcı diline göre `/tr/`, `/en/` ya da `/es/`'e yönlendiriyor.
- Her dil için `hreflang`, canonical, sitemap ve robots otomatik üretiliyor.

## Demo formu

Statik sitede sunucu yok. Form JSON'u bir form servisine gönderiyor.

- **Formspree:** Form oluştur, verdiği adresi `.env.local` içine `NEXT_PUBLIC_FORM_ENDPOINT=https://formspree.io/f/xxxx` olarak yaz.
- **Web3Forms / Basin:** JSON POST kabul eden herhangi bir servis çalışır.
- **Değer boşsa:** Form, `merhaba@bahcelabs.com` adresine e-posta taslağı açar.

KVKK aydınlatma metni `messages/*.json` içindeki `kvkk` bölümünde. Yayına almadan önce bir hukukçuya kontrol ettir.

## Yayına alma (Vercel + bahcelabs.com)

1. Projeyi GitHub'a yükle.
2. Vercel'de "Import Project" ile içe aktar; Next.js otomatik algılanır.
3. Vercel'de ortam değişkenlerine `NEXT_PUBLIC_HERO_MODE` ve `NEXT_PUBLIC_FORM_ENDPOINT` değerlerini ekle.
4. Settings → Domains → `bahcelabs.com` ve `www.bahcelabs.com` ekle, alan adı sağlayıcında Vercel'in verdiği DNS kayıtlarını gir.

Çıktı statik olduğu için Cloudflare Pages ya da Netlify'da da `out/` klasörüyle çalışır.

## Performans

- Harici animasyon kütüphanesi yok. İlk yükleme JS'i yaklaşık 128 kB.
- Canvas çizimi ekran dışındayken durur. Cihaz piksel oranı en fazla 2 ile sınırlı.
- Ağaçlar önceden çizilmiş görsellerle, zemin tek seferlik bir katmanla çiziliyor.
- Kare dizisi için hedef boyut: masaüstünde ≤ 12 MB, mobilde ≤ 5 MB. Mobilde ve veri tasarrufu açıkken küçük kareler kullanılıyor.
- İlk kare `preload` ile öncelikli yükleniyor (LCP için).
- `prefers-reduced-motion` açıksa geçişler kapanıyor.
- Alt bölümlerde `content-visibility: auto` kullanılıyor.
- Hedef Lighthouse puanları: Performans 90+, Erişilebilirlik 95+, SEO 100.

Daha da hızlandırmak için:

- Fontlar şu an Google Fonts bağlantısıyla geliyor. İstersen `next/font` ile kendi sunucuna alabilirsin.
- Kare sayısını 120'ye indirmek boyutu yaklaşık %25 azaltır.

## Yapılacaklar

- [ ] Nihai logo (`src/components/Logo.tsx` ve `public/favicon.svg`)
- [ ] Hero videosu ve karelerin üretilmesi (docs/VIDEO.md)
- [ ] Form servisi ve `merhaba@bahcelabs.com` e-posta adresinin açılması
- [ ] KVKK metninin hukukçu kontrolü
- [ ] Open Graph paylaşım görseli (`public/og.jpg`, 1200×630)
