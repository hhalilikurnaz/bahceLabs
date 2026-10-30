import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const KOK = join(import.meta.dirname, '..', 'src')
function dosyalar(dir: string, out: string[] = []): string[] {
  for (const ad of readdirSync(dir)) {
    const p = join(dir, ad)
    if (statSync(p).isDirectory()) dosyalar(p, out)
    else if (/\.(tsx?|css)$/.test(ad)) out.push(p)
  }
  return out
}
const UYGULAMA = [...dosyalar(join(KOK, 'features/bahcem')), ...dosyalar(join(KOK, 'components'))]
/** Ham renk değeri izinli yerler: veri rampaları ve harita/canvas motoru (CSS değişkeni okuyamayan yüzeyler). */
const IZINLI = ['lib/paletler.ts', 'lib/indices.ts', 'lib/izgara.ts', 'lib/kademe.ts', 'map/haritaRenkleri.ts']

describe('tek token dosyası kuralları (ilke 5, 9)', () => {
  it('bileşenlerde ham hex yok (veri rampaları ve harita renk dosyaları hariç)', () => {
    const ihlal: string[] = []
    for (const p of UYGULAMA) {
      if (IZINLI.some((i) => p.endsWith(i))) continue
      const metin = readFileSync(p, 'utf8').replace(/url\(#|href="#|id="#?[\w-]+"/g, '')
      for (const m of metin.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
        if (/^#[a-zA-Z-]+$/.test(m[0]) && !/[0-9]/.test(m[0])) continue
        ihlal.push(`${p.replace(KOK, 'src')}: ${m[0]}`)
      }
    }
    expect(ihlal).toEqual([])
  })
  it('yazı 12 px altında değil: Tailwind keyfi boyut ve SVG fontSize; yarım piksel yok', () => {
    const ihlal: string[] = []
    for (const p of UYGULAMA) {
      const metin = readFileSync(p, 'utf8')
      for (const m of metin.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) if (Number(m[1]) < 12 || !Number.isInteger(Number(m[1]))) ihlal.push(`${p.replace(KOK, 'src')}: ${m[0]}`)
      for (const m of metin.matchAll(/fontSize=\{(\d+(?:\.\d+)?)\}/g)) if (Number(m[1]) < 12 || !Number.isInteger(Number(m[1]))) ihlal.push(`${p.replace(KOK, 'src')}: ${m[0]}`)
    }
    expect(ihlal).toEqual([])
  })
  it('büyük harfli harf aralıklı etiket yok (ilke 2)', () => {
    const ihlal = UYGULAMA.filter((p) => p.endsWith('.tsx') && /\buppercase\b|tracking-\[/.test(readFileSync(p, 'utf8'))).map((p) => p.replace(KOK, 'src'))
    expect(ihlal).toEqual([])
  })
  it('ölü planlama paleti ve eski yazı aileleri token dosyasında yok', () => {
    const t = readFileSync(join(KOK, 'styles/tokens.css'), 'utf8') + readFileSync(join(KOK, 'index.css'), 'utf8')
    expect(t).not.toMatch(/planning-|Manrope|Newsreader|IBM Plex|fonts\.googleapis/)
  })
  it('köşe 6 px, kart gölgesi yok', () => {
    const t = readFileSync(join(KOK, 'styles/tokens.css'), 'utf8')
    expect(t).toMatch(/--radius-md: 6px/)
    expect(t).toMatch(/--shadow-e1: none/)
  })
})
