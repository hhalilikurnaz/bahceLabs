# Bahçe Komuta Merkezi — tasarım keşfi (Adım 9, A aşaması)

**Durum:** keşif; kod yok (ürün ekranlarına dokunulmadı). Gerçek bahçe verisiyle çalışan, yalnızca geliştirmede açılan statik önizleme: `/tasarim-onizleme/:yon/:ekran` (`yon`: `gece` | `toprak`; `ekran`: `calisma` | `analiz` | `hava` | `asistan` | `mobil`). Kod: `src/features/tasarim/`. Ekran görüntüleri: `~/Desktop/bahcelab-ekran-goruntuleri/adim-9/tasarim/`.

## Sorun
Sağ panel «alt alta kart yığını»: harita ile grafik kopuk, dar alanda sıkışık, yorum haritada değil listede.

## İlkeler (her ekran bunlara göre denetlenir)
1. **Harita ana sahne.** Panel haritayı boğmaz; harita tam yükseklik, üstünde yalnızca birleşik arama çubuğu ve katman seçici.
2. **Zaman birinci sınıf.** Haritanın altındaki **zaman dok'u** ile harita tek bütündür: grafikte gezin → harita o tarihe; haritada tarih değiş → grafikte işaretçi. Eski tarih şeridi ve kapsül dok'a dönüşür.
3. **Yorum haritanın üstünde.** Sorunlu alanlar ve zayıf bölgeler haritada etiketli işaret («−%14 · 2,3 da»); listede değil.
4. **Önce özet, sonra derinlik.** Sağda dar, yoğun **Brifing** (tek ekrana sığar, kaydırma yok); ayrıntı tam sayfa **Odak görünümlerinde**.
5. **Karşılaştırma tek tık.** Sürgü, senkron 2 harita, 4'lü küçük çoklu (small multiples). (C aşaması)
6. **Çalışma alanı koyu kabuk** (harita, ray, dok, brifing); raporlar ve formlar açık tema. Limon sarısı yalnız birincil eylem/seçim. Rakamlar tabular; veri yoğun ama ferah.
7. **Her öğe çiftçinin kararına hizmet eder; süs yok.** Emoji, rastgele gradyan, genel kart ızgarası, ikon süslemesi yasak. Tarım ikonları özgün (tek çizgi kalınlığı); genel ikon kütüphanesi yalnızca kontrollerde.

## Bilgi mimarisi
```
Ray (56 px)        Bahçelerim · Asistan · İşlerim · Hizmetler · Pazar · Bildirimler │ Ayarlar
Bahçelerim         daraltılmış şerit (76 px: küçük resim + skor) ⇄ açık liste (kart: küçük resim, ad, skor halkası, sparkline, tek satır durum)
Çalışma alanı      harita (tam yükseklik) + zaman dok'u (alt) + brifing (sağ, 408 px)
Odak görünümleri   Analiz · Hava · Günlük · Rapor · Arşiv — tam sayfa; solda içerik, sağda senkron harita; ray kalır; URL'ler korunur
Asistan            sohbet geçmişi │ sohbet (zengin bloklar) │ bağlam paneli
Mobil (375 px)     harita tam ekran · brifing alt sayfa (Özet | Zaman | Katman) · ray → alt gezinme çubuğu
```
Sağ üstteki Copilot düğmesi kalkar; Asistan ray'dadır.

## Düzen ızgarası (1440 × 900)
```
┌ray 56┬şerit 76┬────────── harita (esnek) ──────────┬─ brifing 408 ─┐
│      │        │ ⌘K bar (560)         katman (300→) │ ad · skor     │
│      │        │                                     │ Bugün ≤3      │
│      │        │                         lejant      │ 4 metrik 2×2  │
│      │        ├──── zaman dok'u 232 (96 / 232 / 420)┤ odak bağl.    │
└──────┴────────┴─────────────────────────────────────┴───────────────┘
Odak: ray 56 │ içerik %58 (kaydırılır) │ harita %42 (senkron)
```
1024 px'te şerit kalır, brifing 360'a iner; 375 px'te tek sütun.

## Bileşen listesi
Ray · Bahçe şeridi/listesi · Birleşik komut çubuğu (⌘K) · Katman seçici (küçük resim + tek cümle) · Zaman dok'u (seri, geçen sezon, çok yıllık referans, fenoloji şeridi, net görüntü noktaları, yağış ve GDD şeritleri, sürüklenebilir işaretçi) · Brifing (başlık, skor halkası + güven, Bugün eylem kartları, anahtar metrik kutuları) · Skor halkası · Sparkline · Delta · Lejant (+ «narenciye için tipik aralık») · Etiketli harita işaretleri · Bölge tablosu · Yıl galerisi · İlaçlama ısı haritası · Sohbet blokları (metrik, grafik, mini harita, kaynaklar) · Alt sayfa (mobil).

## İki görsel yön
| | **1 · Gece Bahçe** | **2 · Toprak** |
|---|---|---|
| Zemin / yüzey | `#09120e` / `#0f1b15` `#15261e` (koyu yeşil-siyah) | `#111314` / `#191c1e` `#212528` (antrasit) |
| Metin | `#e9f0e6`, ikincil `#a5b7aa` | `#efe9dd` (sıcak), ikincil `#b0a894` |
| Seri rengi | açık yeşil `#8fd67f` | ince kum-adaçayı `#c8d9a5` |
| Köşe | 14 / 9 px, yumuşak | 4 / 3 px, keskin |
| Yazı | Fraunces başlıklar + Manrope | IBM Plex Sans + **IBM Plex Mono rakamlar**, büyük harfli mikro etiketler |
| Skor halkası | düz yay | çentikli ölçek (cihaz göstergesi) |
| Karakter | sıcak, sakin, bahçe | teknik, hassas, «alet paneli» |
Ortak: limon sarısı `#f2c94c` yalnız birincil eylem ve seçili tarih/işaretçi; uyarı amber, kritik yalnız gerçekten kritikte; bölge tonları ayırt edilir (turuncu, kum, turkuaz, mavi, mor); ilaçlama paleti renk körü dostu (koyu mavi-yeşil / amber çizgili / gri noktalı; gece = düz açık gri).

## Koyu tema token'ları (özet)
`--kc-bg --kc-s1 --kc-s2 --kc-s3` (yüzey katmanları) · `--kc-line --kc-line2` · `--kc-ink --kc-ink2 --kc-ink3` · `--kc-ok --kc-warn --kc-bad --kc-water` · `--kc-series --kc-prev --kc-band` · `--kc-zone-1…5` · `--kc-spray-ok --kc-spray-edge --kc-spray-no --kc-night` · `--kc-r --kc-r-sm` · `--kc-lemon`. Tam liste: `src/features/tasarim/tokens.css`. Seçilen yön ürün token'larına (`index.css`) B aşamasında taşınır.

## Önizlemede görülen gerçek veri sınırları (dürüst notlar)
- Skor 90–100 görünüyor; B2 kuralı (aktif orta/yüksek risk varken ≤ 90, düşük güvende aralık) önizlemede uygulanmış hâldedir.
- Dok'taki «geçen sezon» çizgisi ve «çok yıllık ortalama bandı» için ürün verisi eksik: 13 aylık sahne geçmişi geçen yılı kapsamıyor, çok yıllık yıl ortalamaları henüz API'de yok. C aşamasında backend'e yıllık özet ucu (`…/cok-yillik/seri`) ve piksel ucu eklenecek; önizleme bu iki çizgiyi uydurmuyor, çizmiyor.
- Harita katmanı bahçenin gerçek en güncel NDVI görüntüsüdür; bölge katmanı gerçek çok yıllık sonuçtur (2015–2025; 2021 ve 2026 uyumsuz işaretli).

## Karar için sorular
1. Hangi yön? (veya ikisinden hibrit: ör. Gece'nin renkleri + Toprak'ın rakam/etiket dili)
2. Bahçe listesi: şerit varsayılan, liste flyout (önizlemedeki gibi) mi; yoksa liste sabit mi?
3. Brifing genişliği 408 px yeterli mi?
