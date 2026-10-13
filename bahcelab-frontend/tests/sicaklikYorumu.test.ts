import { describe, expect, it } from 'vitest'
import type { SicaklikNoktasi } from '../src/features/bahcem/api/suApi'
import { isaretli, sicaklikCumlesi } from '../src/features/bahcem/lib/sicaklikYorumu'

const temel: SicaklikNoktasi = {
  tarih: '2026-09-25', ay: 'Eylül', yuzey_bahce_c: 36.2, yuzey_tampon_c: 35.7, hava_c: 24.2, fark_c: 12, normal: { alt_c: 7.8, ortanca_c: 8.8, ust_c: 10.4, sahne: 57 },
  sapma_c: 3.2, durum: 'ustunde', stres: true, karisik_piksel: false, bahce_tampon_fark_c: 0.5,
}

describe('yüzey–hava sıcaklığı yorumu', () => {
  it('aynı ay normaline göre sıcak/serin der; stres yalnız bandın üstünde', () => {
    expect(sicaklikCumlesi(temel)).toBe('Eylül normaline göre +3,2 °C sıcak (normal bandın üstünde: ısı stresi olabilir).')
    expect(sicaklikCumlesi({ ...temel, sapma_c: -1.3, durum: 'altinda', stres: false })).toBe('Eylül normaline göre −1,3 °C serin.')
    expect(sicaklikCumlesi({ ...temel, sapma_c: 0.6, durum: 'icinde', stres: false })).toBe('Eylül normali içinde (+0,6 °C).')
  })
  it('karışık pikselde stres denmez; geçmiş yetersizse ve hava yoksa yargı verilmez', () => {
    expect(sicaklikCumlesi({ ...temel, karisik_piksel: true, stres: false })).toContain('stres denmez')
    expect(sicaklikCumlesi({ ...temel, normal: null, sapma_c: null, durum: 'yetersiz_gecmis', stres: null })).toContain('yeterli Landsat geçmişi yok')
    expect(sicaklikCumlesi({ ...temel, fark_c: null, hava_c: null, sapma_c: null, normal: null, durum: 'bilinmiyor', stres: null })).toContain('hesaplanamadı')
  })
  it('işaretli sayı Türkçe ondalık ve gerçek eksi kullanır', () => {
    expect(isaretli(3.24)).toBe('+3,2')
    expect(isaretli(-0.5)).toBe('−0,5')
    expect(isaretli(0)).toBe('0,0')
  })
})
