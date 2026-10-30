import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(import.meta.dirname, '..', 'src/styles/tokens.css'), 'utf8')
const lin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
const L = ([r, g, b]: number[]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
const kontrast = (a: number[], b: number[]) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const karis = (on: number[], alfa: number, arka: number[]) => on.map((c, i) => c * alfa + arka[i] * (1 - alfa))

/** Cam yüzeyin arkası: en koyu raster tonu, siyah uydu gölgesi ve en açık zemin (beyaz). Metin her durumda AA (≥ 4,5). */
const ARKALAR: Record<string, number[]> = { siyah: [0, 0, 0], koyuYesil: hex('#1e5235'), radarKoyu: hex('#26323d'), orta: [90, 120, 80], beyaz: [255, 255, 255] }

function blok(ad: string): string {
  const i = css.indexOf(ad)
  return css.slice(i, css.indexOf('}', i))
}
const al = (b: string, k: string) => b.match(new RegExp(`--${k}: ([^;]+);`))![1]
const rgba = (v: string) => { const m = v.match(/rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)/)!; return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], a: Number(m[4]) } }

describe('cam yüzey metin kontrastı (AA, en kötü arka planlarda)', () => {
  it('açık tema: metin ve soluk metin her arka planda ≥ 4,5:1', () => {
    const b = blok('@theme')
    const bg = rgba(al(b, 'glass-bg'))
    const metin = hex(al(b, 'glass-text'))
    const soluk = hex(al(b, 'glass-text-muted'))
    for (const [ad, arka] of Object.entries(ARKALAR)) {
      const zemin = karis(bg.rgb, bg.a, arka)
      expect(kontrast(metin, zemin), `metin/${ad}`).toBeGreaterThanOrEqual(4.5)
      expect(kontrast(soluk, zemin), `soluk/${ad}`).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('koyu tema: aynı ölçüt', () => {
    const b = blok("html[data-theme='dark'] .app-shell")
    const bg = rgba(al(b, 'glass-bg'))
    const metin = hex(al(b, 'glass-text'))
    const soluk = hex(al(b, 'glass-text-muted'))
    for (const [ad, arka] of Object.entries(ARKALAR)) {
      const zemin = karis(bg.rgb, bg.a, arka)
      expect(kontrast(metin, zemin), `metin/${ad}`).toBeGreaterThanOrEqual(4.5)
      expect(kontrast(soluk, zemin), `soluk/${ad}`).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('cam tarifi: blur 20 px, doygunluk 160 %, üst kenar 1 px iç ışık, köşe 10 px; şeffaflık azaltılınca opak yedek', () => {
    expect(css).toMatch(/backdrop-filter: blur\(20px\) saturate\(160%\)/)
    expect(css).toMatch(/inset 0 1px 0 rgb\(255 255 255 \/ 0\.7\)/)
    expect(css).toMatch(/0 8px 24px rgb\(16 24 20 \/ 0\.1\)/)
    expect(css).toMatch(/--radius-glass: 10px/)
    expect(css).toMatch(/@media \(prefers-reduced-transparency: reduce\)[\s\S]*backdrop-filter: none/)
    expect(css).toMatch(/@supports \(\(backdrop-filter/)
  })
})
