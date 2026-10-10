# BahçeLab — Faz 1 Planı (Uydu Tabanlı Bahçe İzleme)

> Hedef: narenciye (limon) bahçeleri için tam ekran uydu haritası, sol panelde bahçe listesi, koyu ve sade arayüz.
> Bahçe çizme, Sentinel-2 NDVI, hava durumu, bahçe günlüğü, sahada gözlem, AI Copilot.
> Marka kuralı: başka hiçbir ürünün adı, logosu veya görseli kullanılmaz.
> Durum: plan onaylandı (2026-10-10). **Adım 2–5 tamamlandı**, Adım 6'dan devam edilecek.

---

## 0. Mevcut durum (Adım 1 raporu)

### Stack ve çalıştırma

| Katman | Teknoloji | Çalıştırma |
|--------|-----------|------------|
| Frontend | React 19, TypeScript 6, Vite 8, Tailwind 4, react-router-dom 7, zustand 5, @tanstack/react-query 5, lucide-react, vitest, oxlint | `npm run dev` (kök) → `:5173`; `/api` Vite proxy ile `:8001`'e gider |
| Backend | Python ≥3.12, FastAPI, SQLAlchemy 2 (async) + asyncpg, Alembic, pydantic-settings, shapely, pyproj | `make backend-dev` → `:8001` (Swagger `/docs`) |
| Veritabanı | PostgreSQL 16 + PostGIS 3.4 (`docker-compose.yml`, container `bahcelab-db`) | `make docker-up`, `make db-migrate` |
| Dağıtım | Vercel (yalnızca frontend, `vercel.json`) | Backend için dağıtım yok |

Klasör yapısı (özet):

```
bahcelab-frontend/src/
  App.tsx                       # rotalar
  features/auth/                # AuthContext, ProtectedRoute, Login/Register (localStorage stub)
  features/marketing/           # landing, blog, JourneyHero
  features/planning-simulation/ # "Planlama" modülü: api/, stores/, components/, pages/
bahcelab-backend/src/bahcelab_backend/
  main.py, config.py, database.py
  api/deps.py                   # X-Workspace-Id header (dev stub)
  api/planning/router.py        # tek router
  domain/planning/              # models, repository, schemas, service, geometry_service
  migrations/versions/          # 001_initial_schema, 002_seed_products
```

### Rotalar

`/` landing · `/blog`, `/blog/:slug` · `/login`, `/register` · `/planning` (Planlama Merkezi) · `/planning/:planId` (workspace) · diğerleri `/`'e yönlenir.
Giriş sonrası varış noktası **`/planning`** ([LoginPage.tsx](../bahcelab-frontend/src/features/auth/pages/LoginPage.tsx) içinde `state.from ?? '/planning'`).
`/bahcem` yok.

### Giriş sistemi

Gerçek değil. [AuthContext.tsx](../bahcelab-frontend/src/features/auth/AuthContext.tsx) kullanıcıları `localStorage` (`bahcelab_auth_users`) içinde düz metin şifreyle tutar, token `local-<id>` sabit biçimindedir. Yeni kayıt `REGISTRATION_ENABLED = false` ile kapalı. Backend'de kullanıcı tablosu, JWT, şifre hash'i yok; API yalnızca `X-Workspace-Id` header'ına bakar (`REQUIRE_WORKSPACE_HEADER`), değeri frontend `.env`'deki sabit `VITE_WORKSPACE_ID` verir.
Not: yerel geliştirme için eklenen `DEV_TEST_USER` ([authStorage.ts](../bahcelab-frontend/src/features/auth/authStorage.ts)) Adım 2'de kaldırılacak.

### Veritabanı ve PostGIS

- Migration 001 `CREATE EXTENSION IF NOT EXISTS postgis` çalıştırır, yani eklenti kurulur; fakat **hiçbir tabloda geometri kolonu yok**.
- Tablolar: `simulation_plans` (arazi sınırı `draft_land` JSONB içinde GeoJSON), `products`, `varieties`, `rootstocks`. Migration 002 narenciye ürün kataloğunu seed eder.
- Geometri işi Python'da yapılıyor: [geometry_service.py](../bahcelab-backend/src/bahcelab_backend/domain/planning/geometry_service.py) (shapely + pyproj `Geod`; elipsoidal alan/çevre, geçerlilik kontrolü). Bu kod yeniden kullanılacak.
- Uç noktalar: `/health`, `/planning/plans` (CRUD), `/planning/plans/{id}/land`, `/planning/products`.
- Testler: `tests/test_geometry_service.py`, `tests/test_planning_api.py` (bazıları `integration` işaretli, canlı DB ister).

### Yarım kalan işler ve tutarsızlıklar

| Konu | Durum |
|------|-------|
| **Bahçe (garden)** | Frontend `gardenApi.real.ts` `/gardens` uç noktasını çağırıyor ama **backend'de yok** (404). Mock modda yalnızca `stubGardens.fixture.ts` var. `simulation_plans.garden_id` kolonu bir tabloya bağlı değil. |
| **Harita** | `SpatialCanvas.tsx` yalnızca yer tutucu; MapLibre veya başka harita bağımlılığı yok. `docs/progress.md` "B2 — MapLibre + polygon" işini sırada gösteriyor, başlanmamış. |
| **Auth** | `docs/progress.md`: "Phase 1 A backend auth" bekliyor. Başlanmamış. |
| **Planlama modülü** | Yeni bahçe dikimi için plan/simülasyon aracı (arazi → ürün → dikim → bakım → simülasyon). İzleme ürününden farklı bir amaç; silinmeyecek, "Planlama" menüsü altında kalacak. |
| **Port** | Makefile ve Vite 8001; `bahcelab-backend/README.md` 8000 diyor (eski). |
| **Docs** | `docs/README.md` yalnızca "Phase 1 B" kapsamını anlatır; bu belge onun üstüne eklenen yeni kapsamdır. Çelişki varsa bu belge geçerli. |

---

## 1. Genel kararlar

- **Framework değişmez.** React + Vite + FastAPI + Postgres/PostGIS aynen kalır. Yeni modül `bahcelab-frontend/src/features/bahcem/`; backend'de `domain/gardens`, `domain/monitoring`, `domain/weather`, `domain/journal`, `domain/copilot`.
- **Gerçek veri kuralı:** NDVI, hava ve günlük değerleri uydurulmaz ([anti-fabrication.md](./development/anti-fabrication.md)). Veri yoksa boş durum gösterilir.
- **Koordinat standardı:** her yerde WGS84 (EPSG:4326), GeoJSON `[lng, lat]`.
- **Yeni bağımlılıklar** yalnızca aşağıda gerekçesiyle belirtilenlerdir. Geri kalanı mevcut paketlerle yapılır (grafik için kendi SVG bileşenimiz, durum için zustand, veri çekme için react-query).
- **Ortam değişkenleri (yeni):**
  Backend: `JWT_SECRET`, `JWT_EXPIRE_MINUTES`, `ANTHROPIC_API_KEY`.
  Frontend: `VITE_MAPTILER_KEY`.

---

## 2. Adımlar

### Adım 1 — Repo incelemesi ✅
Bu belgenin 0. bölümü.

### Adım 2 — Gerçek giriş (users + JWT), girişten sonra doğrudan `/bahcem` ✅ (tamamlandı)

**Backend**
- Yeni bağımlılıklar: `argon2-cffi` (şifre hash'i), `PyJWT` (token). İkisi küçük ve standart.
- Migration `003_users.py`: `users` (`id uuid pk`, `email` unique küçük harf, `name`, `password_hash`, `created_at`) ve `workspaces` (`id`, `name`) + `workspace_members` (`user_id`, `workspace_id`, `role`). Kayıtta kullanıcıya otomatik workspace açılır.
- Dosyalar: `domain/auth/{models,repository,schemas,service,security}.py`, `api/auth/router.py`.
- Uç noktalar: `POST /auth/login` → `{access_token, user}`, `POST /auth/register` (`REGISTRATION_ENABLED` benzeri sunucu bayrağı `registration_enabled`, varsayılan kapalı), `GET /auth/me`.
- [deps.py](../bahcelab-backend/src/bahcelab_backend/api/deps.py): yeni `get_current_user` (Bearer token). `get_workspace_id` token'daki kullanıcının workspace'inden gelir; `X-Workspace-Id` header'ı yalnızca `require_workspace_header=true` iken eski dev yolu olarak kalır, sonra kaldırılır. Mevcut planning uç noktaları artık kimlik ister.
- Test kullanıcısı için `scripts/create_user.py` (CLI) — seed migration'a şifre yazılmaz.

**Frontend**
- [AuthContext.tsx](../bahcelab-frontend/src/features/auth/AuthContext.tsx) `localStorage` kullanıcı listesi yerine `/api/auth/*` çağırır; `authStorage.ts` yalnızca token'ı tutar. `DEV_TEST_USER` ve düz metin şifre saklama silinir.
- [apiClient.ts](../bahcelab-frontend/src/features/planning-simulation/api/apiClient.ts): `Authorization: Bearer` header'ı ekler, 401'de oturumu kapatıp `/login`'e atar. Ortak olduğu için `src/lib/apiClient.ts`'e taşınır.
- Yönlendirme: `LoginPage` varsayılan hedefi `/planning` → **`/bahcem`**; `App.tsx`'e `/bahcem` ve `/bahcem/:gardenId` (ProtectedRoute) eklenir; `/planning/*` olduğu gibi kalır. Giriş yapmış kullanıcı `/login`'e girerse `/bahcem`'e gider.
- Token saklama: httpOnly cookie (karar 1). Frontend token görmez; `credentials: 'include'` ile istek atar.

**Çıkış kriteri:** yanlış şifre 401; doğru şifre sonrası `/bahcem` açılır; sayfa yenilenince oturum sürer; `psql` ile `password_hash` alanında düz şifre yok.

### Adım 3 — OneSoil tarzı arayüz iskeleti (MapLibre + MapTiler uydu)

- Yeni bağımlılık: `maplibre-gl` (yalnızca bu; `react-map-gl` eklenmez, ince bir `useMap` hook'u yeterli).
- MapTiler Satellite stili, anahtar `VITE_MAPTILER_KEY` (yalnızca `.env.local`, commit yok). Anahtar yoksa harita yerine yapılandırma uyarısı gösterilir. Ücretsiz plan lisans/kota koşulları ticari kullanım öncesi kontrol edilmeli (karar 2).
- Dosyalar (`features/bahcem/`):
  - `pages/BahcemPage.tsx` — tam ekran düzen
  - `components/map/MapView.tsx` — harita yaşam döngüsü, sürükle/yakınlaş, `ResizeObserver`
  - `components/layout/TopBar.tsx` — logo, arama, kullanıcı menüsü, Planlama bağlantısı
  - `components/layout/LeftPanel.tsx` — bahçe listesi (Adım 4'te dolar), daraltılabilir
  - `components/layout/RightDock.tsx` — Copilot yuvası (Adım 8)
  - `stores/bahcemStore.ts` (zustand) — seçili bahçe, panel durumu, çizim modu
  - `styles/bahcem.css` — koyu tema token'ları; mevcut [design-tokens.md](./frontend/design-tokens.md) ile hizalanır
- `SpatialCanvas.tsx` (Planlama) yeni `MapView`'ı kullanacak şekilde ileride güncellenir; bu adımda dokunulmaz.
- Mobilde sol panel alttan açılan çekmeceye dönüşür.

**Çıkış kriteri:** `/bahcem` tam ekran uydu haritası açar; paneller açılıp kapanır; konsolda hata yok; `npm run build` ve `tsc -b` temiz.

### Adım 4 — Bahçe ekleme: konum arama, yakınlaşma, poligon çizimi, alan, kaydetme ✅ (tamamlandı)

**Backend** (`domain/gardens/`, `api/gardens/`, migration `004_gardens`)
- `gardens` tablosu: `id`, `workspace_id` (FK, cascade), `ad`, `urun` (limon | portakal | mandalina | greyfurt | diger), `cesit`, `dikim_yili`, `geom geometry(Geometry,4326)` (yalnızca POLYGON/MULTIPOLYGON, CHECK), `alan_dekar`, `il`, `ilce`, `created_at`, `updated_at`; GiST indeksi `ix_gardens_geom`. `geoalchemy2` eklendi.
- **Alan sunucuda:** `ST_Area(geom::geography) / 1000` (WGS84 elipsoidi üzerinde, UTM bölgesinden bağımsız; Türkiye'nin her yerinde doğru). İstemcinin gönderdiği alan yok sayılır. (İlk sürüm sabit UTM 36N kullanıyordu; migration `005_area_geography` mevcut kayıtları yeniden hesaplar.)
- **Doğrulama (422, Türkçe):** `ST_IsValid` (kendini kesen sınır), alan < 0,5 veya > 5.000 dekar, kapalı olmayan halka, koordinat aralığı, ad/ürün/dikim yılı. Yükseklik (z) değerleri atılır.
- **API** (giriş gerekli, yalnızca kendi workspace'i; başkasının bahçesi 404): `GET/POST /gardens`, `GET/PATCH/DELETE /gardens/{id}`, `POST /gardens/measure` (kaydetmeden doğrulama + alan). Cevapta Türkçe alanlara ek olarak planlamanın beklediği `name`, `location_label`, `area_m2` vardır.
- **Planlama entegrasyonu:** `POST /planning/plans` `garden_id` ile çağrılınca bahçenin sınırı `draft_land`'a aktarılır ("Kayıtlı bahçe ile devam"); başka kullanıcının bahçesi 404, çok parçalı bahçe 422. Bahçe silinince planlardaki `garden_id` temizlenir.
- `make db-seed`: test kullanıcısına Erdemli/Tömük'te ≈26 dekarlık "Tömük Limon Bahçesi".

**Frontend** (`features/bahcem/`)
- `terra-draw` + `terra-draw-maplibre-gl-adapter` (poligon çizimi ve sınır düzenleme), `@tmcw/togeojson` + `jszip` (KML/KMZ).
- Akış: "Bahçe ekle" → **Haritada çiz** / **Dosya yükle (KML, KMZ, GeoJSON)**. Çizim zoom 14'ün altında pasif; canlı alan, geri al (Ctrl/Cmd+Z), Esc iptal, köşe sürükleme; ilk/son noktaya tıklayarak, çift tıklayarak veya Enter ile bitirme.
- Dosyada birden fazla poligon varsa seçtirilir (hepsi haritada gösterilir).
- Kaydetme formu (sol panel): ad, ürün, çeşit, dikim yılı, sunucudan gelen alan (salt okunur), il/ilçe (MapTiler ters geocoding: il = `county`, ilçe = `joint_municipality`/`municipality`; düzenlenebilir). Sunucu hataları formda gösterilir.
- Kayıtlı bahçe yeşil kenarlı yarı saydam poligon; listeden/haritadan seçim, `fitBounds`; açılışta tüm bahçelere odaklanma; ad ile arama.
- Liste öğesi "…" menüsü: Adını düzenle, Sınırı düzenle (terra-draw; çok parçalı/delikli bahçeler şimdilik düzenlenemez), Sil (onay penceresi).

**Çıkış kriteri karşılandı:** çizilen/yüklenen bahçe kaydedilir, yenilemede yerinde durur, alan PostGIS jeodezik hesabıyla eşleşir (`tests/test_gardens_api.py`), geçersiz sınır ve alan sınırları Türkçe mesajla reddedilir.

### Adım 5 — Uydu NDVI izleme (Sentinel-2, Planetary Computer) ✅ (tamamlandı)

**Backend** (`domain/ndvi/`, `api/ndvi/`, migration `006_ndvi`)
- **Kaynak:** Microsoft Planetary Computer STAC (`sentinel-2-l2a`, anahtar gerekmez; `pystac-client`, `planetary-computer`). Bantlar B04, B08 (10 m) ve SCL (20 m → nearest ile 10 m). COG'dan yalnızca bahçe penceresi okunur (`rasterio` windowed read), tüm görüntü indirilmez.
- **Yansıtım:** L2A ürünlerinde (baseline ≥ 04.00) `raster:bands` içindeki `scale`/`offset` (−0,1) uygulanır; ham sayısal değerle NDVI hesaplamak sapma yaratır.
- **Maskeleme:** SCL 3, 8, 9, 10 ve bahçe dışı pikseller; bahçe içindeki geçerli piksel oranı < %70 ise tarih `bulutlu` olarak kaydedilir ve atlanır. NDVI = (B08 − B04) / (B08 + B04).
- **Tablolar:** `ndvi_observations` (garden_id, tarih, scene_id, bulut_orani, gecerli_piksel_orani, ortalama, medyan, p10, p90, min, max, png_yolu, sorunlu_bolge_geojson, goruntu_koordinatlari, kaynak, created_at; `(garden_id, tarih)` benzersiz — aynı tarih ikinci kez hesaplanmaz) ve `ndvi_jobs` (bekliyor → isleniyor → tamam | hata, ilerleme; bahçe başına tek aktif iş).
- **PNG:** 10 m piksel (keskin), kırmızı → sarı → yeşil (0,0–0,9), bahçe dışı/maskeli saydam; `shared/storage.py` içindeki `StorageBackend` arayüzüyle diskte (`uploads/ndvi/{bahçe}/{tarih}.png`, ileride S3/R2).
- **Sorunlu bölgeler:** medyanın 0,10 altındaki piksel kümeleri (≥ 3 piksel = 300 m², 4-komşuluk) poligona çevrilir, GeoJSON olarak saklanır (alan, ortalama NDVI).
- **Uyarı:** son geçerli görüntünün ortalaması, 10–25 gün önceki görüntüye göre %10'dan fazla düştüyse "NDVI düşüşü".
- **İşleme:** bahçe kaydedilince son 13 ay arka planda; aynı anda en fazla 2 sahne; geçici ağ hatalarında tekrar deneme; bahçe açıldığında son kontrolden 12 saat geçtiyse yeni sahne araması; `POST .../refresh`. Sınır düzenlenince kayıtlar ve PNG'ler silinip yeniden işlenir (çalışan iş iptal edilir, sınır değiştiyse eski sonuçlar yazılmaz). Sunucu yeniden başlarsa yarım kalan işler "hata" olur ve yeniden başlatılabilir.
- **API (hepsi girişli, yalnızca kendi bahçesi; başkasının bahçesi 404):** `GET /gardens/{id}/ndvi`, `GET /gardens/{id}/ndvi/{tarih}.png`, `GET /gardens/{id}/ndvi/{tarih}/zones`, `POST /gardens/{id}/ndvi/refresh`. Bahçe listesi yanıtında `son_ndvi_ortalama` / `son_ndvi_tarihi`.
- **Örnek veri:** `make db-seed` Tömük bahçesi için ağsız demo serisi üretir (`kaynak = "ornek"`, arayüzde etiketli); «Şimdi güncelle» örnek kayıtları gerçek veriyle değiştirir.
- **Alan hesabı** ayrıca `ST_Area(geom::geography)` olarak güncellendi (migration `005`).

**Frontend** (`features/bahcem/`)
- Bahçe seçilince sol panel detaya döner: başlık, son NDVI + renkli rozet, uyarı kartı, bu/geçen sezon SVG grafiği (tarihe tıklayınca haritada o görüntü), işleme durumu ve «Şimdi güncelle».
- Harita: NDVI PNG'si bahçe sınırına oturur (nearest), lejant, sorunlu bölgeler kesikli kırmızı çizgi (tıklayınca alan ve ortalama NDVI), katman seçicide NDVI aç/kapat.
- Haritanın altında tarih şeridi (önizlemeler, bulutlu tarihler soluk ve tıklanamaz, ok tuşlarıyla gezinme). Liste rozeti/silüeti gerçek NDVI rengiyle.
- Grafik için yeni kütüphane eklenmedi.

**Ölçüm (Tömük, 26 dekar, gerçek Sentinel-2):** 13 aylık işleme ≈ 61 sn (113 sahne: 80 geçerli, 33 bulutlu; sahne başına ~1,1 sn, 2 paralel).

### Adım 5B — Çoklu indeks ve görselleştirme ✅ (tamamlandı)

- **Düzeltmeler:** (1) PNG artık bahçe sınırına tam kırpılır (ince çözünürlükte kırpma; istemcide canvas clip), sınır dışı hiçbir piksel görünmez. (2) Tarih biçimi tek yardımcıda (`lib/dates`, saat dilimi bağımsız); şerit, harita etiketi ve grafik aynı tarihi gösterir, yıl ayırıcıları ve testler eklendi.
- **İndeksler:** NDVI, MSAVI2, NDRE, NDMI, CIgreen, gerçek renk — sahne başına tek okuma (7 bant + SCL), ek indirme yok. Genel `scene_observations` + `index_observations` tabloları (migration `007`, mevcut NDVI verisi yeniden indirilmeden taşındı).
- **Uyarılar:** indeks bazlı Türkçe kurallar (NDRE sararma, NDMI su stresi, çoklu indeks → yüksek öncelik).
- **Görselleştirme:** indeks seçici (panel + harita katmanı), Mutlak/Kontrastlı (p2–p98) ve Piksel/Yumuşak modları, değişim haritası (son 2 hafta, geçen yıl aynı dönem, özel tarih), kaydırmalı karşılaştırma (iki tarih veya iki indeks), zaman atlaması (oynat/duraklat, hız), çok indeksli grafik, verimlilik bölgeleri (düşük/orta/yüksek, alan ve pay).
- **Ölçüm (Tömük, 26 dekar, gerçek Sentinel-2):** 13 aylık işleme ≈ 94 sn (113 sahne; yalnız NDVI iken ≈ 61 sn).

### Adım 6 — Hava durumu (Open-Meteo) ve tarımsal uyarılar ✅ (tamamlandı)

**Backend** (`domain/weather/`, `api/weather/`, migration `008_weather`)
- **Sağlayıcı arayüzü:** `provider.py` (`WeatherProvider` protokolü ve sağlayıcıdan bağımsız `Forecast/DailyPoint` biçimleri); Open-Meteo uygulaması yalnızca `open_meteo.py`'dadır. Ticari kullanımda `OPEN_METEO_API_KEY` verilince ücretli (`customer-*`) uç noktalar kullanılır; başka sağlayıcıya geçiş = yeni sınıf + `get_provider()`.
- **Konum ve hücre:** bahçe merkezi (`ST_Centroid`) 0,05° ızgaraya yuvarlanır (`weather_cells`); yakın bahçeler aynı hücreyi paylaşır, eşzamanlı istekler hücre başına kilitle tek sağlayıcı çağrısına iner.
- **Tahmin:** şu an + 7 gün saatlik (sıcaklık, nem, yağış, yağış olasılığı, rüzgâr, hamle, ET₀) + günlük özet; hücrede 1 saat önbellek. Ağ yoksa son önbellek `onbellekten: true` ve `guncelleme` zamanıyla döner; hiç önbellek yoksa 503 ve anlaşılır mesaj.
- **Geçmiş:** `weather_daily` (hücre, tarih, min/max, yağış, ET₀, kaynak = arsiv | tahmin | ornek); 425 gün (13 ay + geçen yıl karşılaştırması payı), günde bir tamamlanır (yalnızca eksik günler + son 10 gün ERA5 düzeltmesi için yeniden alınır). Arşivde henüz olmayan son günler tahmin API'sinin geçmiş günleriyle doldurulur.
- **Kurallar** (`rules.py`, saf fonksiyonlar, Türkçe açıklamalı):
  - İlaçlama (saatlik): uygun = rüzgâr < 15 ve hamle < 25 km/s, o saatte yağış yok, sonraki 6 saatte yağış olasılığı < %30, 10–28 °C. «Sınırda» ve «uygun değil» bantları (rüzgâr 15–20, hamle 25–32, olasılık %30–50, sıcaklık 8–10 / 28–30) ve nedenler. Günlük «en iyi aralık» yalnızca 05:00–21:00 gündüz saatlerinden seçilir.
  - Don: ≤ 2 °C sarı «Don riski», ≤ 0 °C kırmızı «Don tehlikesi»; kaç saat sürdüğü ve ayrı geceler ayrı uyarı. Sıcak: günlük max ≥ 38 °C sarı, ≥ 42 °C kırmızı.
  - Su dengesi: son 7 / 30 gün yağış − ET₀ (bilgi; reçete değil). Yağış toplamları: son 7, 30 gün ve sezon başından beri (su yılı: 1 Ekim); geçen yılın aynı dönemiyle (veri %90'dan eksikse gösterilmez).
- **API (girişli, yalnızca kendi bahçesi, başkasınınki 404):** `GET /gardens/{id}/weather`, `GET /gardens/{id}/weather/history?from&to`, `GET /weather/ozet` (tüm bahçelerin özeti), `GET /indeks/uyari-ozeti` (bahçe listesi simgeleri için uydu uyarıları; iş başlatmaz).
- **Örnek veri:** `make db-seed` Tömük için ağsız örnek tahmin ve geçmiş yazar (`kaynak = ornek`); internet varsa ilk istekte gerçek veriyle değişir.

**Frontend** (`features/bahcem/components/hava/`)
- Bahçe detayında **Uydu | Hava** sekmeleri. Hava sekmesi: don/sıcak uyarı kartları (uydu uyarılarıyla aynı tasarım, kırmızı önce), şu anki durum, 7 günlük tahmin, her gün için 24 saatlik ilaçlama şeridi (yeşil/sarı/kırmızı, üzerine gelince/dokununca/odaklanınca nedeni), su dengesi ve yağış toplamları, Open-Meteo atfı (CC BY 4.0, bağlantılı).
- Uydu grafiğinde **Hava katmanı**: günlük yağış çubukları ve ortalama sıcaklık çizgisi aynı zaman ekseninde; ipucunda seçili günün yağış ve sıcaklığı.
- Sol şeritteki «Hava durumu»: tüm bahçelerin özeti (şimdiki durum, en yakın don/sıcak uyarısı, ilk uygun ilaçlama aralığı); tıklayınca o bahçenin Hava sekmesi açılır.
- Bahçe listesinde aktif uyarı simgeleri (don, sıcak, uydu düşüşü; kırmızı/sarı).
- Birimler °C, mm, km/s; Türkçe gün adları; saat dilimi Europe/Istanbul.

### Adım 7 — Blok bölme, bahçe günlüğü, sahada gözlem

- Migration `006_blocks_journal.py`:
  - `garden_blocks` (`id`, `garden_id`, `name`, `geom geometry(Polygon,4326)`, `area_m2`)
  - `journal_entries` (`id`, `garden_id`, `block_id` nullable, `entry_type` ∈ ilaçlama/gübreleme/sulama/budama/hasat/diğer, `occurred_at`, `product`, `dose`, `unit`, `note`, `created_by`, `weather_snapshot` JSONB)
  - `field_observations` (`id`, `garden_id`, `block_id` nullable, `location geometry(Point,4326)`, `category` ∈ hastalık/zararlı/don/kuraklık/diğer, `severity` 1–3, `note`, `photo_key` nullable, `created_by`, `observed_at`)
- Blok bölme: bahçe üzerine çizilen bir çizgi `shapely.ops.split` ile poligonu böler; `POST /gardens/{id}/blocks/split` (GeoJSON LineString) alan/geçerlilik doğrulaması yapar ve blokları yazar. Frontend çizim `terra-draw` çizgi modu ile yapılır. NDVI istatistiği blok bazında da hesaplanır (Adım 5 servisi blok poligonunu da kabul eder).
- Günlük: `GET/POST /gardens/{id}/journal`, `PATCH/DELETE /journal/{id}`; yeni kayıtta o anki hava özeti otomatik eklenir (Adım 6).
- Sahada gözlem: `GET/POST /gardens/{id}/observations`; telefonda "Gözlem ekle" `navigator.geolocation` ile konumu alır, haritada nokta olarak gösterilir. Fotoğraf: `POST /observations/{id}/photo` (multipart, `python-multipart` zaten bağımlılık) yerel `uploads/` klasörüne `StorageBackend` arayüzüyle yazılır; boyut ve tür (jpeg/png/webp) sınırlanır, dosya adı sunucuda üretilir.
- Frontend: `components/journal/{JournalList,JournalForm}.tsx`, `components/blocks/{BlockSplitTool,BlockList}.tsx`, `components/observations/{ObservationPin,ObservationForm}.tsx`.

**Çıkış kriteri:** bahçe iki bloğa bölünür, alanların toplamı bahçe alanına eşittir (±%0,5); günlük kaydı ve gözlem eklenip listelenir; başka workspace'in kayıtları görünmez.

### Adım 8 — AI Copilot (sağda açılır panel) ve sezon raporu (PDF)

- Yeni bağımlılık: `anthropic` (resmi Python SDK). Model kimliği yapılandırmadan okunur (`copilot_model`, varsayılan güncel Sonnet sürümü).
- Backend: `domain/copilot/{service,tools,prompt,schemas}.py`; `POST /gardens/{id}/copilot/chat` (SSE ile akış). Model, bahçe bağlamını **araçlar** üzerinden okur: `get_ndvi_series`, `get_weather`, `get_journal`, `get_alerts`, `get_observations`. Sistem istemi: yalnızca bu araçlardan gelen veriye dayan, veri yoksa "veri yok" de, tarım tavsiyesi yerine gözlem ve olası nedenler sun, kimyasal doz verme. API anahtarı yoksa uç nokta 503 + net mesaj döner.
- Frontend: `components/copilot/{CopilotPanel,MessageList,Composer}.tsx` sağdaki `RightDock` içinde açılır; konuşma geçmişi oturumluk (DB'ye yazılmaz, karar 4); akış `fetch` + `ReadableStream`.
- Sezon raporu: `GET /gardens/{id}/report?season=2026` PDF döner. Yeni bağımlılık: `reportlab` (saf Python, sistem paketi gerektirmez; Türkçe karakterler için DejaVu fontu repoya eklenir). İçerik: bahçe bilgisi ve alanı, NDVI grafiği (matplotlib yerine rapor için basit çizgi grafik reportlab ile çizilir), uyarılar, günlük özeti, gözlemler. Copilot kısa bir yorum paragrafı ekleyebilir; kapalıysa rapor onsuz üretilir.

**Çıkış kriteri:** Copilot yalnızca araç verisine dayanarak yanıtlar (veri olmayan bahçede "veri yok" der), PDF Türkçe karakterlerle doğru açılır.

---

## 3. Sıralama ve bağımlılıklar

```
2 (auth) → 3 (arayüz) → 4 (bahçe) ─┬→ 5 (NDVI) ─┐
                                    ├→ 6 (hava) ─┼→ 8 (Copilot + rapor)
                                    └→ 7 (blok/günlük/gözlem) ─┘
```

5, 6 ve 7 Adım 4'ten sonra birbirinden bağımsız ilerleyebilir. Her adım ayrı dalda/PR'da, kendi migration'ı ve testleriyle teslim edilir.

## 4. Kararlar (2026-10-10)

1. **Dağıtım:** şimdilik yalnızca lokal. İleride backend `api.bahcelabs.com`, frontend `bahcelabs.com` (Vercel).
   Bu yüzden JWT **httpOnly + Secure + SameSite=Lax cookie** ile taşınır, `localStorage`'da token tutulmaz.
   Lokalde Vite proxy (`/api` → `:8001`) ile aynı origin. CORS ve cookie ayarları `.env`'den gelir.
2. **MapTiler:** geliştirme ve pilot için ücretsiz plan. Anahtar yalnızca `bahcelab-frontend/.env.local`'de durur,
   commit'lenmez (`*.local` zaten gitignore'da). Canlıya çıkmadan lisans koşulları yeniden kontrol edilir.
3. **Fotoğraflar:** Adım 7'de yerel `uploads/` klasörü, ayrı bir **storage arayüzü** (`StorageBackend`:
   `save/open/delete/url`) üzerinden; ileride S3/R2 uygulaması aynı arayüze takılır. "Fotoğrafsız başla"
   kararı kaldırıldı — Adım 7 fotoğraf yüklemeyi içerir (`field_observations.photo_key`).
4. **Copilot geçmişi:** oturumluk (DB'ye yazılmaz).
5. **Workspace modeli:** 1 kullanıcı = 1 workspace; `workspace_members` tablosu ileride ekip paylaşımına hazır.
6. **Planlama modülü:** yeni arayüzde üst menüde ayrı "Planlama" bölümü olarak kalır.

## 5. Riskler

- Planetary Computer Data API anonim hız sınırı ve şema değişiklikleri: istemci tek modülde, cache zorunlu.
- NDVI için bulut/gölge maskesi hatalı olursa yanlış uyarı üretir: uyarı sayfasında dayanak gözlem ve tarihi gösterilir.
- `terra-draw` ve `maplibre-gl` sürüm uyumu: kurulumda sürümler sabitlenir.
- Eski `localStorage` hesapları Adım 2'de geçersiz olur; bu geçiş bilinçli ve belgelenir.
