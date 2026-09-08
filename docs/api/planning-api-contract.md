# Planning API Contract

> Backend hazır olana kadar `planningApi.mock.ts` kullanılır.  
> Env: `VITE_PLANNING_API_MODE=mock|real`

## Endpoints

### Plan CRUD

| Method | Endpoint | Açıklama | Aşama |
|--------|----------|----------|-------|
| POST | `/planning/plans` | Yeni plan oluştur | B0 |
| GET | `/planning/plans` | Plan listesi | B9 |
| GET | `/planning/plans/{id}` | Plan detay | B0 |
| PATCH | `/planning/plans/{id}` | Plan güncelle | B9 |
| DELETE | `/planning/plans/{id}` | Plan sil | B9 |

### Land

| Method | Endpoint | Açıklama | Aşama |
|--------|----------|----------|-------|
| POST | `/planning/plans/{id}/land` | Draft land geometry kaydet | B2 |
| PATCH | `/planning/plans/{id}/land` | Geometry güncelle | B2 |

### Products

| Method | Endpoint | Açıklama | Aşama |
|--------|----------|----------|-------|
| GET | `/planning/products` | Ürün listesi | B3 |
| GET | `/planning/products/{id}` | Ürün detay + varieties | B3 |

### Planting

| Method | Endpoint | Açıklama | Aşama |
|--------|----------|----------|-------|
| POST | `/planning/plans/{id}/planting/calculate` | Grid hesapla | B4 |

**Request:**
```json
{
  "spacing_x_m": 6.0,
  "spacing_y_m": 6.0,
  "orientation_mode": "auto",
  "orientation_degrees": null,
  "boundary_margin_m": 0.5
}
```

**Response:**
```json
{
  "total_area_ha": 2.35,
  "usable_area_ha": 2.20,
  "spacing_x": 6.0,
  "spacing_y": 6.0,
  "row_count": 23,
  "planting_point_count": 652,
  "orientation": 45.0,
  "boundary_margin": 0.5,
  "rows": [...],
  "planting_points": [...]
}
```

> Not: Response'taki sayılar örnek format. Gerçek değerler hesaplamadan gelir.

### Maintenance

| Method | Endpoint | Açıklama | Aşama |
|--------|----------|----------|-------|
| POST | `/planning/plans/{id}/maintenance` | Bakım planı oluştur/güncelle | B6 |

### Simulation

| Method | Endpoint | Açıklama | Aşama |
|--------|----------|----------|-------|
| POST | `/planning/plans/{id}/simulation/run` | Simülasyon çalıştır | B7 |
| GET | `/planning/plans/{id}/simulation` | Simülasyon sonucu | B7 |

### Integration

| Method | Endpoint | Açıklama | Aşama |
|--------|----------|----------|-------|
| POST | `/planning/plans/{id}/apply-to-garden` | Garden'a aktar | B10 |

**Requires:** User confirmation, workspace validation, plan `saved` status.

## Authorization

- Tüm endpoint'ler workspace-scoped
- `workspace_id` header veya JWT claim'den
- IDOR koruması zorunlu
- Cross-workspace Garden integration engellenmeli

## Error Model

```json
{
  "error": {
    "code": "INVALID_GEOMETRY",
    "message": "Arazi sınırı geçersiz: self-intersection detected",
    "details": {}
  }
}
```

## Frontend Adapter

```typescript
// src/features/planning-simulation/api/index.ts
const useMock = import.meta.env.VITE_PLANNING_API_MODE !== 'real'
export const planningApi = useMock ? planningApiMock : planningApiReal
```

Component'ler `planningApi` üzerinden çağrı yapar — mock/real fark etmez.
