import { describe, expect, it } from 'vitest'
import { varietyPayload, varietyValueOf } from '@/features/bahcem/lib/variety'

describe('çeşit alanı', () => {
  it('katalog seçimi yalnızca kodu gönderir; metin yok sayılır', () => {
    expect(varietyPayload({ kod: 'lamas', metin: 'eski metin' })).toEqual({ cesitKodu: 'lamas', cesit: null })
  })

  it('«Diğer» serbest metni gönderir; boşsa null', () => {
    expect(varietyPayload({ kod: 'diger', metin: '  Yerel çeşit ' })).toEqual({ cesitKodu: 'diger', cesit: 'Yerel çeşit' })
    expect(varietyPayload({ kod: 'diger', metin: '' })).toEqual({ cesitKodu: 'diger', cesit: null })
  })

  it('seçim yoksa çeşit temizlenir', () => {
    expect(varietyPayload({ kod: '', metin: '' })).toEqual({ cesitKodu: null, cesit: null })
  })

  it('kayıtlı bahçeden form değeri: eski serbest metin «Diğer» sayılır', () => {
    expect(varietyValueOf('meyer', 'Meyer')).toEqual({ kod: 'meyer', metin: '' })
    expect(varietyValueOf('diger', 'Yerel')).toEqual({ kod: 'diger', metin: 'Yerel' })
    expect(varietyValueOf(null, 'Eski kayıt')).toEqual({ kod: 'diger', metin: 'Eski kayıt' })
    expect(varietyValueOf(null, null)).toEqual({ kod: '', metin: '' })
  })
})
