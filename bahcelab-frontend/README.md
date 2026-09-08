# BahçeLab Frontend — Phase 1 B

Planning & Simulation modülü. Boş araziden hasada kadar akıllı planlama workspace'i.

## Başlangıç

```bash
# Monorepo root'tan
npm install
npm run dev
```

Tarayıcıda: `http://localhost:5173/planning`

## Ortam Değişkenleri

```bash
cp .env.example .env
```

| Variable | Default | Açıklama |
|----------|---------|----------|
| `VITE_PLANNING_API_MODE` | `mock` | `mock` veya `real` |

## Route'lar

| Route | Açıklama |
|-------|----------|
| `/planning` | Plan listesi / yeni plan |
| `/planning/:planId` | Planning workspace |

## Dokümantasyon

Monorepo root'taki [docs/](../docs/) klasörüne bakın.
