import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ARCHIVE,
  archivePath,
  buildArchiveSearch,
  groupByMonth,
  neighborDates,
  parseArchiveSearch,
  resolveDate,
  stepDate,
} from '@/features/bahcem/lib/archive'
import { parseBahcemPath } from '@/features/bahcem/hooks/useBahcemRoute'

const DATES = ['2026-03-02', '2026-03-12', '2026-04-01', '2026-05-10']

describe('arşiv adresi', () => {
  it('geçersiz değerler varsayılana düşer', () => {
    const state = parseArchiveSearch(new URLSearchParams('parametre=xyz&tarih=dün&mod=foo&sezon=abc&net=1'))
    expect(state).toEqual(DEFAULT_ARCHIVE)
  })

  it('durum adrese yazılıp geri okunur', () => {
    const state = { ...DEFAULT_ARCHIVE, parametre: 'ndmi' as const, tarih: '2026-04-01', mod: 'karsilastir' as const, b: '2026-03-02', stil: 'yan' as const, sezon: 2026, net: false }
    expect(parseArchiveSearch(new URLSearchParams(buildArchiveSearch(state)))).toEqual(state)
  })

  it('varsayılanlar adrese yazılmaz, B yalnızca karşılaştırma/değişimde yazılır', () => {
    expect(buildArchiveSearch({ ...DEFAULT_ARCHIVE, b: '2026-03-02' })).toBe('parametre=ndvi')
    expect(buildArchiveSearch({ ...DEFAULT_ARCHIVE, mod: 'degisim', b: '2026-03-02' })).toContain('b=2026-03-02')
  })

  it('arşiv yolu parametre ve tarihi taşır', () => {
    expect(archivePath('g1', { parametre: 'ndvi', tarih: '2026-05-10' })).toBe('/bahcem/g1/arsiv?parametre=ndvi&tarih=2026-05-10')
  })

  it('rota arşiv sayfasını tanır', () => {
    expect(parseBahcemPath('/bahcem/g1/arsiv').archive).toBe(true)
    expect(parseBahcemPath('/bahcem/g1/durum').archive).toBe(false)
  })
})

describe('tarih gezinmesi', () => {
  it('seçili tarih listede yoksa en yakına, tarih yoksa en yeniye düşer', () => {
    expect(resolveDate('2026-03-13', DATES)).toBe('2026-03-12')
    expect(resolveDate(null, DATES)).toBe('2026-05-10')
    expect(resolveDate('2026-03-12', DATES)).toBe('2026-03-12')
    expect(resolveDate('2026-03-12', [])).toBeNull()
  })

  it('ok tuşu uçlarda taşmaz', () => {
    expect(stepDate('2026-03-02', DATES, -1)).toBe('2026-03-02')
    expect(stepDate('2026-05-10', DATES, 1)).toBe('2026-05-10')
    expect(stepDate('2026-03-12', DATES, 1)).toBe('2026-04-01')
    expect(stepDate(null, DATES, -1)).toBe('2026-05-10')
  })

  it('komşular yakından uzağa sıralanır', () => {
    expect(neighborDates('2026-03-12', DATES, 1)).toEqual(['2026-04-01', '2026-03-02'])
    expect(neighborDates('2026-03-02', DATES, 2)).toEqual(['2026-03-12', '2026-04-01'])
    expect(neighborDates(null, DATES, 2)).toEqual([])
  })

  it('ay gruplaması yeni ayı üstte tutar', () => {
    const groups = groupByMonth(DATES.map((tarih) => ({ tarih })))
    expect(groups.map((g) => g.ay)).toEqual(['2026-05', '2026-04', '2026-03'])
    expect(groups[2].items.map((i) => i.tarih)).toEqual(['2026-03-12', '2026-03-02'])
  })
})
