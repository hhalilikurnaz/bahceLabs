import { describe, expect, it } from 'vitest'
import { areaProblem, parseOptionalInt, validateGardenFields } from '@/features/bahcem/lib/gardenFields'

const ok = { ad: 'Dere', cesit: '', dikimYili: '', agacSayisi: '' }

describe('bahçe alanı doğrulama', () => {
  it('boş isteğe bağlı alanlar geçerlidir', () => {
    expect(validateGardenFields(ok, 2026)).toEqual({})
  })

  it('ad zorunlu; yalnızca boşluk da boş sayılır', () => {
    expect(validateGardenFields({ ...ok, ad: '   ' }, 2026).ad).toContain('boş olamaz')
    expect(validateGardenFields({ ...ok, ad: '   ' }, 2026, false).ad).toBeUndefined()
  })

  it('dikim yılı aralığı sınırlarda doğru', () => {
    expect(validateGardenFields({ ...ok, dikimYili: '1900' }, 2026).dikimYili).toBeUndefined()
    expect(validateGardenFields({ ...ok, dikimYili: '2027' }, 2026).dikimYili).toBeUndefined()
    expect(validateGardenFields({ ...ok, dikimYili: '1899' }, 2026).dikimYili).toContain('1900 ile 2027')
    expect(validateGardenFields({ ...ok, dikimYili: '2028' }, 2026).dikimYili).toBeDefined()
  })

  it('ağaç sayısı 1–1.000.000; sayı olmayan değer reddedilir', () => {
    expect(validateGardenFields({ ...ok, agacSayisi: '640' }, 2026).agacSayisi).toBeUndefined()
    expect(validateGardenFields({ ...ok, agacSayisi: '0' }, 2026).agacSayisi).toContain('1.000.000')
    expect(validateGardenFields({ ...ok, agacSayisi: '1000001' }, 2026).agacSayisi).toBeDefined()
    expect(validateGardenFields({ ...ok, agacSayisi: '12a' }, 2026).agacSayisi).toBeDefined()
  })

  it('parseOptionalInt', () => {
    expect(parseOptionalInt('')).toBeNull()
    expect(parseOptionalInt(' 42 ')).toBe(42)
    expect(parseOptionalInt('-3')).toBeNaN()
  })

  it('alan ön denetimi 0,5 dekar altını anlaşılır dille bildirir', () => {
    expect(areaProblem(0.3)).toBe('Alan 0,5 dekardan küçük olamaz; çizdiğiniz alan 0,3 dekar.')
    expect(areaProblem(0.5)).toBeNull()
    expect(areaProblem(null)).toBeNull()
  })
})
