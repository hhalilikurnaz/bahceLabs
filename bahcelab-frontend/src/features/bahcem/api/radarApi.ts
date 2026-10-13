import { useQuery } from '@tanstack/react-query'
import { apiRequest, apiRequestRaw } from '@/lib/apiClient'
import { parseGrid, type Corners, type Grid } from '../lib/render'

/** Radar (Sentinel-1 RTC, ADR 0016): geçişler, değişim olayları, ızgaralar. «Radar (VH)» ve «Radar değişimi» — «radar nemi» denmez. */
export interface RadarEdinim {
  tarih: string
  scene_id: string
  yorunge: number
  gecis_yonu: string
  birincil: boolean
  maskeli_oran: number | null
  izgara: boolean
  vh_db: number | null
  rvi: number | null
}
export interface RadarYorunge {
  yorunge: number
  gecis_yonu: string
  sahne_sayisi: number
  birincil: boolean
}
export interface RadarEdinimler {
  izgara: { satir: number; sutun: number; koordinatlar: number[][] } | null
  yorungeler: RadarYorunge[]
  edinimler: RadarEdinim[]
}
export interface RadarDegisim {
  tarih: string
  scene_id: string
  yorunge: number
  gecis_yonu: string
  durum: 'aday' | 'gurultu'
  isaret: 'azalis' | 'artis'
  alan_orani: number
  alan_m2: number
  buyukluk_db: number
  bahce_delta_db: number | null
  kalici_sapma: 'alt' | 'ust' | 'bant_ici' | 'bant_yok'
  art_arda: boolean
  islaklik_olabilir: boolean | null
  yagis_mm: number | null
  /** dusuk: «ıslaklık olabilir» notlu aday (9F bildirime çevirmez) */
  guven: 'orta' | 'dusuk'
}
export interface RadarDegisimler {
  yorungeler: RadarYorunge[]
  esikler: { anlamli_degisim_db: number; anlamli_alan_orani: number; anlamli_alan_min_da: number; azami_maske_orani: number }
  esik_durumu: 'dogrulanmadi' | 'muhendis_onayli'
  degisimler: RadarDegisim[]
}

/** Geçiş yönü etiketi: arayüzde «iniş» / «çıkış». */
export const yonAdi = (yon: string): string => (yon === 'inis' ? 'iniş' : yon === 'cikis' ? 'çıkış' : yon)

export const radarKey = (gardenId: string | null) => ['radar-edinimler', gardenId] as const

export function useRadarEdinimler(gardenId: string | null) {
  return useQuery({
    queryKey: radarKey(gardenId),
    queryFn: () => apiRequest<RadarEdinimler>(`/gardens/${gardenId}/radar/edinimler`),
    enabled: gardenId !== null,
    staleTime: 60_000,
  })
}

export function useRadarDegisimler(gardenId: string | null) {
  return useQuery({
    queryKey: ['radar-degisimler', gardenId],
    queryFn: () => apiRequest<RadarDegisimler>(`/gardens/${gardenId}/radar/degisimler`),
    enabled: gardenId !== null,
    staleTime: 60_000,
  })
}

/** Birincil yörüngenin VH/VV/oran/RVI ızgarası (Lee filtreli) ya da `degisim` (ani değişim, dB). */
export function useRadarIzgara(gardenId: string | null, tarih: string | null, tur: 'vh_db' | 'degisim', izgara: RadarEdinimler['izgara'] | undefined) {
  return useQuery({
    queryKey: ['radar-izgara', gardenId, tarih, tur],
    queryFn: async (): Promise<Grid> => {
      const path = tur === 'degisim' ? `/gardens/${gardenId}/radar/degisim/${tarih}/izgara` : `/gardens/${gardenId}/radar/edinimler/${tarih}/${tur}/izgara`
      const response = await apiRequestRaw(path)
      return parseGrid(await response.arrayBuffer(), izgara!.satir, izgara!.sutun, izgara!.koordinatlar as unknown as Corners)
    },
    enabled: Boolean(gardenId && tarih && izgara),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: false, // 404 = yeterli önceki sahne yok: kullanıcıya nedeni gösterilir
  })
}

export interface RadarNokta {
  seri: { tarih: string; vh_db: number | null }[]
}
export function useRadarNokta(gardenId: string, tarih: string | null, satir: number | null, sutun: number | null) {
  return useQuery({
    queryKey: ['radar-nokta', gardenId, tarih, satir, sutun],
    queryFn: () => apiRequest<RadarNokta>(`/gardens/${gardenId}/radar/nokta?satir=${satir}&sutun=${sutun}&tarih=${tarih}`),
    enabled: tarih !== null && satir !== null && sutun !== null,
    staleTime: Infinity,
  })
}
