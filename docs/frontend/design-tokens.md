# Design Tokens — Planning & Simulation

Referans görselden çıkarılan token'lar. `src/index.css` içinde `@theme` olarak tanımlı.

## Renkler

| Token | CSS Variable | Hex | Kullanım |
|-------|-------------|-----|----------|
| Background | `--color-planning-bg` | `#0a0f0a` | Ana arka plan |
| Surface | `--color-planning-surface` | `#141a14` | Kart arka planı |
| Panel | `--color-planning-panel` | `#1a221a` | Sidebar, panel |
| Border | `--color-planning-border` | `#2a3a2a` | Kenarlıklar |
| Accent | `--color-planning-accent` | `#a3e635` | CTA, active, progress |
| Accent Muted | `--color-planning-accent-muted` | `#65a30d` | Hover, secondary accent |
| Text | `--color-planning-text` | `#f5f5f5` | Ana metin |
| Text Muted | `--color-planning-text-muted` | `#9ca3af` | İkincil metin |
| Text Dim | `--color-planning-text-dim` | `#6b7280` | Label, caption |
| Success | `--color-planning-success` | `#4ade80` | Tamamlanan adım |
| Warning | `--color-planning-warning` | `#fbbf24` | Uyarı |
| Error | `--color-planning-error` | `#f87171` | Hata |

## Tailwind Kullanımı

```html
<div class="bg-planning-bg text-planning-text border-planning-border">
  <button class="bg-planning-accent text-planning-bg">CTA</button>
  <span class="text-planning-text-muted">Label</span>
</div>
```

## Tipografi

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Page title | 14px | semibold | text |
| Section label | 10px | semibold uppercase | text-dim |
| Body | 14px | normal | text-muted |
| KPI value | 18px | semibold | text |
| KPI label | 10px | normal | text-dim |
| Button | 12px | semibold | accent-bg / text |

Font: Inter, system-ui fallback

## Spacing & Radius

| Element | Value |
|---------|-------|
| Border radius (card) | 12px (`rounded-xl`) |
| Border radius (button) | 8px (`rounded-lg`) |
| Panel padding | 16px (`p-4`) |
| Section gap | 16px (`gap-4`) |
| Sidebar width | 224px (`w-56`) |
| Context panel width | 288px (`w-72`) |

## Green Accent Kullanım Kuralları

Green accent **sadece** şunlar için:
- Active step / selected tool
- CTA butonları
- Progress indicators
- Selected planting point
- Important metrics highlight

Her şeyi green yapma — okunabilirlik öncelikli.

## Dark Agricultural Premium Aesthetic

- Deep charcoal/black background
- Subtle green-tinted panels
- Restrained shadows
- Dense information architecture
- Glass/dark card surfaces with subtle borders
