# BahçeLab — Bilgi mimarisi (Adım 7A, 7B-2'de güncellendi)

Her yeni özelliğin yeri baştan belli olsun diye iskelet. Henüz olmayan uçlar "Yakında – Adım N" boş durumu gösterir; ölü/işlevsiz menü ucu bırakılmaz.

## Sol menü
```
Bahçelerim      /bahcem                    (liste + harita)
Pazar & Depo    /bahcem/pazar              Yakında – Adım 17
Bildirimler     /bahcem/bildirimler        Yakında – Adım 8 (bildirim merkezi) · Destek ve son tarih takvimi (Adım 18)
Ayarlar         /bahcem/ayarlar            hesap, çıkış · Bildirim tercihleri ve telefon/WhatsApp onayı (Adım 18–19)
```

## Yerleşim (7B-2, ADR 0006)
Masaüstünde (≥ 1180 px) üç bölge: **sol liste | orta harita | sağ bahçe paneli** (sürüklenerek ya da ← → ile boyutlanır, genişlik tarayıcıda saklanır). Bahçe seçilince ikisi birlikte görünür; «Tam harita» ikisini de kapatır (Esc geri açar). Copilot çekmecesi sağ panelin üstünde açılır. Daha dar ekranlarda (telefon, tablet) harita üsttedir; bahçe paneli alttan açılan sayfadır (kapalı/yarım/tam, sürüklenebilir), liste ayrı görünümdür.

## Bahçe ekleme akışı (7C)
`Bahçe ekle` → **Haritada çiz** (çokgen/daire; kenar uzunlukları, canlı alan, yapışma, geri al/yinele, köşe düzenleme) | **Dosya yükle** (KML/KMZ/GeoJSON). Sağ panelde canlı form: ad, ürün, çeşit, dikim yılı, ağaç sayısı, il/ilçe + önizleme. Kayıttan sonra "Uydu verisi hazırlanıyor" durumu ve bitince bildirim. Mevcut bahçenin sınırı aynı araçla düzenlenir; değişince yeniden işleme uyarısı. Eksik bilgi: Durum sekmesinde "Bilgileri tamamla".

## Bahçe sayfası (`/bahcem/:id/…`)
```
/bahcem/:id
├── durum    Durum   skor kartı (0–100, etiket, tek cümle, "Neden bu skor?" dökümü, güven) + "Bugün" (≤ 3 madde); 3 özet kart; ortak zaman eksenli 3 grafik: parametre · birikmiş yağış · GDD (dönem: bu/geçen sezon/özel; fenoloji bantları; senkron imleç); uyarılar
├── analiz   Analiz  Bölgeler (şimdi: verimlilik bölgeleri; Adım 9: çok yıllık), Sorunlu alanlar (tıkla → haritada odak)
│                    Yakında: Topografya & don (10) · Toprak örneklemesi (14) · Uygulama haritası & denemeler (15)
├── hava     Hava    hava, 7 gün, ilaçlama penceresi, su durumu · Yakında: Sulama önerisi (8) · Zararlı/hastalık riski (8)
├── gunluk   Günlük  Yakında: Gözlemler (11) · Hasat (11) · İlaç defteri (12) · Maliyet & işçi/yevmiye (13) · Kayıt dosyası İTU/GlobalG.A.P. (13B)
├── rapor    Rapor   Yakında: Sezon raporu PDF (16) · Hasar raporu (10/16) · Paylaşım linki (16)
└── arsiv    Görüntü arşivi (tam sayfa)  ?parametre=ndvi&tarih=YYYY-MM-DD&mod=tek|karsilastir|degisim|zaman&b=…&sezon=…&net=0
             parametreler (değer · 14 günlük değişim · mini grafik) | büyük görüntüleyici (4 mod) | ay ay küçük resim ızgarası
```
Durum sekmesi: üstte 3 özet kart (en güncel değer + cümle · ürün/ağaç yaşı · bugünün havası), tek parametre seçici + zaman grafiği (noktaya tıkla → Arşiv'de o tarih), uyarılar; Adım 8 için "Bahçe skoru" ve "Bugün" yerleri ayrılmıştır (`ReservedSlots`). Her sekmenin altında kısa "Yakında" listesi bulunur.
Copilot (sağ üst çekmece): Yakında – Adım 16 (Fotoğrafla teşhis dahil).
`/bahcem/:id` → `/bahcem/:id/durum`. Bilinmeyen bahçe → liste + bildirim.

## Kurallar
- Ana ekran HER ZAMAN en güncel geçerli görüntüyü gösterir; tarih seçimi, karşılaştırma, değişim haritası ve zaman atlaması yalnızca Arşiv'dedir. Harita araç çubuğu: parametre, görünüm (Bahçenin kendi farkları / Genel skala), ayarlar, «Tüm görüntüler».
- Renk yalnızca durum kuralına göre kırmızı olur (sunucudaki uyarılar); mevsim normali içindeki değişim nötr gösterilir.
- Bir özellik tek sekmeye aittir; başka sekmeden yalnızca bağlantıyla anılır.
- Çiftçi dili: birincil ad anlamlıdır, teknik ad ikincil etikettir.

## Not (Adım 7A)
Eski "Hava durumu" sol menü ucu ve tüm bahçelerin hava özeti paneli kaldırıldı; bugünkü hava ve uyarılar Adım 7B'de bahçe listesi kartlarına (`GET /gardens/overview`) taşınır. Planlama simülasyonu bağlantısı Ayarlar → Araçlar altındadır.
