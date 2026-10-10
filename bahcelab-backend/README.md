# BahçeLab Backend

Planning & Simulation API — Python 3.12 + FastAPI + PostgreSQL/PostGIS.

## Kurulum

Komutları repo **kök dizininden** çalıştırın (`Makefile` yalnızca kökte).

```bash
# 1. Veritabanı (PostgreSQL 16 + PostGIS, Docker, port 5432)
make docker-up
#    Docker Desktop açık olmalı. Doğrulama:
docker compose ps                 # bahcelab-db → healthy

# 2. Python bağımlılıkları (bahcelab-backend/.venv oluşturur)
make backend-install

# 3. Ortam değişkenleri
cp bahcelab-backend/.env.example bahcelab-backend/.env

# 4. Tablolar (Alembic)
make db-migrate

# 5. Geliştirme verisi: test@bahcelab.com / test1234 kullanıcısı + Erdemli/Tömük'te örnek limon bahçesi (~26 dekar)
make db-seed
```

> **5432 doluysa** (başka bir Postgres çalışıyor): `docker-compose.yml` içindeki portu `"5434:5432"`
> yapın ve `.env` içindeki `DATABASE_URL`'de `localhost:5434` kullanın.

## Geliştirme

```bash
make backend-dev
```

API: `http://localhost:8001`  
Swagger: `http://localhost:8001/docs`  
Health: `http://localhost:8001/health`

Frontend ile birlikte çalışırken tarayıcı `http://localhost:5173/api/...` adresine gider; Vite bunu
`:8001`'e iletir. Böylece tarayıcı ve API **aynı origin** olur ve cookie'ler sorunsuz taşınır.

## Kimlik doğrulama

Giriş cookie tabanlıdır; token'lar JavaScript'ten okunamaz (`HttpOnly`).

| Uç nokta | Açıklama |
|----------|----------|
| `POST /auth/register` | `{name, email, password}`; şifre en az 8 karakter. `REGISTRATION_ENABLED=false` ise 403 |
| `POST /auth/login` | `{email, password}`; hatalıysa 401 |
| `POST /auth/refresh` | Refresh cookie'si ile yeni access + refresh verir (refresh döndürülür) |
| `POST /auth/logout` | Refresh token'ı iptal eder, cookie'leri siler (204) |
| `GET /auth/me` | Giriş yapmış kullanıcı ve `workspace_id` |

- **Access token:** JWT, `ACCESS_TOKEN_MINUTES` (15 dk), cookie `bahcelab_access`.
- **Refresh token:** opak rastgele değer, DB'de yalnızca SHA-256 özeti tutulur, `REFRESH_TOKEN_DAYS` (14 gün),
  cookie `bahcelab_refresh`. Kullanılmış bir refresh token tekrar gelirse kullanıcının tüm oturumları kapatılır.
- **Şifreler:** argon2.
- **Workspace:** istemciden gelmez; giriş yapmış kullanıcının çalışma alanı kullanılır. Tüm `/planning/*`
  uç noktaları giriş ister (yoksa 401, başka kullanıcının kaydı 404).
- **Cookie ayarları** `.env`'den gelir: `COOKIE_SECURE`, `COOKIE_SAMESITE`, `COOKIE_DOMAIN`, `CORS_ORIGINS`.
  Canlıda (`api.bahcelabs.com` + `bahcelabs.com`): `COOKIE_SECURE=true`, `COOKIE_DOMAIN=.bahcelabs.com`,
  `CORS_ORIGINS=https://bahcelabs.com`, güçlü bir `JWT_SECRET` (`API_DEBUG=false` iken varsayılan sırla
  başlatma reddedilir).
- `make db-seed` yalnızca `API_DEBUG=true` iken çalışır; üretime bilinen şifreli kullanıcı yazılmaz.

```bash
# Örnek (cookie jar ile)
curl -c jar.txt -X POST http://localhost:8001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@bahcelab.com", "password": "test1234"}'
curl -b jar.txt http://localhost:8001/planning/plans
```

## Bahçeler (`/gardens`)

Girişli kullanıcının kendi workspace'indeki bahçeler. Sınır GeoJSON `Polygon`/`MultiPolygon` (EPSG:4326,
`[boylam, enlem]`). **Alan istemciden alınmaz**: sunucu `ST_Area(geom::geography) / 1000` ile (elipsoid üzerinde, her UTM bölgesinde doğru) dekar olarak hesaplar.

| Uç nokta | Açıklama |
|----------|----------|
| `GET /gardens` | Bahçe listesi |
| `POST /gardens` | `{ad, urun, cesit?, dikim_yili?, geometry, il?, ilce?}`; `urun`: limon, portakal, mandalina, greyfurt, diger |
| `POST /gardens/measure` | `{geometry}` → `{alan_dekar, alan_m2}`; kaydetmeden doğrulama |
| `GET/PATCH/DELETE /gardens/{id}` | PATCH'te yalnızca gönderilen alanlar değişir; `geometry` gelirse alan yeniden hesaplanır |

Geçersiz sınır (kendini kesen), alan < 0,5 dekar veya > 5.000 dekar için `422` ve Türkçe mesaj döner
(`error.code = INVALID_GEOMETRY`). Başka kullanıcının bahçesi `404`.

## Uydu indeksleri (`/gardens/{id}/indeks`)

Sentinel-2 L2A (Microsoft Planetary Computer STAC, anahtar gerekmez). Bahçe kaydedilince son 13 ay arka
planda işlenir; her sahnede yalnızca bahçe penceresi COG'dan **bir kez** okunur (B02, B03, B04, B08, B05, B8A, B11, SCL)
ve tüm indeksler aynı okumadan hesaplanır: NDVI, MSAVI2, NDRE, NDMI, CIgreen ve gerçek renk.

| Uç nokta | Açıklama |
|----------|----------|
| `GET /indeks/tanimlar` | İndeks tanımları: ad, açıklama, skala aralığı, renk skalası |
| `GET /gardens/{id}/indeks` | Sahneler (indeks özetleriyle), uyarılar, işleme durumu. Son kontrolden 12 saat geçtiyse yeni sahne araması başlar |
| `POST /gardens/{id}/indeks/refresh` | «Şimdi güncelle» (202). Aktif iş varsa onu döner |
| `GET /gardens/{id}/indeks/{indeks}/{YYYY-MM-DD}.png` | Renkli görüntü (bahçe sınırına tam kırpılmış, dışı saydam); `indeks` = ndvi, msavi, ndre, ndmi, cigreen, gercek-renk |
| `GET /gardens/{id}/indeks/{indeks}/{YYYY-MM-DD}.bin` | Ham ızgara (float32 LE, geçersiz = NaN): kontrastlı mod, değişim ve karşılaştırma için |
| `GET /gardens/{id}/indeks/{indeks}/{YYYY-MM-DD}/zones` | Sorunlu bölgeler (GeoJSON) |
| `GET /gardens/{id}/verimlilik-bolgeleri?indeks=ndvi\|msavi` | Geçmiş görüntülerin ortalamasından düşük / orta / yüksek verimlilik bölgeleri (alan ve pay ile) |

- Maskeleme: SCL 3/8/9/10 ve bahçe dışı; geçerli piksel oranı < %70 → "bulutlu", atlanır. 20 m bantlar (B05, B8A, B11) 10 m ızgaraya bilinear örneklenir.
- Sorunlu bölge: medyanın altı (NDVI/MSAVI 0,10, NDRE 0,05, NDMI 0,08, CIgreen 0,35), ≥ 3 piksel, 4-komşuluk.
- Uyarılar (10–25 gün öncesine göre): NDVI/MSAVI > %10 düşüş; NDRE > %12 düşüş ("olası besin eksikliği / sararma"); NDMI > %15 göreli düşüş veya tarihsel medyanın altı ("olası su stresi"). Aynı bölgede birden çok indeks düşerse öncelik "yüksek" olur.
- Verimlilik bölgeleri: piksel başına geçmiş ortalama, 1 boyutlu k-means (3 sınıf), 3×3 çoğunluk filtresi, çokgenleştirme.
- Depolama: `STORAGE_DIR` (varsayılan `uploads/`, git'e girmez) altında `indeks/{bahçe}/{tarih}/{indeks}.png|.bin`; `shared/storage.py` arayüzü S3/R2'ye hazır.
- Ayarlar: `NDVI_ENABLED`, `NDVI_MONTHS` (13), `NDVI_MAX_PARALLEL_SCENES` (2), `NDVI_REFRESH_HOURS` (12).
- Ağ yoksa/Planetary Computer hata verirse iş "hata" olur ve anlaşılır mesaj döner; uygulama etkilenmez.
- Eski (yalnız NDVI) kayıtlar migration `007` ile yeni tabloya taşınır; eksik indeksler yeniden indirmeden değil, yalnızca gereken bantlar okunarak tamamlanır.
- `make db-seed` ağsız demo için tüm indekslerle örnek seri ekler (`kaynak = ornek`).

## Test

```bash
# Tüm testler (auth ve plan testleri DB gerektirir)
make docker-up && make db-migrate && make backend-test

# Yalnızca DB gerektirmeyenler
cd bahcelab-backend && PYTHONPATH=src .venv/bin/pytest -v -m "not integration"
```

## Mevcut Endpoint'ler

| Method | Endpoint | Aşama |
|--------|----------|-------|
| GET | `/health` | BE0 |
| POST | `/planning/plans` | BE0 |
| GET | `/planning/plans` | BE0 |
| GET | `/planning/plans/{id}` | BE0 |
| PATCH | `/planning/plans/{id}` | BE0 |
| DELETE | `/planning/plans/{id}` | BE0 |
| POST | `/planning/plans/{id}/land` | BE2 |
| GET | `/planning/products` | BE3 |
| GET | `/planning/products/{id}` | BE3 |
