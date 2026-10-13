import { useCallback, useMemo } from 'react'
import { useEdinimIzgara, useEdinimler, type Edinim } from '../api/edinimApi'
import { useNormalBantlar } from '../api/normalBantApi'
import { useLandsatEdinimler, useLandsatIzgara, type LandsatEdinim } from '../api/suApi'
import { useRadarDegisimler, useRadarEdinimler, useRadarIzgara, type RadarEdinim } from '../api/radarApi'
import { differenceGrid, median, percentileDomain, symmetricDomain, type PGrid } from '../lib/izgara'
import { RAMPS, type Stops } from '../lib/paletler'
import { useCalismaStore } from './calismaStore'
import { GOSTERGE_ARALIK, KATMANLAR, RADAR_DEGISIM_ARALIK, RADAR_VH_ARALIK, SICAKLIK_ARALIK, type KatmanTanimi } from './katmanlar'

/** Değişim katmanında karşılaştırılan önceki net görüntü en az bu kadar gün önce olmalı (çok yakın tarih gürültü verir). */
export const DEGISIM_MIN_GUN = 10

/** Haritada gezilebilen bir net görüntü (edinim). */
export interface Sahne {
  tarih: string
  bulutOrani: number | null
  sceneId: string
  /** Radar: göreli yörünge ve geçiş yönü (inis | cikis) */
  yorunge?: number
  yon?: string
  /** Landsat platformu (L8 | L9) */
  platform?: string
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
  /** Soluk çizilen aralık (radar değişiminde anlamlı eşiğin altı) */
  soluk: [number, number] | null
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
const toSahne = (e: Edinim): Sahne => ({ tarih: e.tarih, bulutOrani: e.bulut_orani, sceneId: e.scene_id })
const landsatSahne = (e: LandsatEdinim): Sahne => ({ tarih: e.tarih, bulutOrani: e.bulut_orani, sceneId: e.scene_id, platform: e.platform ?? undefined })
const radarSahne = (e: RadarEdinim): Sahne => ({ tarih: e.tarih, bulutOrani: null, sceneId: e.scene_id, yorunge: e.yorunge, yon: e.gecis_yonu })

/** Seçili katman, tarih ve skala için haritada gösterilecek ızgara — harita, histogram ve nokta incelemesi aynı kaynağı kullanır (tek veri hattı: edinimler). */
export function useHaritaGorunumu(gardenId: string | null): HaritaGorunumu {
  const katman = useCalismaStore((s) => s.katman)
  const tarih = useCalismaStore((s) => s.tarih)
  const skala = useCalismaStore((s) => s.skala)
  const tanim = KATMANLAR[katman]
  const gosterge = tanim.gosterge
  const radarTuru = tanim.radar ?? null
  const landsat = tanim.landsat === true
  const edinimSorgu = useEdinimler(gardenId)
  const radarSorgu = useRadarEdinimler(radarTuru ? gardenId : null)
  const landsatSorgu = useLandsatEdinimler(landsat ? gardenId : null)
  const radarOlaylari = useRadarDegisimler(radarTuru === 'degisim' ? gardenId : null).data
  const { refetch } = edinimSorgu
  const { refetch: radarYenile } = radarSorgu
  const { refetch: landsatYenile } = landsatSorgu
  const tekrarDene = useCallback(() => void (landsat ? landsatYenile() : radarTuru ? radarYenile() : refetch()), [refetch, radarYenile, landsatYenile, radarTuru, landsat])
  const hata = landsat ? landsatSorgu.isError && !landsatSorgu.data : radarTuru ? radarSorgu.isError && !radarSorgu.data : edinimSorgu.isError && !edinimSorgu.data
  const radarListe = useMemo(() => (radarSorgu.data?.edinimler ?? []).filter((e) => e.birincil && e.izgara), [radarSorgu.data])
  const sahneler = useMemo(() => {
    if (landsat) return (landsatSorgu.data?.edinimler ?? []).map(landsatSahne)
    if (radarTuru === 'vh') return radarListe.map(radarSahne)
    if (radarTuru === 'degisim') return radarListe.slice(3).map(radarSahne) // ani değişim için aynı yörüngede önceki 3 sahne gerekir
    return (edinimSorgu.data?.edinimler ?? []).filter((e) => gosterge !== null && e.gostergeler[gosterge]).map(toSahne)
  }, [edinimSorgu.data, gosterge, radarTuru, radarListe, landsat, landsatSorgu.data])
  const sahne = (tarih ? sahneler.find((s) => s.tarih === tarih) : null) ?? sahneler[sahneler.length - 1] ?? null
  const onceki = useMemo(() => {
    if (katman !== 'degisim' || !sahne) return null
    return [...sahneler].reverse().find((s) => s.tarih < sahne.tarih && daysBetween(s.tarih, sahne.tarih) >= DEGISIM_MIN_GUN) ?? null
  }, [katman, sahne, sahneler])
  const izgaraBilgisi = landsat ? landsatSorgu.data?.izgara : radarTuru ? radarSorgu.data?.izgara : edinimSorgu.data?.izgara
  const optikGrid = useEdinimIzgara(gardenId, radarTuru || landsat ? null : (sahne?.tarih ?? null), gosterge, izgaraBilgisi).data
  const landsatGrid = useLandsatIzgara(gardenId, landsat ? (sahne?.tarih ?? null) : null, izgaraBilgisi)
  const radarGrid = useRadarIzgara(gardenId, radarTuru ? (sahne?.tarih ?? null) : null, radarTuru === 'degisim' ? 'degisim' : 'vh_db', izgaraBilgisi)
  const grid = landsat ? landsatGrid.data : radarTuru ? radarGrid.data : optikGrid
  const prevGrid = useEdinimIzgara(gardenId, radarTuru || landsat ? null : (onceki?.tarih ?? null), gosterge, izgaraBilgisi).data
  const bantlar = useNormalBantlar(gardenId).data
  const tipik = gosterge ? bantlar?.tipik_bantlar[gosterge] : undefined
  const tipikBant = useMemo<TipikBant | null>(() => (tipik && katman !== 'degisim' ? { alt: tipik.alt, ust: tipik.ust, onDeger: tipik.durum !== 'muhendis_onayli' } : null), [tipik, katman])
  const yukleniyor = landsat ? landsatSorgu.isLoading : radarTuru ? radarSorgu.isLoading : edinimSorgu.isLoading
  return useMemo(() => {
    const ramp = tanim.ramp ? RAMPS[tanim.ramp] : null
    const asP = (g: typeof grid): PGrid | null => (g ? { values: g.values, rows: g.rows, cols: g.cols, corners: g.corners as unknown as [number, number][] } : null)
    const aralik = gosterge ? GOSTERGE_ARALIK[gosterge] : null
    if (landsat) {
      const izgara = asP(grid)
      const alan: [number, number] = izgara ? (skala === 'kendi' ? percentileDomain([izgara]) : SICAKLIK_ARALIK) : SICAKLIK_ARALIK
      return { tanim, sahneler, sahne, onceki: null, izgara, alan, ramp, yukleniyor: yukleniyor || (Boolean(sahne) && !izgara), neden: null, hata, tekrarDene, ortanca: izgara ? median(izgara) : null, tipikBant: null, soluk: null }
    }
    if (radarTuru) {
      const izgara = asP(grid)
      const esik = radarOlaylari?.esikler.anlamli_degisim_db ?? 2
      const neden = radarTuru === 'degisim' && radarGrid.isError ? 'Aynı yörüngede yeterli önceki geçiş yok; radar değişimi hesaplanamıyor.' : null
      const fark = tanim.fark === true
      const alan: [number, number] = izgara ? (fark ? (skala === 'kendi' ? symmetricDomain(izgara) : [-RADAR_DEGISIM_ARALIK, RADAR_DEGISIM_ARALIK]) : skala === 'kendi' ? percentileDomain([izgara]) : RADAR_VH_ARALIK) : fark ? [-RADAR_DEGISIM_ARALIK, RADAR_DEGISIM_ARALIK] : RADAR_VH_ARALIK
      return {
        tanim, sahneler, sahne, onceki: null, izgara, alan, ramp, yukleniyor: yukleniyor || (Boolean(sahne) && !izgara && !neden && !radarGrid.isError), neden, hata, tekrarDene,
        ortanca: izgara ? median(izgara) : null, tipikBant: null, soluk: fark ? [-esik, esik] : null,
      }
    }
    if (katman === 'degisim') {
      const a = asP(grid)
      const b = asP(prevGrid)
      const diff = a && b ? differenceGrid(a, b) : null
      const neden = !onceki ? `Karşılaştırılacak, en az ${DEGISIM_MIN_GUN} gün önceki net görüntü yok.` : a && b && !diff ? 'İki görüntünün ızgarası farklı; fark gösterilmiyor.' : null
      const alan: [number, number] = diff ? (skala === 'kendi' ? symmetricDomain(diff) : [-(aralik?.fark ?? 0.25), aralik?.fark ?? 0.25]) : [-0.1, 0.1]
      return { tanim, sahneler, sahne, onceki, izgara: diff, alan, ramp, yukleniyor: yukleniyor || (Boolean(onceki) && !diff && !neden), neden, hata, tekrarDene, ortanca: diff ? median(diff) : null, tipikBant: null, soluk: null }
    }
    const izgara = asP(grid)
    const alan: [number, number] = izgara && aralik ? (skala === 'kendi' ? percentileDomain([izgara]) : [aralik.min, aralik.max]) : [0, 1]
    return { tanim, sahneler, sahne, onceki, izgara, alan, ramp, yukleniyor: yukleniyor || (Boolean(gosterge && sahne) && !izgara), neden: null, hata, tekrarDene, ortanca: izgara ? median(izgara) : null, tipikBant, soluk: null }
  }, [tanim, katman, gosterge, radarTuru, landsat, radarOlaylari, radarGrid.isError, sahneler, sahne, onceki, grid, prevGrid, skala, yukleniyor, hata, tekrarDene, tipikBant])
}
