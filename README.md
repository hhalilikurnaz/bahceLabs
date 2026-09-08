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

```bash
# Veritabanı
make docker-up

# Backend
make backend-install
cp bahcelab-backend/.env.example bahcelab-backend/.env
make db-migrate
make backend-dev          # http://localhost:8000

# Frontend (ayrı terminal)
npm install
npm run dev               # http://localhost:5173/planning
```

## Komutlar

| Komut | Açıklama |
|-------|----------|
| `make docker-up` | PostgreSQL + PostGIS başlat |
| `make backend-dev` | FastAPI dev server |
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
