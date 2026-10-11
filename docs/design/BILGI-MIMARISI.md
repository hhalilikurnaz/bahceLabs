# BahçeLab — Bilgi mimarisi (Adım 7A)

Her yeni özelliğin yeri baştan belli olsun diye iskelet. Henüz olmayan uçlar "Yakında – Adım N" boş durumu gösterir; ölü/işlevsiz menü ucu bırakılmaz.

## Sol menü
```
Bahçelerim      /bahcem                    (liste + harita)
Pazar & Depo    /bahcem/pazar              Yakında – Adım 17
Bildirimler     /bahcem/bildirimler        Yakında – Adım 8 (bildirim merkezi) · Destek ve son tarih takvimi (Adım 18)
Ayarlar         /bahcem/ayarlar            hesap, çıkış · Bildirim tercihleri ve telefon/WhatsApp onayı (Adım 18–19)
```

## Bahçe sayfası (`/bahcem/:id/…`)
```
/bahcem/:id
├── durum    Durum   en güncel değer + açıklama, zaman grafiği, uyarılar (Adım 8: skor, "Bugün" kartı)
├── analiz   Analiz  Bölgeler (şimdi: verimlilik bölgeleri; Adım 9: çok yıllık), Sorunlu alanlar (tıkla → haritada odak)
│                    Yakında: Topografya & don (10) · Toprak örneklemesi (14) · Uygulama haritası & denemeler (15)
├── hava     Hava    hava, 7 gün, ilaçlama penceresi, su durumu · Yakında: Sulama önerisi (8) · Zararlı/hastalık riski (8)
├── gunluk   Günlük  Yakında: Gözlemler (11) · Hasat (11) · İlaç defteri (12) · Maliyet & işçi/yevmiye (13) · Kayıt dosyası İTU/GlobalG.A.P. (13B)
└── rapor    Rapor   Yakında: Sezon raporu PDF (16) · Hasar raporu (10/16) · Paylaşım linki (16)
```
Copilot (sağ üst çekmece): Yakında – Adım 16 (Fotoğrafla teşhis dahil).
`/bahcem/:id` → `/bahcem/:id/durum`. Bilinmeyen bahçe → liste + bildirim.

## Kurallar
- Uzman harita denetimleri (indeks seçici, görünüm, değişim, karşılaştır, zaman atlaması) harita üstü araç çubuğundadır; panelde yer almaz.
- Bir özellik tek sekmeye aittir; başka sekmeden yalnızca bağlantıyla anılır.
- Çiftçi dili: birincil ad anlamlıdır, teknik ad ikincil etikettir.

## Not (Adım 7A)
Eski "Hava durumu" sol menü ucu ve tüm bahçelerin hava özeti paneli kaldırıldı; bugünkü hava ve uyarılar Adım 7B'de bahçe listesi kartlarına (`GET /gardens/overview`) taşınır. Planlama simülasyonu bağlantısı Ayarlar → Araçlar altındadır.
