/** Görüntü arşivi: adres (URL) durumu ve saf yardımcılar. Durumun tamamı adreste tutulur; paylaşılabilir ve geri tuşu çalışır. */
import { nearestDate } from './dates'
import { INDEX_IDS, TRUE_COLOR, isIndexId, type LayerId } from './indices'

export const ARCHIVE_MODES = ['tek', 'karsilastir', 'degisim', 'zaman'] as const
export type ArchiveMode = (typeof ARCHIVE_MODES)[number]
export const ARCHIVE_MODE_LABELS: Record<ArchiveMode, string> = {
  tek: 'Tek görüntü',
  karsilastir: 'İki tarihi karşılaştır',
  degisim: 'Değişim haritası',
  zaman: 'Zaman atlaması',
}

export const COMPARE_STYLES = ['kaydirici', 'yan'] as const
export type CompareStyle = (typeof COMPARE_STYLES)[number]

export interface ArchiveState {
  parametre: LayerId
  /** Seçili (A) tarih; null = en yeni görüntü */
  tarih: string | null
  /** Karşılaştırma/değişim için ikinci (B) tarih */
  b: string | null
  mod: ArchiveMode
  stil: CompareStyle
  /** Sezon (takvim yılı); null = tümü */
  sezon: number | null
  /** Yalnızca net görüntüler (varsayılan açık) */
  net: boolean
}

export const DEFAULT_ARCHIVE: ArchiveState = {
  parametre: 'ndvi',
  tarih: null,
  b: null,
  mod: 'tek',
  stil: 'kaydirici',
  sezon: null,
  net: true,
}

const ISO = /^\d{4}-\d{2}-\d{2}$/
const isIso = (v: string | null): v is string => v !== null && ISO.test(v)
const oneOf = <T extends string>(list: readonly T[], v: string | null, fallback: T): T => (list as readonly string[]).includes(v ?? '') ? (v as T) : fallback

/** Adres sorgusunu (geçersiz değerleri varsayılana düşürerek) durumla eşler. */
export function parseArchiveSearch(params: URLSearchParams): ArchiveState {
  const parametre = params.get('parametre')
  const sezon = Number(params.get('sezon'))
  return {
    parametre: parametre === TRUE_COLOR || (parametre !== null && isIndexId(parametre)) ? (parametre as LayerId) : DEFAULT_ARCHIVE.parametre,
    tarih: isIso(params.get('tarih')) ? params.get('tarih') : null,
    b: isIso(params.get('b')) ? params.get('b') : null,
    mod: oneOf(ARCHIVE_MODES, params.get('mod'), DEFAULT_ARCHIVE.mod),
    stil: oneOf(COMPARE_STYLES, params.get('stil'), DEFAULT_ARCHIVE.stil),
    sezon: Number.isInteger(sezon) && sezon >= 2015 && sezon <= 2100 ? sezon : null,
    net: params.get('net') !== '0',
  }
}

/** Durumu adres sorgusuna çevirir; varsayılan değerler yazılmaz (kısa adres). */
export function buildArchiveSearch(state: ArchiveState): string {
  const p = new URLSearchParams()
  p.set('parametre', state.parametre)
  if (state.tarih) p.set('tarih', state.tarih)
  if (state.mod !== DEFAULT_ARCHIVE.mod) p.set('mod', state.mod)
  if (state.b && state.mod !== 'tek' && state.mod !== 'zaman') p.set('b', state.b)
  if (state.mod === 'karsilastir' && state.stil !== DEFAULT_ARCHIVE.stil) p.set('stil', state.stil)
  if (state.sezon !== null) p.set('sezon', String(state.sezon))
  if (!state.net) p.set('net', '0')
  return p.toString()
}

/** `/bahcem/:id/arsiv?...` */
export function archivePath(gardenId: string, partial: { parametre?: LayerId; tarih?: string | null } = {}): string {
  const search = buildArchiveSearch({ ...DEFAULT_ARCHIVE, ...partial, tarih: partial.tarih ?? null })
  return `/bahcem/${gardenId}/arsiv?${search}`
}

/** Seçili tarih listede yoksa en yakın görüntüye, o da yoksa (liste boşsa) null'a düşer. */
export function resolveDate(wanted: string | null, dates: readonly string[]): string | null {
  if (dates.length === 0) return null
  if (wanted && dates.includes(wanted)) return wanted
  if (wanted) return nearestDate(wanted, [...dates], Number.MAX_SAFE_INTEGER) ?? dates[dates.length - 1]
  return dates[dates.length - 1]
}

/** Ok tuşu gezinmesi: `step` -1 önceki (eski), +1 sonraki (yeni) görüntü; uçta yerinde kalır. */
export function stepDate(current: string | null, dates: readonly string[], step: -1 | 1): string | null {
  if (dates.length === 0) return null
  const index = current ? dates.indexOf(current) : -1
  if (index === -1) return dates[dates.length - 1]
  return dates[Math.min(dates.length - 1, Math.max(0, index + step))]
}

/** Seçili tarihin komşuları (önceden yüklenecek görüntüler): önce yakınlar, sonra uzaklar. */
export function neighborDates(current: string | null, dates: readonly string[], count: number): string[] {
  const index = current ? dates.indexOf(current) : -1
  if (index === -1) return []
  const out: string[] = []
  for (let d = 1; d <= count; d++) {
    if (dates[index + d]) out.push(dates[index + d])
    if (dates[index - d]) out.push(dates[index - d])
  }
  return out
}

/** Ay başlığı için gruplama: ["2026-05", ...] sırası korunur, yeni ay üstte. */
export function groupByMonth<T extends { tarih: string }>(items: readonly T[]): { ay: string; items: T[] }[] {
  const groups: { ay: string; items: T[] }[] = []
  for (const item of [...items].sort((a, b) => b.tarih.localeCompare(a.tarih))) {
    const ay = item.tarih.slice(0, 7)
    const last = groups[groups.length - 1]
    if (last && last.ay === ay) last.items.push(item)
    else groups.push({ ay, items: [item] })
  }
  return groups
}

export const ARCHIVE_PARAMETERS: readonly LayerId[] = [...INDEX_IDS, TRUE_COLOR]
