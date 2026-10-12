import { describe, expect, it } from 'vitest'
import { degisim, dekar, gunAy, mm, sayi, sicaklik, yuzde } from '@/features/bahcem/lib/format'
import { gardenPath, legacyRedirect } from '@/features/bahcem/lib/routes'

describe('Türkçe biçimlendirme', () => {
  it('sayı, yüzde, birimler', () => {
    expect(sayi(0.4312)).toBe('0,43')
    expect(sayi(null)).toBe('—')
    expect(yuzde(72)).toBe('%72')
    expect(degisim(-4.62)).toBe('−%4,6')
    expect(degisim(8.5)).toBe('+%8,5')
    expect(degisim(0)).toBe('±%0,0')
    expect(sicaklik(31.4)).toBe('31,4 °C')
    expect(mm(12.84)).toBe('12,8 mm')
    expect(dekar(15.149)).toBe('15,1 da')
  })
  it('tarih: aynı yılda yıl yazılmaz', () => {
    const now = new Date('2026-10-12T10:00:00')
    expect(gunAy('2026-10-12', 'auto', now)).toBe('12 Eki')
    expect(gunAy('2025-10-12', 'auto', now)).toBe('12 Eki 2025')
    expect(gunAy('2026-01-03', 'always', now)).toBe('3 Oca 2026')
  })
})

describe('rotalar', () => {
  it('bahçe yolları', () => {
    expect(gardenPath('g1')).toBe('/bahceler/g1')
    expect(gardenPath('g1', 'su')).toBe('/bahceler/g1/su')
  })
  it('eski /bahcem adresleri yönlenir', () => {
    expect(legacyRedirect('/bahcem')).toBe('/bahceler')
    expect(legacyRedirect('/bahcem/g1/durum')).toBe('/bahceler/g1')
    expect(legacyRedirect('/bahcem/g1/hava')).toBe('/bahceler/g1/hava')
    expect(legacyRedirect('/bahcem/g1/arsiv', '?tarih=2026-01-01')).toBe('/bahceler/g1/gecmis?tarih=2026-01-01')
    expect(legacyRedirect('/bahcem/g1/bilinmeyen')).toBe('/bahceler/g1')
    expect(legacyRedirect('/bahcem/islerim')).toBe('/islerim')
    expect(legacyRedirect('/bahcem/ayarlar')).toBe('/ayarlar')
  })
})
