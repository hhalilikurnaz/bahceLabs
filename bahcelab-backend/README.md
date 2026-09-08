# BahçeLab Backend

Planning & Simulation API — Python 3.12 + FastAPI + PostgreSQL/PostGIS.

## Kurulum

```bash
# 1. Veritabanı
make docker-up

# 2. Python bağımlılıkları
make backend-install

# 3. Ortam değişkenleri
cp .env.example .env

# 4. Migration
make db-migrate
```

## Geliştirme

```bash
make backend-dev
```

API: `http://localhost:8000`  
Swagger: `http://localhost:8000/docs`  
Health: `http://localhost:8000/health`

## Workspace Header (dev)

Tüm planning endpoint'leri `X-Workspace-Id` header bekler:

```bash
curl -X POST http://localhost:8000/planning/plans \
  -H "Content-Type: application/json" \
  -H "X-Workspace-Id: 11111111-1111-4111-8111-111111111111" \
  -d '{"name": "Test Plan"}'
```

## Test

```bash
# Unit testler (DB gerektirmez)
cd bahcelab-backend && pytest tests/test_geometry_service.py -v

# Integration testler (DB gerekli)
make docker-up && make db-migrate && pytest -v -m integration
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
