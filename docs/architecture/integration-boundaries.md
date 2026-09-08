# Phase 1 A ↔ Phase 1 B Entegrasyon Sınırları

## Temel Kural

> Simulation/Planning domain'i Phase 1 A'daki gerçek Garden domain'inden **ayrıdır**.

## Ne Yapılır ✅

| B Tarafı | A Tarafı | İlişki |
|----------|----------|--------|
| Mevcut bahçe seçimi | `Garden` read | B, A'dan geometry okur |
| Alan hesabı | Garden geometry | Backend authoritative |
| Garden'a apply (B14) | `Garden`, `Parcel`, `Tree` write | Tek kontrollü endpoint |

## Ne Yapılmaz ❌

| Yasak | Açıklama |
|-------|----------|
| Dikim planı → Tree oluşturma | PlantingPoint ≠ Tree |
| Bakım planı → Observation oluşturma | Plan düzeyinde kalır |
| Simülasyon → Garden değiştirme | Sessiz mutation yasak |
| Plan kaydetme → Garden değiştirme | Save ≠ Apply |
| A domain modellerini değiştirme | Garden/Parcel/Block/Tree dokunulmaz |

## A Sistemleri — B'de Kullanılmaz

- Copilot
- Sentinel imagery
- Imagery pipeline
- Observation system
- IoT / actuator control

## Garden Integration (B14 — Son Aşama)

```
Kullanıcı "Gerçek Bahçeye Uygula" tıklar
  ↓
Confirmation dialog
  ↓
POST /planning/plans/{id}/apply-to-garden
  ↓
Backend validation (workspace, ownership, plan validity)
  ↓
Controlled mutation: Garden/Parcel/Tree creation
```

**Ön koşullar:**
- Plan `saved` durumda olmalı
- Target Garden kullanıcıya ait olmalı (workspace isolation)
- Cross-workspace mutation engellenmeli

## Dosya İzolasyonu

```
bahcelab-frontend/src/features/planning-simulation/   ← B (yeni, izole)
bahcelab-frontend/src/features/garden-core/           ← A (mevcut, dokunulmaz)
src/modules/map/                    ← Paylaşılan (read-only reuse)
```

## Merge Conflict Riski

| Dosya | Risk | Önlem |
|-------|------|-------|
| Global routing | Orta | `/planning/*` izole |
| Shared UI primitives | Düşük | Extend, override etme |
| MapLibre provider | Orta | Wrap, ikinci instance açma |
| Auth/workspace context | Orta | Consume, yeniden yazma |
| DB migrations | Yok | B yeni tablolar, A migration'larına dokunma |
