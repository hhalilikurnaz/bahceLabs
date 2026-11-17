# BahçeLab · Landing ve pazarlama arayüzü incelemesi

> **Tarih:** 2026-11-16 · **Kapsam:** `/` (Journey hero + şeritler), `/blog`, `/login`, `/register`, `components/ui` ve uygulama kabuğu (yalnız okuma).
> **Yöntem:** kaynak kodu okuma, 1440×900 ve 390×844 ekran görüntüleri (Playwright), 11 rakip ana sayfasının metin olarak okunması, genel SaaS landing ve kaydırma-animasyonu performansı kaynakları.
> **Sınır:** rakip siteler metin olarak okundu. Renk, yazı tipi ve görsel stil doğrulanamadı. İmeceMobil ana sayfası yüklenmedi, Farmonaut 403 verdi.
> **Sonuç belgesi:** L1 işi bu bulguların P0/P1 olanlarını kapatır. Yapılanlar ve ölçümler `docs/design/landing-l1-rapor.md` içindedir.

## Genel yargı

Landing görsel olarak sektörün üstündedir: dron fotoğrafı, serif başlık, kaydırmalı «uydu tarıyor» hikâyesi. Ama sayfa bir ürün sayfasından çok manifesto gibi davranıyordu. Ziyaretçi dokuz ekran kaydırıyor, uygulamanın gerçek ekranını hiç görmüyor, güvenmesi için tek bir kanıt almıyor ve tıklanamayan «Kayıtlar çok yakında» düğmesiyle karşılaşıyordu.

## Bulgular

| # | Önem | Bulgu |
|---|---|---|
| 1 | P0 | **Dönüşüm yolu yok.** Birincil CTA her yerde «Kayıtlar çok yakında». Kayıt açıkken bile metin böyleydi. Bekleme listesi yoktu. |
| 2 | P0 | **Kanıt yok.** Sayı, kurum, pilot, ekip, basın, hiçbiri. |
| 3 | P0 | **Ürün görünmüyor.** Journey temsili örnek veri gösteriyor. Gerçek uygulama ekranı landing'de yok. |
| 4 | P1 | **Hero çok uzun.** Misyon bölümü ≈9 ekran aşağıda. Hero kare dizisi (120 WebP, 14,6 MB) kodda kullanılmıyor, ölü varlık. Ana fotoğraf 1,3 MB. |
| 5 | P1 | **Dört soyut bölüm** (yapay zeka, veri analizi, üç eksen, sürdürülebilirlik) aynı üç kelimeyi tekrarlıyor. «Önce/Hedef» çubukları uydurma değer gösteriyor. |
| 6 | P1 | **Logo tutarsız.** Navbar'daki renkli çubuklu logo «BahceLab» (ç yok), koyu zeminde ≈3:1 kontrast. Uygulamada başka logo. (UX denetimi U-17) |
| 7 | P1 | **Navbar.** İki bağlantı, sosyal ikonlar menüde. 390 px'te CTA iki satıra kırılıyor. |
| 8 | P1 | **Erişilebilirlik.** `<ul>` içinde `<div>` (list/listitem serious), 10 px eyebrow, kaydırma animasyonu `prefers-reduced-motion` dinlemiyor. |
| 9 | P2 | **Token.** Landing'de 40+ ham hex, elle yazılmış düğme sınıfları, karışık köşe yarıçapı. |
| 10 | P2 | **Giriş/kayıt.** Sol panel «Doğru Veriyle, Doğru Üretime İlerleyin!» (Title Case + ünlem), «planlarınıza ulaşın» (planlama arayüzden kalktı), şifre kuralı iki yerde, «Şifremi unuttum» yok. |
| 11 | P2 | **Blog.** Yapay zekâ üretimi kapak görselleri, tarih ve okuma süresi yok. |

## Rakip karşılaştırması

OneSoil, EOSDA Crop Monitoring, Taranis, xFarm, Agremo, Cropin, Doktar, Tarla.io, Climate FieldView, Aerobotics, Agrivi okundu.

| Kalıp | Rakip oranı | BahçeLab (öncesi) |
|---|---|---|
| Hero'da ürün ekranı veya mockup | 8/10 | Yok |
| Hero altında sayı veya logo kanıtı | 9/10 | Yok |
| «Ücretsiz dene» veya «Demo al» CTA | 10/10 | «Yakında» |
| Görünür fiyat veya plan | 4/10 | Yok |
| Navbar'da ≤5 bağlantı | 10/10 | 2 + sosyal ikonlar |

En yakın iki referans: **Tarla.io** (Türk rakip: hero'da NDVI kartı, kurum logoları, ücretsiz başlangıç planı, bahçe ve bağ için don bölümü) ve **Aerobotics** (ağaç ürünleri: «Request a demo» + «See how it works», narenciye vaka hikâyesi).

## Önerilen akış (L1'in uyguladığı)

1. Hero: kısa Journey (3 durak), CTA «Erken erişime katıl» + «Nasıl çalışır».
2. Dürüst kanıt şeridi: kurucu hikâyesi + veri kaynakları adıyla, sayı yok.
3. Gerçek ürün ekranı (Durum paneli).
4. Nasıl çalışır: 3 adım.
5. Ne görürsünüz: gerçek ekranlardan 3 kart.
6. Dürüstlük bloğu.
7. Erken erişim çağrısı, footer'da tek logo ve sosyal bağlantılar.

## Kaynaklar

OneSoil, EOSDA, Taranis, xFarm, Agremo, Cropin, Doktar, Tarla.io, Climate FieldView, Aerobotics, Agrivi ana sayfaları. SaaS landing pratikleri (SaaSHero, Flighted), kaydırma animasyonu ve LCP (Shopify geliştirici belgesi, WebdesignerDepot «How scrolljacking breaks UX fundamentals»).
