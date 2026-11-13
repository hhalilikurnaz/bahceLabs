import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** «Bugün» UTC gününden değil Europe/Istanbul gününden alınır (lib/dates.todayIstanbul): 00:00–03:00 arasında UTC günü bir geride kalır (9J Dilim 2 e2e bulgusu). */
function dosyalar(dizin: string): string[] {
  return readdirSync(dizin).flatMap((ad) => {
    const yol = join(dizin, ad)
    return statSync(yol).isDirectory() ? dosyalar(yol) : /\.(ts|tsx)$/.test(ad) && !/\.test\./.test(ad) ? [yol] : []
  })
}

describe('bugün tek yerden', () => {
  it('src içinde new Date().toISOString().slice(0, 10) ile «bugün» alınmaz', () => {
    const ihlal = dosyalar('src').filter((f) => /new Date\(\)\.toISOString\(\)\.(slice|split|substring)\(/.test(readFileSync(f, 'utf8')))
    expect(ihlal, 'todayIstanbul() kullanın').toEqual([])
  })
})
