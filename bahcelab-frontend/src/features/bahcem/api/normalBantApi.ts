import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/apiClient'
import type { GostergeId } from './edinimApi'

export interface NormalBantAy {
  ay: number
  yil_sayisi: number
  yillar: number[]
  p10: number | null
  p25: number | null
  p50: number | null
  p75: number | null
  p90: number | null
  ceyrek_yeterli: boolean
  onluk_yeterli: boolean
  durum: 'yeterli' | 'kismi' | 'yetersiz_gecmis'
}

export interface NormalBantlar {
  kaynak: string
  formul_surumu: string | null
  asgari_yil_ceyrek: number
  asgari_yil_onluk: number
  esik_durumu: 'dogrulanmadi' | 'muhendis_onayli'
  tipik_bantlar: Record<string, { alt: number; ust: number; durum: 'dogrulanmadi' | 'muhendis_onayli' }>
  gostergeler: Partial<Record<GostergeId, NormalBantAy[]>>
  hazir: boolean
}

/** Gösterge × ay normal bantları (bahçenin kendi 2015–geçen yıl dağılımı). Yetersiz geçmişte yüzdelikler boştur. */
export function useNormalBantlar(gardenId: string | null) {
  return useQuery({
    queryKey: ['normal-bantlar', gardenId],
    queryFn: () => apiRequest<NormalBantlar>(`/gardens/${gardenId}/normal-bantlar`),
    enabled: gardenId !== null,
    staleTime: 60_000,
  })
}

export type BandKonumu = 'ust' | 'normal' | 'alt' | 'en_dusuk' | null

/** Bugünkü değerin banda göre konumu (p25–p75 normal; p10–p25 alt kısmı; p10 altı en düşüğü). Band yetersizse null. */
export function bandKonumu(deger: number, band: NormalBantAy | undefined): BandKonumu {
  if (!band || !band.ceyrek_yeterli || band.p25 === null || band.p75 === null) return null
  if (deger > band.p75) return 'ust'
  if (deger >= band.p25) return 'normal'
  if (band.onluk_yeterli && band.p10 !== null) return deger >= band.p10 ? 'alt' : 'en_dusuk'
  return 'alt'
}
