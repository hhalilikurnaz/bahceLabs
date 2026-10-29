# BahçeLab — Phase 1 B Dokümantasyonu

Bu klasör, **Planning & Simulation** modülünün tek kaynak dokümantasyonudur. Agent'lar, geliştiriciler ve ekip üyeleri için yol haritası görevi görür.

## Dosya Haritası

| Dosya | Amaç |
|-------|------|
| **[reference-design.md](./reference-design.md)** | **Ana referans görsel + kullanım kuralları** |
| **[roadmap.md](./roadmap.md)** | **Yol haritası: kalan Faz 1 adımları, sıra ve kapsam (her oturumda oku)** |
| [plan.md](./plan.md) | Ana implementasyon planı — aşamalar, sıra, çıkış kriterleri |
| [progress.md](./progress.md) | Günlük backlog, yapılanlar, kalanlar |
| [architecture/phase-1-b-planning-simulation.md](./architecture/phase-1-b-planning-simulation.md) | Mimari genel bakış |
| [architecture/planning-domain-model.md](./architecture/planning-domain-model.md) | B domain entity'leri ve ilişkileri |
| [architecture/integration-boundaries.md](./architecture/integration-boundaries.md) | Phase 1 A ile entegrasyon sınırları |
| [product/phase-1-b-product-spec.md](./product/phase-1-b-product-spec.md) | Ürün tanımı ve kullanıcı akışı |
| [frontend/phase-1-b-screen-spec.md](./frontend/phase-1-b-screen-spec.md) | Ekran layout ve bileşen spec |
| [frontend/design-tokens.md](./frontend/design-tokens.md) | Tasarım token'ları |
| [frontend/component-map.md](./frontend/component-map.md) | Component hiyerarşisi |
| [frontend/marketing-and-auth.md](./frontend/marketing-and-auth.md) | Kurumsal site, giriş/kayıt, routing |
| [deployment/vercel.md](./deployment/vercel.md) | Vercel deploy ve bahcelabs.com DNS |
| [api/planning-api-contract.md](./api/planning-api-contract.md) | Backend API contract |
| [backend/plan.md](./backend/plan.md) | **Backend implementasyon planı** |
| [development/conventions.md](./development/conventions.md) | Kodlama kuralları |
| [development/anti-fabrication.md](./development/anti-fabrication.md) | Hard-code yasakları |
| [development/agent-guide.md](./development/agent-guide.md) | AI agent'lar için rehber |

## Branch

```
feature/phase-1-b-planning-simulation
```

## Monorepo Yapısı

```
bahcelab-web/
├── bahcelab-frontend/
├── bahcelab-backend/
└── docs/
```

## Tech Stack

- **React 19** + **TypeScript** (strict mode)
- **Vite** — build tool
- **Tailwind CSS v4** — styling
- **Zustand** — client state
- **TanStack Query** — server state / API
- **React Router** — routing

## Geliştirme Sırası

```
B0 → B1 → B2 → B3 → B4 → B5 → B6 → B7 → B8 → B9 → B10
```

Detaylar için [plan.md](./plan.md) dosyasına bakın.

## Referans Görsel

Ana UX mockup: [reference-design.md](./reference-design.md)  
Dosya: `docs/assets/reference-planning-workspace.jpg`

## Kritik Kurallar (Özet)

1. Simülasyon **asla** gerçek Garden/Tree kayıtlarını sessizce değiştirmez
2. Referans görseldeki sayılar **hard-code edilmez** (652, 8.2 ton, 2.35 ha, vb.)
3. Tüm KPI'lar backend hesaplamasından gelir
4. Map state ↔ planning state **karışmaz**
5. Phase 1 A koduna **mümkün olduğunca dokunulmaz**
