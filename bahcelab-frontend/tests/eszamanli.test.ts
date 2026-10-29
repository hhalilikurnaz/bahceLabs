import { describe, expect, it } from 'vitest'
import { eszamanliSinir } from '@/features/bahcem/lib/eszamanli'

describe('eşzamanlı sınırlayıcı', () => {
  it('en çok n işi aynı anda çalıştırır, hepsini sırayla bitirir ve hatayı iletir', async () => {
    const sinir = eszamanliSinir(2)
    let calisan = 0
    let enCok = 0
    const is = (v: number) => () =>
      new Promise<number>((coz) => {
        calisan += 1
        enCok = Math.max(enCok, calisan)
        setTimeout(() => ((calisan -= 1), coz(v)), 5)
      })
    expect(await Promise.all([1, 2, 3, 4, 5].map((v) => sinir(is(v))))).toEqual([1, 2, 3, 4, 5])
    expect(enCok).toBe(2)
    await expect(sinir(() => Promise.reject(new Error('x')))).rejects.toThrow('x')
    expect(await sinir(is(9))).toBe(9) // hata sırayı kilitlemez
  })
})
