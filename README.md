# BahçeLab Frontend — Phase 1 B

Planning & Simulation modülü. Boş araziden hasada kadar akıllı planlama workspace'i.

## Tech Stack

- React 19 + TypeScript (strict)
- Vite
- Tailwind CSS v4
- Zustand + TanStack Query
- React Router

## Başlangıç

```bash
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

## Komutlar

```bash
npm run dev      # Geliştirme sunucusu
npm run build    # Production build
npm run lint     # Lint kontrolü
npm run preview  # Build önizleme
```

## Dokümantasyon

- [Ana Plan](docs/plan.md)
- [Referans Görsel](docs/reference-design.md)
- [İlerleme & Backlog](docs/progress.md)
- [Agent Rehberi](docs/development/agent-guide.md)

## Branch

```
feature/phase-1-b-planning-simulation
```

## Route'lar

| Route | Açıklama |
|-------|----------|
| `/planning` | Plan listesi / yeni plan |
| `/planning/:planId` | Planning workspace |
