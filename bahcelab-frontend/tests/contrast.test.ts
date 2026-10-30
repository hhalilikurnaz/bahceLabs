import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** WCAG 2.x göreli parlaklık ve kontrast oranı; renk token'ları `src/styles/tokens.css`'ten okunur. */
const css = readFileSync('src/styles/tokens.css', 'utf8')

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector)
  if (start < 0) throw new Error(`${selector} bulunamadı`)
  const open = css.indexOf('{', start)
  const close = css.indexOf('\n}', open)
  const tokens: Record<string, string> = {}
  for (const m of css.slice(open, close).matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) tokens[m[1]] = m[2]
  return tokens
}

const light = block('@theme')
const dark = { ...light, ...block('.surface-dark {') }
const koyuTema = { ...light, ...block("html[data-theme='dark'] .app-shell {") }

const channel = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** [ön plan, arka plan, en az oran, açıklama] — metin 4,5; büyük metin/arayüz öğesi 3 */
const PAIRS: [string, string, number, string][] = [
  ['app-text', 'app-panel', 4.5, 'Ana metin / panel'],
  ['app-text', 'app-card', 4.5, 'Ana metin / kart'],
  ['app-text', 'app-canvas', 4.5, 'Ana metin / panel zemini'],
  ['app-text-muted', 'app-canvas', 4.5, 'İkincil metin / panel zemini'],
  ['app-text-dim', 'app-canvas', 4.5, 'Soluk metin / panel zemini'],
  ['app-primary', 'app-card', 4.5, 'Birincil eylem rengi / kart (metin olarak)'],
  ['app-text-muted', 'app-panel', 4.5, 'İkincil metin / panel'],
  ['app-text-muted', 'app-card', 4.5, 'İkincil metin / kart'],
  ['app-text-dim', 'app-panel', 4.5, 'Soluk metin ve placeholder / panel'],
  ['app-text-dim', 'app-card', 4.5, 'Soluk metin / kart'],
  ['app-accent', 'app-panel', 4.5, 'Vurgu (bağlantı) / panel'],
  ['app-accent-strong', 'app-panel', 4.5, 'Seçili sekme metni / panel'],
  ['app-danger', 'app-panel', 4.5, 'Hata metni / panel'],
  ['app-warn', 'app-panel', 4.5, 'Uyarı metni / panel'],
  ['app-success', 'app-panel', 4.5, 'Başarı metni / panel'],
  ['app-on-primary', 'app-primary', 4.5, 'Birincil düğme metni'],
  ['app-border-strong', 'app-panel', 3, 'Kontrol kenarlığı / panel (arayüz öğesi)'],
  ['app-border-strong', 'app-card', 3, 'Kontrol kenarlığı / kart (arayüz öğesi)'],
]

describe('renk kontrastı (WCAG AA)', () => {
  for (const [name, tokens] of [['açık tema', light], ['koyu yüzey (harita denetimleri)', dark], ['koyu tema', koyuTema]] as const) {
    describe(name, () => {
      for (const [fg, bg, min, label] of PAIRS) {
        if (!tokens[fg] || !tokens[bg]) continue
        const ratio = contrast(tokens[fg], tokens[bg])
        it(`${label}: ${ratio.toFixed(2)}:1 ≥ ${min}`, () => {
          expect(ratio).toBeGreaterThanOrEqual(min)
        })
      }
    })
  }

  it('hesaplama doğru: siyah/beyaz 21:1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0)
  })
})
