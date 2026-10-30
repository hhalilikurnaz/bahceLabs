# BahçeLab — Yol haritası (Faz 1'in kalanı)

> **Her yeni oturumda bu belgeyi oku.** Belge yalnız **sıra ve kapsamı** tutar; her adımın ayrıntılı tasarımı o adımın kendi isteminde gelir. Bu belgede yazan bir adımın kodu, istemi gelmeden yazılmaz.
> Son güncelleme: 2026-10-30 (U4 onayı; son tasarım turu notu).

## Değişmeyen ilkeler (her adımda)
- **Sahte veri yok**: veri yoksa boş durum (neden + ne zaman gelir); test verisi yalnız `tests/support` ve API_DEBUG kapısı arkasında.
- **Eşikler ve kurallar katalogda**, sürümlü, «ön değer · mühendis onayı bekliyor» durumuyla; domain kuralları önce testle (TDD).
- **Gizli anahtarlar** (Mapbox, MapTiler, EARTHDATA_TOKEN) yalnız `.env.local`; koda, loga, ekran görüntüsüne, commit'e girmez.
- Veriyi değiştiren betikler: varsayılan dry-run, zorunlu kapsam, pg_dump yedeği, onay. Arka plan işleri idempotent; düşen iş **görünür** (log + bildirim) ve **kaldığı yerden devam eder** (`feed_runs`, ADR 0019/0020 notu).
- Her adımda: test piramidi (birim + sözleşme + entegrasyon + Playwright + axe), 1440/1024/390 kusursuz, [görselleştirme ilkeleri 1–11](design/gorsellestirme-ilkeleri.md) kontrol listesi, ADR, küçük conventional commit; push yalnız `feature/faz1`.
- Rastgele hata kabul edilmez: aralıklı düşen test düzeltilir (kök neden bulunur).

## Tamamlananlar (özet)
9A veri temeli · 9B kabuk + çalışma alanı · 9C Sentinel-2 dilimi (NDRE, NDMI, MSAVI, LAI) · 9D radar (Sentinel-1) · 9E su ve sıcaklık (ERA5, Landsat, SMAP/IMERG doğrulama) · 9F Durum v2 + olay motoru + bildirim karar katmanı + kesintisiz canlılık eğrisi · 9G Geçmiş sayfası + Saha Defteri (doğrulama) + dona bağlı değişim anomalisi (ADR 0019) · E olay doğrulamasında otomatik ön doğrulama (ADR 0021): istasyon gözlemi (Meteostat, gerçek gözlem satırları) + kamu kayıtları kataloğu (boş şema) → «destekleniyor / çelişiyor / kanıt yok» rozeti, «Doğrulamanız gereken» listesi, iki ayrı doğruluk sayısı; IMERG geçmişi 2015'e uzatma işi (`imerg_gecmis`).

## Sıradaki
**9H** (yeni görsel dilin üstüne). U1 (P0 ve hata dürüstlüğü) ve U4 (görsel dil v2 · Yön C: tek token dosyası, grafik bileşen seti, cam, hareket, sağ panel; ADR 0022; `docs/design/u4-ekranlar.pdf`, `docs/design/u4-hareket/`) tamamlandı.

**Son tasarım turuna ertelenenler:** Saha Defteri iç bölümleri ve giriş/tanıtım sayfaları yeni görsel dile **son tasarım turunda** (adım 27 ile birlikte) taşınır; ara adımlarda yalnız işlevsel olarak korunur.
**Kural:** bundan sonra her commit kendi başına derlenir ve testleri geçer.

## Kalan adımlar (bu sırayla)

### 9H · Sulama planı + TL
FAO-56 su dengesi: ET₀ × narenciye Kc, uydu taç örtüsüyle düzeltme, etkili yağış, SoilGrids toprak kovası, sistem verimi. Ağaç başına litre **«beyan edilen ağaç sayısına göre»** hesaplanır ve damlatıcı süresine çevrilir.
- **Maliyet:** EPDK tarımsal sulama tarifesi varsayılan (kaynak + geçerlilik tarihiyle gösterilir); kullanıcı kendi fiyatını girebilir.
- **Senaryolar:** alışkanlık mı plan mı · kuru/ıslak yıl (geçmiş gerçek hava) · kısıntılı sulama (uyarılı; riskli dönemde kilitli) · sistem değişikliği; sezon animasyonu.
- **Yer:** ana yeri ayrı **«Sulama planı»** sayfası; Bugün kartında tek satır; haritada varsayılan **kapalı** katman.
- Bağımlılık: ERA5, SMAP ve IMERG verisi eksiksiz olmalı (besleme kapsama raporu: `docs/agro/besleme-kapsami.md`).

### 9I · Gerçek su tüketimi (uydu ET)
Landsat + ECOSTRESS termal, SSEBop; **plan ile gerçeği karşılaştırma**.

### 9J · Veri ve model kalitesi izleme
Sahne kalitesi, model doğrulama oranı (Saha Defteri doğrulamalarından), kayma uyarısı, **haftalık otomatik kalite raporu**.

### 10 · Topografya, don ve hasar
DEM, gece yüzey sıcaklığı, olay sonrası hasar raporu.

### 10B · Sebep ayrıştırma (Ar-Ge)
Düşüş su mu, besin mi, hastalık mı, don mu. Önce **kural + olasılık**; sonra Saha Defteri doğrulamalarıyla eğitilen **kalibre model**; güven düşükse **«belirsiz»**.

### 11 · Günlük · 11B Rekolte tahmini · 12 İlaç defteri · 12B İhracat uyum pasaportu · 13 Maliyet defteri · 13B İTU / GlobalG.A.P. kayıt dosyası · 14 Toprak örneklemesi

### 14B · Hiperspektral yaprak besini (Ar-Ge, beta)
EnMAP, PRISMA, EMIT. **Laboratuvarla kalibre edilene kadar öneri üretmez.**

### 15 · Uygulama haritası + deneme blokları + KML
Ek olarak **ilaçlama drone'u** (DJI Agras, XAG) ve **traktör** (ISO-XML) için reçete haritası dışa aktarımı. **Doz etiket dozunu asla aşmaz.**

### 16 · Copilot + PDF rapor · 17 · Pazar ve Depo · 18 · WhatsApp Bekçi · 19 · Çoklu kullanıcı

### 19B · Komşularla anonim kıyas
**En az 10 benzer bahçe** ve **açık rıza**; koşul yoksa kıyas gösterilmez.

### 20 · Yayına hazırlık

### 20B · Açık API ve webhook
Sürümlü `/v1`, API anahtarı ve kapsamlar, hız sınırı, kullanım ölçümü, **HMAC imzalı webhook**.

### 21 · İşlerim · tarım ajanları · 22–26 Hizmetler ve veri ürünleri · 27 Yayın + 20 maddelik kontrol listesi · son tur tüm site UI/UX

## Belge haritası
Kararlar: `docs/mimari/karar/` (ADR 0001–0019 …) · kural kataloğu: `bahcelab-backend/src/bahcelab_backend/domain/agro/rules/katalog.yaml` · raporlar: `docs/agro/` · talimatlar: `docs/development/conventions.md`.
