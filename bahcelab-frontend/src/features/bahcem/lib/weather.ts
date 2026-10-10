import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudSun,
  Moon,
  Snowflake,
  Sun,
  TrendingDown,
  type LucideIcon,
} from 'lucide-react'
import type { GardenSatelliteAlerts } from '../api/indeksApi'
import type { SprayStatus, WeatherAlert, WeatherSummary } from '../api/weatherApi'
import { INDEX_DEFS } from './indices'

/** Sunucunun ikon anahtarı → ikon bileşeni */
export const WEATHER_ICONS: Record<string, LucideIcon> = {
  gunes: Sun,
  'gunes-bulut': CloudSun,
  ay: Moon,
  'ay-bulut': CloudMoon,
  bulutlu: Cloud,
  sis: CloudFog,
  cise: CloudDrizzle,
  yagmur: CloudRain,
  'siddetli-yagmur': CloudRainWind,
  kar: CloudSnow,
  firtina: CloudLightning,
  dolu: CloudHail,
}

export const weatherIcon = (key: string): LucideIcon => WEATHER_ICONS[key] ?? Cloud

const nf = (digits: number) => (v: number) =>
  v.toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits })

const int = nf(0)
const one = nf(1)

/** 24,5 → "25°"; null → "—" */
export const formatTemp = (value: number | null | undefined): string => (value == null ? '—' : `${int(Math.round(value))}°`)
/** Yağış miktarı: 0 → "0 mm", 3,24 → "3,2 mm" */
export const formatMm = (value: number | null | undefined): string => (value == null ? '—' : `${one(value)} mm`)
export const formatWind = (value: number | null | undefined): string => (value == null ? '—' : `${int(Math.round(value))} km/s`)
export const formatPercent = (value: number | null | undefined): string => (value == null ? '—' : `%${int(Math.round(value))}`)

const DIRECTIONS = ['Kuzey', 'Kuzeydoğu', 'Doğu', 'Güneydoğu', 'Güney', 'Güneybatı', 'Batı', 'Kuzeybatı']
/** Rüzgârın estiği yön (derece) → "Güneybatı" */
export const windDirection = (degrees: number | null | undefined): string | null =>
  degrees == null ? null : DIRECTIONS[Math.round((((degrees % 360) + 360) % 360) / 45) % 8]

export const SPRAY_LABEL: Record<SprayStatus, string> = {
  uygun: 'Uygun',
  sinirda: 'Sınırda',
  uygun_degil: 'Uygun değil',
}

/** İlaçlama şeridi renkleri: yeşil / sarı / kırmızı */
export const SPRAY_CLASS: Record<SprayStatus, string> = {
  uygun: 'bg-emerald-500',
  sinirda: 'bg-amber-400',
  uygun_degil: 'bg-red-500',
}

/** Geçen yılla farkı kısa cümleyle anlatır: "geçen yıldan %35 az" */
export function compareToLastYear(mm: number | null, last: number | null): string | null {
  if (mm == null || last == null) return null
  if (last === 0) return mm === 0 ? 'geçen yılla aynı' : 'geçen yıl hiç yağış yoktu'
  const pct = Math.round(((mm - last) / last) * 100)
  if (Math.abs(pct) < 5) return 'geçen yılla yaklaşık aynı'
  return `geçen yıldan %${Math.abs(pct)} ${pct > 0 ? 'fazla' : 'az'}`
}

/** Hava uyarısının "ne zaman" metni: "Yarın 03:00" gibi (yerel saat metninden, saat dilimi dönüşümü yok) */
export function whenText(moment: string, today: string): string {
  const day = moment.slice(0, 10)
  const diff = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
  const label = diff === 0 ? 'Bugün' : diff === 1 ? 'Yarın' : `${Number(day.slice(8, 10))}.${day.slice(5, 7)}`
  return `${label} ${moment.slice(11, 16)}`
}

// --- bahçe listesi uyarı simgeleri
export interface ListAlert {
  kaynak: 'hava' | 'uydu'
  tur: 'don' | 'sicak' | 'indeks'
  seviye: 'sari' | 'kirmizi'
  baslik: string
  Icon: LucideIcon
}

const SEVERITY_ORDER = { kirmizi: 0, sari: 1 } as const

function weatherListAlert(alert: WeatherAlert): ListAlert {
  return {
    kaynak: 'hava',
    tur: alert.tur,
    seviye: alert.seviye,
    baslik: alert.baslik,
    Icon: alert.tur === 'don' ? Snowflake : Sun,
  }
}

/** Her bahçe için aktif hava ve uydu uyarıları; kırmızılar önce. */
export function mergeAlerts(
  weather: WeatherSummary[] | undefined,
  satellite: GardenSatelliteAlerts[] | undefined,
): Map<string, ListAlert[]> {
  const result = new Map<string, ListAlert[]>()
  const push = (id: string, alert: ListAlert) => result.set(id, [...(result.get(id) ?? []), alert])
  for (const item of weather ?? []) item.uyarilar.forEach((a) => push(item.gardenId, weatherListAlert(a)))
  for (const item of satellite ?? []) {
    for (const a of item.uyarilar) {
      const name = a.indeks ? INDEX_DEFS[a.indeks].ad : 'Çoklu indeks'
      push(item.gardenId, {
        kaynak: 'uydu',
        tur: 'indeks',
        seviye: a.oncelik === 'yuksek' ? 'kirmizi' : 'sari',
        baslik: a.baslik || `${name} düşüşü`,
        Icon: TrendingDown,
      })
    }
  }
  for (const [id, list] of result) result.set(id, list.sort((a, b) => SEVERITY_ORDER[a.seviye] - SEVERITY_ORDER[b.seviye]))
  return result
}
