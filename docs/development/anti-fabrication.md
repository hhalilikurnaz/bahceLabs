# Anti-Fabrication Kuralları

> Referans screenshot sadece UX referansıdır. Sayılar backend'den gelir.

## Yasak Hard-Code Değerler

Bu değerler **asla** production component'lerde, constant'larda veya default state'te bulunmaz:

| Değer | Kaynak | Neden yasak |
|-------|--------|-------------|
| `652` | Mockup ağaç sayısı | Backend hesaplaması gerekli |
| `8.2` | Mockup ton verim | Simülasyon çıktısı, hard-code değil |
| `23` | Mockup sıra sayısı | Grid hesabından gelir |
| `2.35` | Mockup hektar | Geometry'den hesaplanır |
| `125 m`, `188 m` | Mockup ölçüler | Gerçek polygon'dan |
| `6.0 × 6.0 m` | KPI olarak | Spacing input default olabilir, KPI olarak gösterilmez |

## Yasak Davranışlar

| Davranış | Doğru Alternatif |
|----------|------------------|
| Sahte ağaç koordinatları | Backend grid calculation |
| `Math.random()` ile nokta üretme | Deterministic grid |
| Random planting points | Polygon → grid → containment |
| Sahte agronomic tavsiye | `not_configured` state |
| Sahte weather/satellite data | Gösterme |
| Sahte Garden mutation | Explicit user action only |
| Sahte "saved" response | Gerçek API call |
| Çalışıyor gibi görünen ama endpoint'i olmayan buton | Disabled veya "yakında" — fake functionality yok |

## Doğru Veri Akışı

```
Gerçek geometry → backend calculation → API response → UI render
Simülasyon inputs → simulation engine → labeled output → UI render
```

## UI Etiketleme

| Veri Tipi | Etiket |
|-----------|--------|
| Hesaplanmış KPI | Değer + birim (backend'den) |
| Simülasyon verimi | "Tahmini Verim (Simülasyon)" |
| Henüz hesaplanmadı | `—` veya empty state |
| Model yapılandırılmadı | "Henüz yapılandırılmadı" |
| Veri kaynağında yok | "Veri bulunamadı" |

## Test Fixture Ayrımı

```
tests/fixtures/planning/     ← Mock data (test only)
src/features/.../api/mock/   ← Development mock API
src/features/.../components/ ← Production (no hard-coded values)
```

Test fixture'larındaki sayılar production'a sızmaz.

## Code Review Checklist

- [ ] Component'te hard-coded sayı var mı?
- [ ] KPI backend response'tan mı geliyor?
- [ ] Simülasyon çıktısı etiketlenmiş mi?
- [ ] Empty state gerçek mi (sahte veri göstermiyor mu)?
- [ ] Buton gerçek endpoint'e bağlı mı?
