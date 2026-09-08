# Referans Görsel — Planning Workspace

> **Ana UX/UI referansı.** Layout, panel yerleşimi, tema ve görsel hiyerarşi bu görsele mümkün olduğunca birebir yaklaşmalıdır.

## Görsel

![Dijital Bahçe Planlama & Simülasyon — Referans Tasarım](./assets/reference-planning-workspace.jpg)

**Dosya yolu:** `docs/assets/reference-planning-workspace.jpg`

---

## Bu Görsel Ne İçin?

Phase 1 B'nin **planlama workspace** ekranının hedef tasarımıdır. Halil'in gönderdiği "Dijital Bahçe Planlama & Simülasyon" mockup'ı.

Görseldeki şunlar **korunmalı**:

- Layout (header → stepper → 3 kolon → KPI bar → timeline → footer)
- Koyu premium agricultural tema
- Lime/green accent renkleri
- Sol planning stepper + araçlar
- Orta spatial canvas (harita / 2D-3D)
- Sağ contextual bilgi panelleri
- Alt özet metrik barı
- Growth simulation timeline
- 2D / 3D kontrolleri, compass, zoom
- Kart yapıları, border radius, spacing
- Tipografi hiyerarşisi
- Bilgi yoğunluğu ve görsel hiyerarşi

---

## Bu Görseldeki Sayılar KULLANILMAZ

Görseldeki değerler **sadece tasarım referansı**dır. Production'da hard-code edilmez:

| Mock değer | Açıklama |
|------------|----------|
| `2.35 ha` | Alan — geometry'den backend hesaplar |
| `652 adet` | Toplam ağaç — grid hesabından gelir |
| `6.0 m × 6.0 m` | Dikim mesafesi — KPI olarak hard-code yok |
| `23 sıra` | Sıra sayısı — grid hesabından |
| `8.2 ton` | Tahmini verim — simülasyon çıktısı, etiketli |
| `24. Ay` | İlk hasat — simülasyon modelinden |
| `125 m`, `188 m` | Ölçüler — gerçek polygon'dan |
| `Limon (Meyer)`, `Carrizo` | Ürün/çeşit/anaç — domain'den gelir, hard-code değil |
| `Şubat-Mart`, `3 günde 1` | Agronomik bilgi — kaynak yoksa `no_data` |

Detay: [anti-fabrication.md](../development/anti-fabrication.md)

---

## Görseldeki Aktif Adım

Mockup **3. PLANLAMA** adımında gösterilmiş:

- Üst stepper: 1–2 tamamlanmış, 3 aktif, 4–5 bekliyor
- Sol sidebar: Dikim Planı aktif, altında Dikim Mesafesi / Sulama / Besleme
- Orta: 3D harita, polygon, grid overlay, spacing tooltip
- Sağ: Seçilen ürün, dikim özet, bakım özet
- Alt: KPI bar + gelişim simülasyonu timeline

---

## İlgili Dokümanlar

- [Ekran spec](./frontend/phase-1-b-screen-spec.md) — Layout grid ve component eşleşmesi
- [Design tokens](./frontend/design-tokens.md) — Renk ve tipografi
- [Component map](./frontend/component-map.md) — Bileşen hiyerarşisi
- [plan.md](./plan.md) — Implementasyon aşamaları

---

## Agent Notu

UI implementasyonu yapmadan önce bu görsele bak. Pixel-perfect kopya şart değil; **UX / visual direction** olarak kullan. Sayıları ve agronomik metinleri görselden kopyalama.
