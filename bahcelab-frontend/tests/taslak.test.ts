import { describe, expect, it } from 'vitest'
import { taslakAnahtari, taslakOku, taslakSil, taslakYaz, type Taslak } from '@/features/bahcem/lib/taslak'

const depo = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }
}
const T: Taslak = { tur: 'gozlem', kategori: 'zararli', etiket: 'thrips', siddet: 'az', yayginlik: 'tek_agac', sektor: '', not: 'Yaprak ucu kıvrık', sure: '', m3: '', mm: '', konumMod: 'nokta', nokta: [27.9, 38.9], dogruluk: 8 }

describe('saha kaydı taslağı', () => {
  it('yazılan taslak aynen okunur; bahçeye göre ayrılır', () => {
    const d = depo()
    taslakYaz(d, 'g1', T)
    expect(taslakOku(d, 'g1')).toEqual(T)
    expect(taslakOku(d, 'g2')).toBeNull()
    expect(taslakAnahtari('g1')).not.toBe(taslakAnahtari('g2'))
  })
  it('boş form taslağı siler; silme ve bozuk içerik güvenli', () => {
    const d = depo()
    taslakYaz(d, 'g1', T)
    taslakYaz(d, 'g1', { ...T, not: '', etiket: '', siddet: '', yayginlik: '', konumMod: 'yok', nokta: null, dogruluk: null })
    expect(d.m.size).toBe(0)
    taslakYaz(d, 'g1', T)
    taslakSil(d, 'g1')
    expect(taslakOku(d, 'g1')).toBeNull()
    d.setItem(taslakAnahtari('g1'), '{bozuk')
    expect(taslakOku(d, 'g1')).toBeNull()
  })
  it('depo hata verirse (dolu/kapalı) uygulama düşmez', () => {
    const kotu = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') }, removeItem: () => { throw new Error('x') } }
    expect(() => taslakYaz(kotu, 'g1', T)).not.toThrow()
    expect(taslakOku(kotu, 'g1')).toBeNull()
    expect(() => taslakSil(kotu, 'g1')).not.toThrow()
  })
})
