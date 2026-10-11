import { daysBetween, shiftDays, todayIstanbul } from '../bahcem/lib/dates'
import { bestSprayTime } from '../bahcem/lib/spray'
import type { IndexId } from '../bahcem/lib/indices'
import type { Proto } from './data'
import type { BandIn, Pt } from './TimeChart'

export function indexSeries(d: Proto, id: IndexId): Pt[] {
  return d.scenes.flatMap((s) => (s.indeksler[id] ? [{ date: s.tarih, value: s.indeksler[id]!.ortalama }] : []))
}

/** Son iki gözlem arasındaki yüzde değişim (14 gün öncesine en yakın gözleme göre). */
export function change14(series: Pt[]): number | null {
  if (series.length < 2) return null
  const last = series[series.length - 1]
  const target = shiftDays(last.date, -14)
  const base = [...series].reverse().find((p) => p.date <= target) ?? series[0]
  return base.value ? ((last.value - base.value) / Math.abs(base.value)) * 100 : null
}

export function rainWeek(d: Proto): { mm: number; days: { date: string; mm: number }[] } | null {
  const days = d.weather?.gunler.slice(0, 7)
  if (!days?.length) return null
  return { mm: days.reduce((a, g) => a + (g.yagisMm ?? 0), 0), days: days.map((g) => ({ date: g.tarih, mm: g.yagisMm ?? 0 })) }
}

export function bestSpray(d: Proto) {
  if (!d.weather) return null
  return bestSprayTime(d.weather.gunler.map((g) => ({ tarih: g.tarih, uygunSaat: g.ilaclama.uygunSaat, enIyiAralik: g.ilaclama.enIyiAralik })), todayIstanbul())
}

export function seasonRainGdd(d: Proto): { rain: Pt[]; gdd: Pt[]; bands: BandIn[] } {
  const rain: Pt[] = []
  const gdd: Pt[] = []
  for (const series of [d.prevSeries, d.series]) {
    const days = series?.gunler ?? []
    days.forEach((g, i) => {
      rain.push({ date: g.tarih, value: Math.max(0, g.yagisBirikimli - (days[i - 1]?.yagisBirikimli ?? 0)) })
      if (g.gddBirikimli != null) gdd.push({ date: g.tarih, value: g.gddBirikimli })
    })
  }
  const bands = [...(d.prevPhenology?.evreler ?? []), ...(d.phenology?.evreler ?? [])].map((e) => ({ kod: e.kod, ad: e.ad, baslangic: e.baslangic, bitis: e.bitis }))
  return { rain, gdd, bands }
}

/** Skor aralığı: düşük güvende «85–92» biçimi (önizleme kuralı: ±5, 100'ü aşmaz). */
export function scoreRange(d: Proto): string | null {
  const s = d.status
  if (!s || s.skor == null || s.guven.seviye !== 'dusuk') return null
  return `${Math.max(0, s.skor - 5)}–${Math.min(100, s.skor + 3)}`
}

/** Aktif orta/yüksek risk varken skor en çok 90 (düzeltme B2'nin önizlemesi). */
export function cappedScore(d: Proto): number | null {
  const s = d.status?.skor
  if (s == null) return null
  const active = d.risks?.riskler.some((r) => r.veriYeterli && r.seviye !== 'dusuk')
  return active ? Math.min(s, 90) : s
}

export const rangeLast12 = (): { from: string; to: string } => {
  const to = todayIstanbul()
  return { from: shiftDays(to, -365), to }
}
export { daysBetween }
