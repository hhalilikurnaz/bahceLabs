# BahçeLab Web

Monorepo — Planning & Simulation full-stack ürün.

```
bahcelab-web/
├── bahcelab-frontend/   React 19 + Vite + TypeScript
├── bahcelab-backend/    Python 3.12 + FastAPI + PostGIS
├── docs/                Paylaşılan dokümantasyon
├── docker-compose.yml   PostgreSQL + PostGIS
└── Makefile             Dev workflow
```

## Hızlı Başlangıç

Tüm `make` komutlarını monorepo **kök dizininden** (`bahcelab-web/`) çalıştır. `bahcelab-backend/` veya `bahcelab-frontend/` içine girip `make` kullanma — `Makefile` sadece kökte.

```bash
cd bahcelab-web   # repo kökü

# Ortam (portlar, konteyner adları; anahtarlar yalnız yerel dosyalarda)
cp .env.example .env

# Veritabanı (port: .env → DB_PORT, varsayılan örnek 5434)
make docker-up

# Backend
make backend-install
cp bahcelab-backend/.env.example bahcelab-backend/.env
make db-migrate
make db-seed              # yalnız test@bahcelab.com / test1234 (bahçe/veri oluşturmaz)
make backend-dev          # port: .env → API_PORT

# Frontend (ayrı terminal)
npm install
cp bahcelab-frontend/.env.example bahcelab-frontend/.env
npm run dev               # /api → API_PROXY_TARGET (bahcelab-frontend/.env)
```

**Sayfalar:** `/` tanıtım (kaydırmalı Journey hero), `/blog`, `/login`, `/register`, `/bahcem` ve `/planning` (giriş gerekli; giriş sonrası `/bahcem`). Detay: [docs/frontend/marketing-and-auth.md](docs/frontend/marketing-and-auth.md).

Canlıya yakın test / demo için production build kullan (`dist/` servis edilir; `src/`, `node_modules/` DevTools'ta görünmez):

```bash
npm run preview           # build + production önizleme (4173 doluysa 4174, …)
```

Frontend varsayılan olarak **real API modunda** çalışır (`VITE_PLANNING_API_MODE=real`). Vite `/api` isteklerini `API_PROXY_TARGET` adresine proxy eder (`bahcelab-frontend/.env`). Mock moda dönmek için `.env` içinde `VITE_PLANNING_API_MODE=mock` yap.

## Komutlar

| Komut | Açıklama |
|-------|----------|
| `make docker-up` | PostgreSQL + PostGIS başlat |
| `make db-migrate` | Alembic migration'larını uygula |
| `make db-seed` | Geliştirme kullanıcısı (test@bahcelab.com / test1234) |
| `make backend-dev` | FastAPI dev server (`API_PORT`) |
| `make e2e-test` | Uçtan uca testler — ayrı veritabanında (aşağıya bakın) |
| `make e2e-db-remove` | e2e veritabanı konteynerini ve hacmini kaldırır |
| `make backend-test` | Backend testleri |
| `npm run dev` | Frontend dev server |
| `npm run build` | Frontend production build |

## Uçtan uca testler ve e2e veritabanı

Playwright geliştirme veritabanına **dokunmaz**: `docker compose --profile e2e` ile ayrı bir PostGIS konteyneri (`E2E_DB_CONTAINER`,
port `E2E_DB_PORT`, veritabanı `E2E_DB_NAME`) açılır, şema kurulur; API (`E2E_API_PORT`) ve web (`E2E_WEB_PORT`) ayrı portlarda başlatılır
ve koşu sonunda e2e veritabanı boşaltılır. Değerler kök `.env`'dedir.

- Çalıştırma: `make e2e-test`
- Kaldırma (konteyner + hacim): `make e2e-db-remove`
- Yalnız durdurma: `docker compose --profile e2e stop db-e2e`

## Veriyi değiştiren betikler

`bahcelab-backend/scripts/` altındaki veri betikleri (`reprocess_after_offset_fix.py`, `cleanup_test_users.py`) **varsayılan dry-run**
çalışır; `--apply` ile önce `pg_dump` yedeği (`BACKUP_DIR`, konteyner `DB_CONTAINER`) alınır, etkilenecek kayıt sayısı gösterilir ve onay
istenir. Kapsam zorunludur (`--user` e-posta ya da `--garden` kimlik; temizlik betiği yalnız `e2e-*@example.test`).

## Dokümantasyon

- [Ana Plan](docs/plan.md)
- [Backend Plan](docs/backend/plan.md)
- [İlerleme](docs/progress.md)
- [Marketing & auth](docs/frontend/marketing-and-auth.md)
- [API Contract](docs/api/planning-api-contract.md)

## Branch

```
feature/phase-1-b-planning-simulation
```
