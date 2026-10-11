/**
 * Harita ve arşiv görüntüleyicisinin ortak görünüm kuralları (SAF fonksiyonlar; DOM gerektirmez).
 * Canvas çizimi `rasterRender.ts`'tedir.
 */
import { RASTER } from './config'
import { safeColormap, type ColormapId, type IndexDef, type IndexId } from './indices'
import { percentileRange, type ColorRange } from './render'

/** Renk skalası: bahçenin kendi içi farkları (varsayılan) ya da sabit genel skala */
export type Scale = 'kendi' | 'genel'
/** Çizim: ham 10 m pikseller ya da görsel olarak yumuşatılmış */
export type Smoothing = 'ham' | 'yumusak'

export interface ViewSettings {
  skala: Scale
  cizim: Smoothing
  renkKorlugu: boolean
}

export const DEFAULT_VIEW: ViewSettings = { skala: 'kendi', cizim: 'ham', renkKorlugu: false }

export interface ValueRange {
  vmin: number
  vmax: number
  /** Kendi farkları görünümünde bahçe içinde belirgin fark yok */
  homogeneous: boolean
}

/** Renk aralığı: genel skala parametrenin sabit aralığı; kendi farkları bu görüntünün p2–p98 aralığı. */
export function valueRange(values: Float32Array, def: IndexDef, skala: Scale): ValueRange {
  const fixed: ValueRange = { vmin: def.min, vmax: def.max, homogeneous: false }
  if (skala === 'genel') return fixed
  const range = percentileRange(values, RASTER.stretchLowPercentile, RASTER.stretchHighPercentile)
  if (!range) return fixed
  const [low, high] = range
  if (high - low < RASTER.homogeneityRangeShare * (def.max - def.min)) {
    // Fark yok: renkler mutlak skalada kalır (tek tona yakın), gürültü büyütülmez
    return { ...fixed, homogeneous: true }
  }
  return { vmin: low, vmax: high, homogeneous: false }
}

export function colorRange(range: ValueRange, def: IndexDef, settings: ViewSettings): ColorRange {
  return { vmin: range.vmin, vmax: range.vmax, colormap: safeColormap(def.renk, settings.renkKorlugu) }
}

export type ViewKind = 'kendi' | 'genel' | 'gercek' | 'fark'

/** Haritanın/görüntüleyicinin son çizimi hakkında bilgi: lejant ve etiket için */
export interface RenderInfo {
  kind: ViewKind
  vmin: number
  vmax: number
  indeks: IndexId | null
  colormap: ColormapId | null
  homogeneous: boolean
  tarih: string
}

export function legendTitle(info: RenderInfo): string {
  switch (info.kind) {
    case 'kendi':
      return 'Bahçenin kendi farkları'
    case 'genel':
      return 'Genel skala'
    case 'fark':
      return 'Değişim'
    case 'gercek':
      return 'Gerçek renk'
  }
}

/** Lejantın altındaki tek cümlelik, çiftçi dilinde açıklama (görünümü adlandırır). */
export function legendHint(info: RenderInfo): string {
  if (info.kind === 'kendi') {
    return info.homogeneous
      ? 'Bahçe homojen – belirgin güçlü/zayıf kesim yok.'
      : 'Renkler yalnızca bu bahçenin kendi içindeki farkı gösterir: en zayıf kesimden en güçlü kesime.'
  }
  if (info.kind === 'genel') return 'Sabit skala: farklı tarihler ve bahçeler aynı renkle kıyaslanabilir.'
  if (info.kind === 'fark') return 'İki tarih arasındaki fark. Mevsim değişimi normal olabilir.'
  return 'Uydunun gördüğü doğal renkler; skala yoktur.'
}

export const viewLabel = (skala: Scale): string => (skala === 'kendi' ? 'Bahçenin kendi farkları' : 'Genel skala')
