# BahçeLab — Mimari

> Güncel durum: Adım 7B-1. Her adımda güncellenir. Yapılmamış olanlar "planlı – Adım N" olarak işaretlidir.
> Kararlar: `docs/mimari/karar/` (ADR). Tasarım: `docs/design/`.

## 1. Sistem görünümü

```
Tarayıcı (React 19 + Vite, Tailwind 4, zustand, react-query, MapLibre)
   │  /api (cookie: httpOnly access+refresh JWT)
   ▼
FastAPI (api → domain servis → depo)  ── PostgreSQL 16 + PostGIS
   │                                       │ weather_cells/daily, scene/index_observations, gardens…
   ├── Uydu sağlayıcı  : Microsoft Planetary Computer STAC (Sentinel-2 L2A)  ── arayüz: domain/ndvi/stac.py
   ├── Hava sağlayıcı  : Open-Meteo (WeatherProvider arayüzü)                  ── domain/weather/provider.py
   ├── Depolama        : StorageBackend (yerel `uploads/`, S3/R2 hazır)        ── shared/storage.py
   ├── Altlık (harita) : Mapbox Satellite (ana) | MapTiler (yedek) | OSM        ── frontend map/mapStyles.ts
   ├── Adres arama     : MapTiler geocoding                                    ── frontend map/geocoding.ts
   ├── LLM (Copilot)   : planlı – Adım 16 (arayüz arkasında)
   └── Bildirim        : uygulama içi – Adım 8 (yapıldı); Adım 18 (WhatsApp/SMS)
```

## 2. Katmanlar ve modül sınırları

Backend (`bahcelab-backend/src/bahcelab_backend/`):

| Katman | Sorumluluk | Kural |
|---|---|---|
| `api/<modül>/router.py` | HTTP, doğrulama, yetki bağımlılığı | Yalnızca servisi çağırır; SQL/iş kuralı yok |
| `domain/<modül>/service.py` | İş akışı ve yetki (kullanıcı yalnızca kendi bahçesi) | Depo ve sağlayıcıları arayüz üzerinden kullanır |
| `domain/<modül>/repository.py` | Veritabanı erişimi | Servis dışından çağrılmaz; N+1 yok (toplu sorgu) |
| `domain/<modül>/rules.py` | Saf iş kuralları (uyarı, ilaçlama, durum) | G/Ç yok, birim testli |
| `shared/` | Hata, depolama, ortak yardımcılar | Modül bağımsız |
| `config.py` | **Tüm ayarlar tek yerde** (ortam değişkeni → tipli alan) | Sihirli sayı yok |

Modüller: `auth`, `gardens`, `ndvi` (uydu/indeks), `weather`, `overview` (liste özeti; gardens+ndvi+weather'ı birleştirir, yalnızca okur), `planning` (arayüzden kaldırıldı, ADR 0004).

Frontend (`bahcelab-frontend/src/`):

| Yol | Sorumluluk |
|---|---|
| `components/ui/` | Tasarım sistemi bileşenleri (yalnız token kullanır) |
| `features/bahcem/api/` | HTTP istemcisi + `dto/` (sunucu yanıt tipleri) → arayüz modelleri; `any` yok |
| `features/bahcem/lib/` | Saf mantık (`measure` çizim ölçümleri, `gardenFields` form doğrulaması, sıralama, şiddet, düzen, tarih, render, `raster` görünüm kuralları, `archive` adres durumu, `chartScale`); `config.ts` arayüz sabitleri |
| `features/bahcem/hooks/` | Rota/düzen/veri kancaları |
| `features/bahcem/components/` | Ekranlar (`garden`, `garden-page`, `hava`, `indeks`, `archive`, `layout`, `draw`) |
| `features/bahcem/map/` | MapLibre katmanları (tembel yüklenir: `map/maplibre.ts`) |
| `features/bahcem/stores/` | zustand: yalnızca arayüz durumu (sunucu verisi react-query'de) |

## 3. Veri akışı (özet)

- **Bahçe oluştur** → `POST /gardens` (alan sunucuda PostGIS ile) → son 13 ay arka planda işlenir (iş kuyruğu: süreç içi, DB'de durum) → sahne başına tek okuma, tüm indeksler + gerçek renk → PNG/ham ızgara depolamaya, özetler DB'ye.
- **Liste** → `GET /gardens/overview` (tek istek: bahçe, durum, küçük resim, 30 günlük seri, uyarılar, hava önbelleği) + arka planda `/weather/ozet` ile hava önbelleği tazelenir.
- **Bahçe sayfası** → rota `/bahcem/:id/(durum|analiz|hava|gunluk|rapor|arsiv)`; seçili bahçe URL'den gelir (`RouteSync`). Yerleşim: sol liste | harita | sağ panel (ADR 0006).
- **Bahçe ekleme** (ADR 0007): `DrawController` (terra-draw) → `GardenForm` (sağ panel, canlı) → `POST /gardens` → `ProcessingWatcher` işi izler; bahçe bilgileri `PATCH /gardens/{id}` (`agac_sayisi` dahil).
- **Durum skoru / Bugün / seriler** (ADR 0008): `domain/agro/` — `rules/katalog.yaml` (sürümlü, kural başına `durum` + `kaynak`), `score.py` ve `today.py` saf; `GET /gardens/{id}/durum|bugun|agro/seriler|agro/fenoloji`. Liste ve harita aynı `derive_status` fonksiyonunu kullanır. Doğrulanmamış kurallar: `docs/agro/KURAL-DURUMU.md`.
- **Bildirim arayüzü (8B)**: `api/notificationsApi.ts` (liste, okundu, tercih, 60 sn yoklama `useUnreadPoll`), `lib/notifications.ts` (saf: rozet metni, yeni kritik seçimi), `NotificationsPanel` (süzgeç + sayfalama + tıkla→okundu→bahçe/sekme), `NotificationToaster` (ilk yüklemede mevcutlar «görüldü» sayılır), rozet `IconRail`'de. Bahçe başlığındaki skor rozeti canlı `/durum`'dan gelir (liste anlık görüntüsü işe bağlı gecikebilir).
- **Zamanlanmış işler ve bildirimler** (ADR 0009): `jobs/` (kayıt defteri, `InlineScheduler`, arq işçisi, `JobQueue`); `generate_notifications` her bahçe için risk/uyarı/sulama hesaplar, `notifications` tablosuna tekrar önlemeli yazar (`dedupe_key`), kanallar `channels.registry`; liste skoru `garden_risk_snapshots`'ı okur. `GET /gardens/{id}/sulama|riskler`, `GET/POST /notifications…`.
- **Ana harita** her zaman en güncel geçerli görüntüyü çizer (`IndexLayer` → `lib/rasterRender.ts`); **Arşiv** aynı çizimi canvas'ta kullanır ve `GET /gardens/{id}/indeks/arsiv` ile sayfalanmış, net/en net işaretli listeyi alır (`domain/ndvi/archive.py`).
- **Hava** → hücre (0,05°) başına 1 saat önbellek, geçmiş günde bir tamamlanır; ağ yoksa son önbellek ve zaman damgası.
- **Durum etiketi** (İyi/İzle/Dikkat/Veri yok): `domain/overview/status.py` içinde TEK fonksiyon (`derive_status`); Adım 8'de skora bağlanır.

## 4. Sağlayıcı soyutlamaları

| Alan | Arayüz | Uygulama(lar) | Geçiş |
|---|---|---|---|
| Altlık | `buildStyle(kind, provider)` | Mapbox, MapTiler, OSM yedek | Katman menüsü; anahtar yoksa/401'de otomatik yedek |
| Uydu | `domain/ndvi/stac.py` (`search_scenes`, `read_scene`) | Planetary Computer | Yeni kaynak = aynı iki fonksiyon (Adım 9: takılıp çıkarılabilir) |
| Hava | `WeatherProvider` protokolü | Open-Meteo (ücretsiz/ücretli) | `get_provider()` tek yer |
| Depolama | `StorageBackend` | `LocalStorage` | S3/R2 sınıfı eklenir |
| LLM | planlı – Adım 16 | — | — |
| Bildirim | uygulama içi yapıldı (Adım 8); WhatsApp/SMS Adım 18 | `notifications/` | `NotificationsPanel`, `NotificationToaster` |

## 5. Ortam değişkenleri (değersiz)

Backend: `DATABASE_URL`, `API_HOST`, `API_PORT`, `API_DEBUG`, `CORS_ORIGINS`, `STORAGE_DIR`, `NDVI_ENABLED`, `NDVI_MONTHS`, `NDVI_MAX_PARALLEL_SCENES`, `NDVI_REFRESH_HOURS`, `OPEN_METEO_API_KEY`, `WEATHER_TIMEOUT_SECONDS`, `WEATHER_CACHE_MINUTES`, `WEATHER_CELL_DEGREES`, `WEATHER_HISTORY_DAYS`, `OVERVIEW_SPARKLINE_DAYS`, `OVERVIEW_WEATHER_MAX_AGE_HOURS`, `THUMBNAIL_MAX_PX`, `JWT_SECRET`, `ACCESS_TOKEN_MINUTES`, `REFRESH_TOKEN_DAYS`, `REGISTRATION_ENABLED`, `COOKIE_SECURE`, `COOKIE_SAMESITE`, `COOKIE_DOMAIN`.

Frontend (yalnızca `.env.local`; commit edilmez): `VITE_MAPBOX_TOKEN`, `VITE_MAPTILER_KEY`; ayrıca `VITE_PLANNING_API_BASE_URL`, `VITE_REGISTRATION_ENABLED`, `VITE_PLANNING_API_MODE`.

## 6. Kalite kapıları

Backend: `make backend-test` (pytest, DB gerekir) · `make backend-typecheck` (mypy + ruff). Frontend: `npx tsc -b` (strict) · `npx oxlint src` · `npx vitest run` · `npm run build` · `npm run test:e2e` (Playwright, çalışan backend + Vite gerekir; başsız tarayıcıda WebGL için SwiftShader bayrakları config'dedir; uydu serisi `tests.support.seed_scenes` test aracıyla yazılır).

## 7. Planlı (yapılmamış)

(Not: skor/Bugün/sulama/risk/bildirim merkezi Adım 8'de yapıldı.)

Skor ve "Bugün" kartı, sulama önerisi, zararlı riski, bildirim merkezi (Adım 8) · çok yıllık bölgeler ve iş kuyruğu (9) · topografya/don (10) · günlük ve hasat (11) · ilaç defteri (12) · maliyet (13) · toprak (14) · uygulama haritası (15) · Copilot ve PDF (16) · pazar & depo (17) · WhatsApp/SMS (18) · çoklu kullanıcı (19) · yayına hazırlık (20).
