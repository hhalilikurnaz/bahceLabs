import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * İç yol haritası metni («Adım 11», «Faz 1.5», «Dilim 2» …) kullanıcıya gösterilen metne SIZMAZ: src altındaki tüm dize/şablon/JSX metinleri (yorumlar hariç) taranır.
 * İç kalite ekranı (src/features/ic) iç ekibe özgüdür ve kapsam dışıdır. ADR numarası künyedir, serbesttir.
 */
const KOK = join(__dirname, '..', 'src')
const DESEN = /\b(Adım|ADIM|Faz|Dilim)\s*\d/i  // «yol haritası» sözcüğü tek başına sızıntı değildir (pazarlama metninde meşru); numaralı adım/faz/dilim iç plandır

function dosyalar(dir: string): string[] {
  return readdirSync(dir).flatMap((ad) => {
    const yol = join(dir, ad)
    if (statSync(yol).isDirectory()) return ad === 'ic' && dir.endsWith('features') ? [] : dosyalar(yol)
    return /\.(ts|tsx)$/.test(ad) ? [yol] : []
  })
}

function metinler(yol: string): { satir: number; metin: string }[] {
  const kaynak = readFileSync(yol, 'utf8')
  const sf = ts.createSourceFile(yol, kaynak, ts.ScriptTarget.Latest, true, yol.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const out: { satir: number; metin: string }[] = []
  const gez = (n: ts.Node): void => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) || ts.isJsxText(n)) {
      out.push({ satir: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1, metin: ts.isJsxText(n) ? n.text : n.text })
    }
    ts.forEachChild(n, gez)
  }
  gez(sf)
  return out
}

describe('iç yol haritası metni arayüze sızmaz', () => {
  it('tarayıcı sızıntıyı yakalar (kendi doğrulaması)', () => {
    expect(DESEN.test('Tuzak sayımı Adım 12’de eklenecek')).toBe(true)
    expect(DESEN.test('Faz 1.5')).toBe(true)
    expect(DESEN.test('Dilim 2')).toBe(true)
    expect(DESEN.test('yakında')).toBe(false)
    expect(DESEN.test('adımlar')).toBe(false)
  })

  it('src altındaki dize ve JSX metinlerinde «Adım N / Faz N / Dilim N» yok', () => {
    const bulunan = dosyalar(KOK).flatMap((d) => metinler(d).filter((m) => DESEN.test(m.metin)).map((m) => `${relative(KOK, d)}:${m.satir}: ${m.metin.slice(0, 90)}`))
    expect(bulunan, 'Kullanıcıya gösterilebilecek metinde iç yol haritası ifadesi var').toEqual([])
  })
})
