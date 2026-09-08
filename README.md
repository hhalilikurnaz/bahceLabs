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

# Veritabanı
make docker-up

# Backend
make backend-install
cp bahcelab-backend/.env.example bahcelab-backend/.env
make db-migrate
make backend-dev          # http://localhost:8001

# Frontend (ayrı terminal)
npm install
cp bahcelab-frontend/.env.example bahcelab-frontend/.env
npm run dev               # http://localhost:5173/planning (geliştirme — DevTools'ta src/ görünür, normal)
```

Canlıya yakın test / demo için production build kullan (`dist/` servis edilir; `src/`, `node_modules/` DevTools'ta görünmez):

```bash
npm run preview           # build + production önizleme (4173 doluysa 4174, …)
```

Frontend varsayılan olarak **real API modunda** çalışır (`VITE_PLANNING_API_MODE=real`). Vite `/api` isteklerini `http://localhost:8001`'e proxy eder. Mock moda dönmek için `.env` içinde `VITE_PLANNING_API_MODE=mock` yap.

## Komutlar

| Komut | Açıklama |
|-------|----------|
| `make docker-up` | PostgreSQL + PostGIS başlat |
| `make backend-dev` | FastAPI dev server (port 8001) |
| `make backend-test` | Backend testleri |
| `npm run dev` | Frontend dev server |
| `npm run build` | Frontend production build |

## Dokümantasyon

- [Ana Plan](docs/plan.md)
- [Backend Plan](docs/backend/plan.md)
- [İlerleme](docs/progress.md)
- [API Contract](docs/api/planning-api-contract.md)

## Branch

```
feature/phase-1-b-planning-simulation
```
