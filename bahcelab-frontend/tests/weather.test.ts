import { describe, expect, it } from 'vitest'
import { formatHour, shiftDays, todayIstanbul, weekdayName } from '../src/features/bahcem/lib/dates'
import {
  compareToLastYear,
  formatMm,
  formatPercent,
  formatTemp,
  formatWind,
  whenText,
  windDirection,
} from '../src/features/bahcem/lib/weather'

describe('Türkçe gün adları ve saat', () => {
  it('haftanın gününü metinden hesaplar (saat diliminden bağımsız)', () => {
    expect(weekdayName('2026-10-12')).toBe('Pzt')
    expect(weekdayName('2026-10-10', false)).toBe('Cumartesi')
    expect(weekdayName('2026-10-11', false)).toBe('Pazar')
    expect(weekdayName('2026-01-01', false)).toBe('Perşembe')
  })

  it('saat metnini keser', () => {
    expect(formatHour('2026-10-12T14:00')).toBe('14:00')
  })

  it('bugünü Europe/Istanbul takvimine göre verir', () => {
    // 21:30 UTC = 00:30 ertesi gün (UTC+3)
    expect(todayIstanbul(new Date('2026-10-10T21:30:00Z'))).toBe('2026-10-11')
    expect(todayIstanbul(new Date('2026-10-10T20:59:00Z'))).toBe('2026-10-10')
    expect(shiftDays(todayIstanbul(new Date('2026-03-01T10:00:00Z')), -1)).toBe('2026-02-28')
  })
})

describe('birimler', () => {
  it('sıcaklık, yağış ve rüzgârı Türkçe biçimler', () => {
    expect(formatTemp(24.5)).toBe('25°')
    expect(formatTemp(-1.2)).toBe('-1°')
    expect(formatTemp(null)).toBe('—')
    expect(formatMm(3.24)).toBe('3,2 mm')
    expect(formatMm(0)).toBe('0,0 mm')
    expect(formatWind(16.7)).toBe('17 km/s')
    expect(formatPercent(62)).toBe('%62')
  })

  it('rüzgâr yönünü adlandırır', () => {
    expect(windDirection(0)).toBe('Kuzey')
    expect(windDirection(200)).toBe('Güney')
    expect(windDirection(323)).toBe('Kuzeybatı')
    expect(windDirection(359)).toBe('Kuzey')
    expect(windDirection(null)).toBeNull()
  })
})

describe('geçen yıl karşılaştırması', () => {
  it('yüzde farkı anlatır', () => {
    expect(compareToLastYear(65, 100)).toBe('geçen yıldan %35 az')
    expect(compareToLastYear(150, 100)).toBe('geçen yıldan %50 fazla')
    expect(compareToLastYear(102, 100)).toBe('geçen yılla yaklaşık aynı')
    expect(compareToLastYear(10, 0)).toBe('geçen yıl hiç yağış yoktu')
    expect(compareToLastYear(null, 5)).toBeNull()
  })
})

describe('uyarı zamanı', () => {
  it('bugün / yarın / tarih', () => {
    expect(whenText('2026-10-10T23:00', '2026-10-10')).toBe('Bugün 23:00')
    expect(whenText('2026-10-11T03:00', '2026-10-10')).toBe('Yarın 03:00')
    expect(whenText('2026-10-14T05:00', '2026-10-10')).toBe('14.10 05:00')
  })
})
