import { useCallback, useMemo } from 'react'
import { useGrid, useIndices, type Scene, type TipikBant } from '../api/indeksApi'
import { INDEX_DEFS } from '../lib/indices'
import { differenceGrid, median, percentileDomain, symmetricDomain, type PGrid } from '../lib/izgara'
import { RAMPS, type Stops } from '../lib/paletler'
import { isUsable } from '../lib/scenes'
import { useCalismaStore } from './calismaStore'
import { KATMANLAR, type KatmanTanimi } from './katmanlar'

/** Değişim katmanında karşılaştırılan önceki net görüntü en az bu kadar gün önce olmalı (çok yakın tarih gürültü verir). */
export const DEGISIM_MIN_GUN = 10

export interface HaritaGorunumu {
  tanim: KatmanTanimi
  sahneler: Scene[]
  sahne: Scene | null
  onceki: Scene | null
  izgara: PGrid | null
  alan: [number, number]
  ramp: Stops | null
  yukleniyor: boolean
  /** Değişim hesaplanamıyorsa nedeni */
  neden: string | null
  /** Uydu verisi alınamadı (ağ/sunucu hatası) */
  hata: boolean
  tekrarDene: () => void
  /** Bahçedeki geçerli piksellerin ortancası (gösterilen ızgaradan) */
  ortanca: number | null
  /** Ürünün bu indeks için tipik aralığı (ön değer); fark katmanında yok */
  tipikBant: TipikBant | null
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

/** Seçili katman, tarih ve skala için haritada gösterilecek ızgara — harita, histogram ve nokta incelemesi aynı kaynağı kullanır. */
export function useHaritaGorunumu(gardenId: string | null): HaritaGorunumu {
  const katman = useCalismaStore((s) => s.katman)
  const tarih = useCalismaStore((s) => s.tarih)
  const skala = useCalismaStore((s) => s.skala)
  const tanim = KATMANLAR[katman]
  const indeks = tanim.indeks
  const indeksSorgu = useIndices(gardenId)
  const { data, isLoading } = indeksSorgu
  const hata = indeksSorgu.isError && !data
  const { refetch } = indeksSorgu
  const tekrarDene = useCallback(() => void refetch(), [refetch])
  const sahneler = useMemo(() => (indeks ? (data?.gozlemler ?? []).filter((s) => isUsable(s, indeks)) : (data?.gozlemler ?? []).filter((s) => s.durum === 'tamam')), [data, indeks])
  const sahne = (tarih ? sahneler.find((s) => s.tarih === tarih) : null) ?? sahneler[sahneler.length - 1] ?? null
  const onceki = useMemo(() => {
    if (katman !== 'degisim' || !sahne) return null
    return [...sahneler].reverse().find((s) => s.tarih < sahne.tarih && daysBetween(s.tarih, sahne.tarih) >= DEGISIM_MIN_GUN) ?? null
  }, [katman, sahne, sahneler])
  const grid = useGrid(gardenId, indeks ? sahne : null, indeks).data
  const prevGrid = useGrid(gardenId, onceki, indeks).data
  return useMemo(() => {
    const ramp = tanim.ramp ? RAMPS[tanim.ramp] : null
    const asP = (g: typeof grid): PGrid | null => (g ? { values: g.values, rows: g.rows, cols: g.cols, corners: g.corners as unknown as [number, number][] } : null)
    if (katman === 'degisim') {
      const a = asP(grid)
      const b = asP(prevGrid)
      const diff = a && b ? differenceGrid(a, b) : null
      const neden = !onceki ? `Karşılaştırılacak, en az ${DEGISIM_MIN_GUN} gün önceki net görüntü yok.` : a && b && !diff ? 'İki görüntünün ızgarası farklı; fark gösterilmiyor.' : null
      const def = indeks ? INDEX_DEFS[indeks] : null
      const alan: [number, number] = diff ? (skala === 'kendi' ? symmetricDomain(diff) : [-(def?.farkAraligi ?? 0.25), def?.farkAraligi ?? 0.25]) : [-0.1, 0.1]
      return { tanim, sahneler, sahne, onceki, izgara: diff, alan, ramp, yukleniyor: isLoading || (Boolean(onceki) && !diff && !neden), neden, hata, tekrarDene, ortanca: diff ? median(diff) : null, tipikBant: null }
    }
    const izgara = asP(grid)
    const def = indeks ? INDEX_DEFS[indeks] : null
    const alan: [number, number] = izgara && def ? (skala === 'kendi' ? percentileDomain([izgara]) : [def.min, def.max]) : [0, 1]
    return { tanim, sahneler, sahne, onceki, izgara, alan, ramp, yukleniyor: isLoading || (Boolean(indeks && sahne) && !izgara), neden: null, hata, tekrarDene, ortanca: izgara ? median(izgara) : null, tipikBant: (indeks && data?.tipikBantlar[indeks]) || null }
  }, [tanim, katman, sahneler, sahne, onceki, grid, prevGrid, skala, indeks, isLoading, hata, tekrarDene, data?.tipikBantlar])
}
