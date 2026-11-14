import { describe, expect, it } from 'vitest'
import { bugunBahce, todayIstanbul } from '../src/features/bahcem/lib/dates'

describe('bugunBahce', () => {
  const an = new Date('2026-10-14T21:30:00Z') // İstanbul 15 Eki 00:30; UTC günü 14 Eki
  it('saat dilimi yoksa Europe/Istanbul günü (UTC günü değil)', () => {
    expect(bugunBahce(undefined, an)).toBe('2026-10-15')
    expect(bugunBahce({}, an)).toBe('2026-10-15')
    expect(todayIstanbul(an)).toBe('2026-10-15')
  })
  it('bahçenin saat dilimini kullanır', () => {
    expect(bugunBahce({ zamanDilimi: 'Etc/GMT+5' }, an)).toBe('2026-10-14') // UTC−5: 14 Eki 16:30
    expect(bugunBahce({ zamanDilimi: 'Europe/Istanbul' }, an)).toBe('2026-10-15')
  })
})
