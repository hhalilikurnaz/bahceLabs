import { describe, expect, it } from 'vitest'
import type { Olay } from '@/features/bahcem/api/olayApi'
import { birlesikMi, suz, turAnahtarlari, yilaGore, zamanOrani } from '@/features/bahcem/lib/gecmis'

const olay = (id: string, tur: string, baslangic: string, guven: Olay['guven'] = 'orta', turler: string[] = [tur]): Olay => ({
  id, tur, tur_adi: tur, turler, baslangic, bitis: baslangic, alan_da: null, guven, siddet: null, katman: null, tahmin: false, kaynak_sayisi: 1, durum: 'olay', neden: null,
})

describe('geçmiş olay yardımcıları', () => {
  const liste = [
    olay('a', 'don', '2016-01-25', 'yuksek', ['don', 's2_dusus']),
    olay('b', 'asiri_yagis', '2019-11-02', 'orta'),
    olay('c', 'ruzgar', '2019-12-10', 'dusuk'),
    olay('d', 'radar_degisim', '2022-03-20', 'orta'),
  ]
  it('birleşen olay TEK satırdır ama hem Don hem Optik düşüş süzgecinde bulunur', () => {
    expect(birlesikMi(liste[0])).toBe(true)
    expect(turAnahtarlari(liste[0]).sort()).toEqual(['don', 'optik'])
    expect(suz(liste, new Set(['optik']), new Set()).map((o) => o.id)).toEqual(['a'])
    expect(suz(liste, new Set(['don']), new Set()).map((o) => o.id)).toEqual(['a'])
  })
  it('tür, güven ve yıl süzgeçleri birlikte çalışır; boş küme süzmez', () => {
    expect(suz(liste, new Set(), new Set()).length).toBe(4)
    expect(suz(liste, new Set(), new Set(['orta'])).map((o) => o.id)).toEqual(['b', 'd'])
    expect(suz(liste, new Set(), new Set(), 2019).map((o) => o.id)).toEqual(['b', 'c'])
    expect(suz(liste, new Set(['ruzgar']), new Set(['yuksek'])).length).toBe(0)
  })
  it('yıla göre yeniden eskiye gruplar', () => {
    expect(yilaGore(liste).map((g) => [g.yil, g.olaylar.map((o) => o.id)])).toEqual([[2022, ['d']], [2019, ['c', 'b']], [2016, ['a']]])
  })
  it('zaman oranı aralık uçlarında 0 ve 1', () => {
    expect(zamanOrani('2015-01-01', 2015, 2026)).toBe(0)
    expect(zamanOrani('2026-12-31', 2015, 2026)).toBeGreaterThan(0.99)
    expect(zamanOrani('2000-01-01', 2015, 2026)).toBe(0)
  })
})
