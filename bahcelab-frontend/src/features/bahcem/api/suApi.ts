import { useQuery } from '@tanstack/react-query'
import { apiRequest, apiRequestRaw } from '@/lib/apiClient'
import { parseGrid, type Corners, type Grid } from '../lib/render'

/** Su sekmesi (ADR 0017): toprak nem profili (ERA5-Land), su dengesi, yüzey–hava sıcaklığı. Katsayılar «ön değer · mühendis onayı bekliyor». */
export interface KaynakCipi {
  ad: string
  cozunurluk: string
  tarih: string | null
  not_: string | null
}
export interface ProfilKatmani {
  derinlik: string
  bugun: number | null
  bugun_kaynak: 'era5_land' | 'model' | 'yok'
  otuz_gun_once: number | null
  normal_alt: number
  normal_ust: number
  doluluk: number | null
}
export interface NemProfili {
  bugun_tarihi: string | null
  otuz_gun_once_tarihi: string | null
  katmanlar: ProfilKatmani[]
  kok_bolgesi_doluluk: number | null
  kok_bolgesi_sinif: 'nemli' | 'orta' | 'kuru' | 'bilinmiyor'
  gecis_gunu: string | null
  model_ofset: Record<string, number> | null
}
export interface DengeGunu {
  tarih: string
  yagis_mm: number | null
  etc_mm: number | null
  tukenme_mm: number | null
  birikimli_mm: number | null
  tahmin: boolean
  yagis_kaynagi: 'era5' | 'imerg' | 'model' | 'yok'
  veri_eksik: boolean
}
export interface SicaklikNoktasi {
  tarih: string
  yuzey_bahce_c: number
  yuzey_tampon_c: number | null
  hava_c: number | null
  fark_c: number | null
  stres: boolean | null
  karisik_piksel: boolean | null
  bahce_tampon_fark_c: number | null
}
export interface SuYaniti {
  karar: string
  on_deger: boolean
  profil: NemProfili
  denge: { taw_mm: number | null; tukenme_esigi_mm: number | null; gunler: DengeGunu[]; yagis_kaynagi: 'era5' | 'imerg'; yagis_karari: string; kc_notu: string }
  sicaklik: { noktalar: SicaklikNoktasi[]; stres_esigi_c: number; karisik_piksel_esigi_c: number }
  toprak: { kum_yuzde: number | null; kil_yuzde: number | null; silt_yuzde: number | null; organik_karbon_g_kg: number | null; tarla_kapasitesi: number | null; solma_noktasi: number | null; kaynak: string | null }
  kaynaklar: Record<'profil' | 'denge' | 'sicaklik', KaynakCipi>
  dogrulama: string[]
}

export function useSu(gardenId: string | null) {
  return useQuery({
    queryKey: ['su', gardenId],
    queryFn: () => apiRequest<SuYaniti>(`/gardens/${gardenId}/su`),
    enabled: gardenId !== null,
    staleTime: 5 * 60_000,
  })
}

/** Landsat 8/9 yüzey sıcaklığı sahneleri ve ızgarası (Sıcaklık katmanı). */
export interface LandsatEdinim {
  tarih: string
  scene_id: string
  platform: string | null
  bulut_orani: number | null
  gecerli_oran: number | null
  bahce_c: number
  tampon_c: number | null
}
export interface LandsatEdinimler {
  izgara: { satir: number; sutun: number; koordinatlar: number[][] } | null
  edinimler: LandsatEdinim[]
}

export function useLandsatEdinimler(gardenId: string | null) {
  return useQuery({
    queryKey: ['landsat-edinimler', gardenId],
    queryFn: () => apiRequest<LandsatEdinimler>(`/gardens/${gardenId}/landsat/edinimler`),
    enabled: gardenId !== null,
    staleTime: 60_000,
  })
}

export function useLandsatIzgara(gardenId: string | null, tarih: string | null, izgara: LandsatEdinimler['izgara'] | undefined) {
  return useQuery({
    queryKey: ['landsat-izgara', gardenId, tarih],
    queryFn: async (): Promise<Grid> => {
      const response = await apiRequestRaw(`/gardens/${gardenId}/landsat/edinimler/${tarih}/izgara`)
      return parseGrid(await response.arrayBuffer(), izgara!.satir, izgara!.sutun, izgara!.koordinatlar as unknown as Corners)
    },
    enabled: Boolean(gardenId && tarih && izgara),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  })
}
