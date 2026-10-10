import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  dayOfYear,
  daysBetween,
  daysInYear,
  formatDate,
  formatDayMonth,
  nearestDate,
  parseIso,
  shiftDays,
  timeAgo,
  yearOf,
} from '@/features/bahcem/lib/dates'

afterEach(() => vi.unstubAllEnvs())

describe('tarih biçimlendirme (tek kaynak)', () => {
  it('gün/ay/yıl doğrudan metinden okunur', () => {
    expect(formatDayMonth('2026-09-14')).toBe('14 Eyl')
    expect(formatDate('2026-09-14')).toBe('14 Eyl 2026')
    expect(formatDate('2025-09-14')).toBe('14 Eyl 2025')
    expect(formatDate('2026-01-01')).toBe('1 Oca 2026')
    expect(formatDate('2025-12-31')).toBe('31 Ara 2025')
  })

  it('aynı gün/ay farklı yılda farklı gösterilir (13 aylık serilerde belirsizlik olmasın)', () => {
    expect(formatDate('2025-09-14')).not.toBe(formatDate('2026-09-14'))
    expect(yearOf('2025-09-14')).toBe(2025)
    expect(yearOf('2026-09-14')).toBe(2026)
  })

  it.each(['Pacific/Honolulu', 'Europe/Istanbul', 'Pacific/Kiritimati', 'America/Los_Angeles'])(
    'saat dilimi (%s) gün veya yılı kaydırmaz',
    (tz) => {
      vi.stubEnv('TZ', tz)
      process.env.TZ = tz
      expect(formatDate('2026-01-01')).toBe('1 Oca 2026')
      expect(formatDate('2025-12-31')).toBe('31 Ara 2025')
      expect(shiftDays('2026-03-01', -1)).toBe('2026-02-28')
      expect(dayOfYear('2026-12-31')).toBe(365)
    },
  )

  it('geçersiz tarihi sessizce yanlış göstermek yerine hata verir', () => {
    expect(() => parseIso('14/09/2026')).toThrow()
    expect(() => formatDate('2026-9-4')).toThrow()
  })
})

describe('gün aritmetiği', () => {
  it('shiftDays ay ve yıl sınırlarını geçer', () => {
    expect(shiftDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDays('2024-03-01', -1)).toBe('2024-02-29')
    expect(shiftDays('2025-12-31', 1)).toBe('2026-01-01')
    expect(shiftDays('2026-10-10', -365)).toBe('2025-10-10')
  })

  it('daysBetween ve yıl uzunluğu', () => {
    expect(daysBetween('2026-10-01', '2026-10-15')).toBe(14)
    expect(daysBetween('2026-10-15', '2026-10-01')).toBe(-14)
    expect(daysInYear(2024)).toBe(366)
    expect(daysInYear(2026)).toBe(365)
    expect(dayOfYear('2024-12-31')).toBe(366)
  })

  it('nearestDate en yakını seçer, uzaksa null', () => {
    const dates = ['2025-09-10', '2025-10-04', '2026-09-28']
    expect(nearestDate('2025-10-01', dates, 7)).toBe('2025-10-04')
    expect(nearestDate('2025-06-01', dates, 7)).toBeNull()
    expect(nearestDate('2026-10-01', dates, 15)).toBe('2026-09-28')
  })
})

describe('göreli süre', () => {
  it('Türkçe ifadeler', () => {
    const now = new Date('2026-10-10T12:00:00Z').getTime()
    expect(timeAgo(null, now)).toBeNull()
    expect(timeAgo('2026-10-10T11:59:40Z', now)).toBe('az önce')
    expect(timeAgo('2026-10-10T11:15:00Z', now)).toBe('45 dk önce')
    expect(timeAgo('2026-10-10T09:00:00Z', now)).toBe('3 saat önce')
    expect(timeAgo('2026-10-07T12:00:00Z', now)).toBe('3 gün önce')
  })
})
