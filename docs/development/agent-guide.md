# AI Agent Rehberi — Phase 1 B

> Bu dosya Cursor agent'ları ve AI asistanlar için yol göstericidir.

## Başlamadan Önce Oku

0. **[reference-design.md](../reference-design.md)** — Ana UX mockup (görseli unutursan buraya bak)
1. [plan.md](../plan.md) — Ana implementasyon planı ve aşama sırası
2. [progress.md](../progress.md) — Güncel durum, yapılanlar, kalanlar
3. [anti-fabrication.md](./anti-fabrication.md) — Hard-code yasakları
4. [integration-boundaries.md](../architecture/integration-boundaries.md) — A ile sınırlar

## Çalışma Kuralları

### Yap

- Aktif aşamayı `progress.md`'den kontrol et
- Sadece o aşamanın scope'unu implement et
- Component'leri küçük tut (~150 satır max)
- Backend yoksa mock API kullan
- Empty/loading/error state'leri ekle
- `progress.md`'yi güncelle (yapılan/kalan)
- TypeScript strict, lint, build verify

### Yapma

- Tek seferde tüm B'yi yazma — aşama aşama
- Hard-coded KPI (652, 8.2 ton, 2.35 ha)
- Phase 1 A kodunu değiştirme
- Fake functionality (çalışmıyor gibi görünen buton)
- Map state ile planning state karıştırma
- `Math.random()` ile koordinat üretme
- A migration'larını değiştirme

## Dosya Oluşturma Kuralları

```
Yeni component  → bahcelab-frontend/src/features/planning-simulation/components/{area}/
Yeni hook       → bahcelab-frontend/src/features/planning-simulation/hooks/
Yeni type       → bahcelab-frontend/src/features/planning-simulation/types/
Yeni API        → bahcelab-frontend/src/features/planning-simulation/api/
Yeni test       → tests/{unit|e2e}/planning/
Yeni doc        → docs/{area}/
```

## Aşama Geçiş Protokolü

1. Mevcut aşamanın çıkış kriterlerini kontrol et
2. `npm run build` hatasız geçmeli
3. `progress.md`'de aşamayı ✅ işaretle
4. Sonraki aşamaya geç
5. Bir sonraki aşamaya geçmeden önce kullanıcıya durum bildir

## Backend Bağlantısı

Backend hazır değilse:
- `planningApi.mock.ts` kullan
- Component'ler `planningApi` interface'inden çağrı yapar
- Backend geldiğinde `planningApi.real.ts` yaz, env ile swap

Backend hazır olduğunda:
- `VITE_PLANNING_API_MODE=real` set et
- `planningApi.real.ts` implement et
- Mock'tan real'e geçiş test et

## Referans Görsel

Ana UX referansı: [reference-design.md](../reference-design.md)  
Dosya: `docs/assets/reference-planning-workspace.jpg`

Layout, panel yerleşimleri, dark tema, green accent birebir korunmalı. Sayılar korunmamalı.

## Hızlı Referans

| Soru | Cevap |
|------|-------|
| Hangi branch? | `feature/phase-1-b-planning-simulation` |
| Hangi aşamadayız? | `progress.md` → Aktif aşama |
| Backend var mı? | Hayır, mock API |
| Hard-code KPI? | YASAK |
| PlantingPoint = Tree? | HAYIR |
| Form wizard mı? | HAYIR, spatial workspace |
| MapLibre kurulu mu? | Hayır, B2/B8'de kurulacak |
