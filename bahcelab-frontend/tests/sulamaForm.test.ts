import { describe, expect, it } from 'vitest'
import { sayiOku, sihirbazBaslangici, sihirbazDogrula, sihirbazGovdesi } from '@/features/bahcem/lib/sulamaForm'

const bos = sihirbazBaslangici(null)

describe('sulama sihirbazı girdileri', () => {
  it('virgül ve nokta ondalık; boş = bilinmiyor; harf = geçersiz', () => {
    expect(sayiOku('4,5')).toBe(4.5)
    expect(sayiOku('4.5')).toBe(4.5)
    expect(sayiOku('  ')).toBeNull()
    expect(sayiOku('abc')).toBeNaN()
  })
  it('doğrulama: negatif, sıfır debi, damlatıcı adedi', () => {
    const e = sihirbazDogrula({ ...bos, damlaticiDebi: '0', siraAralik: '-3', damlaticiSayisi: '2,5', pompaKw: 'x' })
    expect(e.damlaticiDebi).toBeTruthy()
    expect(e.siraAralik).toBeTruthy()
    expect(e.damlaticiSayisi).toBeTruthy()
    expect(e.pompaKw).toBe('Sayı girin.')
    expect(sihirbazDogrula(bos)).toEqual({})
  })
  it('«pompayı bilmiyorum» pompa alanlarını boşaltır (kWh/TL uydurulmaz)', () => {
    const g = sihirbazGovdesi({ ...bos, pompaBilinmiyor: true, pompaKw: '7,5', pompaDebi: '40' })
    expect(g.pompa_kw).toBeNull()
    expect(g.pompa_debi_m3h).toBeNull()
  })
  it('damla dışı sistemde damlatıcı alanları gönderilmez; şebeke dışı enerjide kWh fiyatı gönderilmez', () => {
    const g = sihirbazGovdesi({ ...bos, sistem: 'salma', damlaticiSayisi: '4', damlaticiDebi: '4', enerji: 'dizel', kwhFiyat: '2', m3Maliyet: '3,5' })
    expect(g.damlatici_sayisi).toBeNull()
    expect(g.kwh_fiyat_tl).toBeNull()
    expect(g.enerji_m3_maliyet_tl).toBe(3.5)
  })
  it('profil → form → profil gidiş dönüş', () => {
    const p = { sistem: 'damla' as const, damlatici_sayisi: 4, damlatici_debi_lh: 4, sira_aralik_m: 6, agac_aralik_m: 4.5, pompa_kw: 7.5, pompa_debi_m3h: 40, enerji: 'sebeke' as const, kwh_fiyat_tl: 2.5, enerji_m3_maliyet_tl: null, su_ucreti_m3_tl: null }
    expect(sihirbazGovdesi(sihirbazBaslangici(p))).toEqual(p)
  })
})
