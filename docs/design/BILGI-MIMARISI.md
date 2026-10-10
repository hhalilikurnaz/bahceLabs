# BahçeLab — Bilgi mimarisi (Adım 7A)

Her yeni özelliğin yeri baştan belli olsun diye iskelet. Henüz olmayan uçlar "Yakında – Adım N" boş durumu gösterir; ölü/işlevsiz menü ucu bırakılmaz.

## Sol menü
```
Bahçelerim      /bahcem                    (liste + harita)
Pazar & Depo    /bahcem/pazar              Yakında – Adım 17
Bildirimler     /bahcem/bildirimler        Yakında – Adım 8 (uygulama içi bildirim merkezi)
Ayarlar         /bahcem/ayarlar            hesap, çıkış, araçlar (çoklu kullanıcı: Adım 19)
```

## Bahçe sayfası (`/bahcem/:id/…`)
```
/bahcem/:id
├── durum    Durum   skor, "Bugün" kartı, grafikler                       (Adım 8; şimdilik: indeks haritası + zaman grafiği)
├── analiz   Analiz  bölgeler, değişim, karşılaştırma, sorunlu alanlar,    (Adım 9, 10, 14, 15; şimdilik: verimlilik bölgeleri,
│                    topografya, toprak, uygulama haritası, denemeler       değişim, karşılaştır, sorunlu alanlar)
├── hava     Hava    hava, ilaçlama penceresi, sulama, zararlı riski       (Adım 8; şimdilik: mevcut hava içeriği)
├── gunluk   Günlük  gözlem, hasat, ilaç defteri, maliyet                  (Adım 11, 12, 13)   Yakında
└── rapor    Rapor   PDF, paylaşım linki                                   (Adım 16)           Yakında
```
`/bahcem/:id` → `/bahcem/:id/durum` yönlendirmesi. Bilinmeyen bahçe → liste + "bahçe bulunamadı" bildirimi.

## Kurallar
- Uzman harita denetimleri (indeks seçici, görünüm, değişim, karşılaştır, zaman atlaması) harita üstü araç çubuğundadır; panelde yer almaz.
- Bir özellik tek sekmeye aittir; başka sekmeden yalnızca bağlantıyla anılır.
- Çiftçi dili: birincil ad anlamlıdır, teknik ad ikincil etikettir.

## Not (Adım 7A)
Eski "Hava durumu" sol menü ucu ve tüm bahçelerin hava özeti paneli kaldırıldı; bugünkü hava ve uyarılar Adım 7B'de bahçe listesi kartlarına (`GET /gardens/overview`) taşınır. Planlama simülasyonu bağlantısı Ayarlar → Araçlar altındadır.
