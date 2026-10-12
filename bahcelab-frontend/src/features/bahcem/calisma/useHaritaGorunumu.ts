import { useCallback, useMemo } from 'react'
import { useEdinimIzgara, useEdinimler, type Edinim } from '../api/edinimApi'
import { useNormalBantlar } from '../api/normalBantApi'
import { differenceGrid, median, percentileDomain, symmetricDomain, type PGrid } from '../lib/izgara'
import { RAMPS, type Stops } from '../lib/paletler'
import { useCalismaStore } from './calismaStore'
import { GOSTERGE_ARALIK, KATMANLAR, type KatmanTanimi } from './katmanlar'

/** Değişim katmanında karşılaştırılan önceki net görüntü en az bu kadar gün önce olmalı (çok yakın tarih gürültü verir). */
export const DEGISIM_MIN_GUN = 10

/** Haritada gezilebilen bir net görüntü (edinim). */
export interface Sahne {
  tarih: string
  bulutOrani: number | null
  sceneId: string
}

export interface TipikBant {
  alt: number
  ust: number
  onDeger: boolean
}

export interface HaritaGorunumu {
  tanim: KatmanTanimi
  sahneler: Sahne[]
  sahne: Sahne | null
  onceki: Sahne | null
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
  /** Ürünün bu gösterge için tipik aralığı (ön değer); fark katmanında yok */
  tipikBant: TipikBant | null
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
const toSahne = (e: Edinim): Sahne => ({ tarih: e.tarih, bulutOrani: e.bulut_orani, sceneId: e.scene_id })

/** Seçili katman, tarih ve skala için haritada gösterilecek ızgara — harita, histogram ve nokta incelemesi aynı kaynağı kullanır (tek veri hattı: edinimler). */
export function useHaritaGorunumu(gardenId: string | null): HaritaGorunumu {
  const katman = useCalismaStore((s) => s.katman)
  const tarih = useCalismaStore((s) => s.tarih)
  const skala = useCalismaStore((s) => s.skala)
  const tanim = KATMANLAR[katman]
  const gosterge = tanim.gosterge
  const edinimSorgu = useEdinimler(gardenId)
  const { refetch } = edinimSorgu
  const tekrarDene = useCallback(() => void refetch(), [refetch])
  const hata = edinimSorgu.isError && !edinimSorgu.data
  const sahneler = useMemo(() => (edinimSorgu.data?.edinimler ?? []).filter((e) => gosterge !== null && e.gostergeler[gosterge]).map(toSahne), [edinimSorgu.data, gosterge])
  const sahne = (tarih ? sahneler.find((s) => s.tarih === tarih) : null) ?? sahneler[sahneler.length - 1] ?? null
  const onceki = useMemo(() => {
    if (katman !== 'degisim' || !sahne) return null
    return [...sahneler].reverse().find((s) => s.tarih < sahne.tarih && daysBetween(s.tarih, sahne.tarih) >= DEGISIM_MIN_GUN) ?? null
  }, [katman, sahne, sahneler])
  const izgaraBilgisi = edinimSorgu.data?.izgara
  const grid = useEdinimIzgara(gardenId, sahne?.tarih ?? null, gosterge, izgaraBilgisi).data
  const prevGrid = useEdinimIzgara(gardenId, onceki?.tarih ?? null, gosterge, izgaraBilgisi).data
  const bantlar = useNormalBantlar(gardenId).data
  const tipik = gosterge ? bantlar?.tipik_bantlar[gosterge] : undefined
  const tipikBant = useMemo<TipikBant | null>(() => (tipik && katman !== 'degisim' ? { alt: tipik.alt, ust: tipik.ust, onDeger: tipik.durum !== 'muhendis_onayli' } : null), [tipik, katman])
  const yukleniyor = edinimSorgu.isLoading
  return useMemo(() => {
    const ramp = tanim.ramp ? RAMPS[tanim.ramp] : null
    const asP = (g: typeof grid): PGrid | null => (g ? { values: g.values, rows: g.rows, cols: g.cols, corners: g.corners as unknown as [number, number][] } : null)
    const aralik = gosterge ? GOSTERGE_ARALIK[gosterge] : null
    if (katman === 'degisim') {
      const a = asP(grid)
      const b = asP(prevGrid)
      const diff = a && b ? differenceGrid(a, b) : null
      const neden = !onceki ? `Karşılaştırılacak, en az ${DEGISIM_MIN_GUN} gün önceki net görüntü yok.` : a && b && !diff ? 'İki görüntünün ızgarası farklı; fark gösterilmiyor.' : null
      const alan: [number, number] = diff ? (skala === 'kendi' ? symmetricDomain(diff) : [-(aralik?.fark ?? 0.25), aralik?.fark ?? 0.25]) : [-0.1, 0.1]
      return { tanim, sahneler, sahne, onceki, izgara: diff, alan, ramp, yukleniyor: yukleniyor || (Boolean(onceki) && !diff && !neden), neden, hata, tekrarDene, ortanca: diff ? median(diff) : null, tipikBant: null }
    }
    const izgara = asP(grid)
    const alan: [number, number] = izgara && aralik ? (skala === 'kendi' ? percentileDomain([izgara]) : [aralik.min, aralik.max]) : [0, 1]
    return { tanim, sahneler, sahne, onceki, izgara, alan, ramp, yukleniyor: yukleniyor || (Boolean(gosterge && sahne) && !izgara), neden: null, hata, tekrarDene, ortanca: izgara ? median(izgara) : null, tipikBant }
  }, [tanim, katman, gosterge, sahneler, sahne, onceki, grid, prevGrid, skala, yukleniyor, hata, tekrarDene, tipikBant])
}
