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
