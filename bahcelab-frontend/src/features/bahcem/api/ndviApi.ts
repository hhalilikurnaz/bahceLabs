import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest, getApiBaseUrl } from '@/lib/apiClient'
import { GARDENS_KEY } from './useGardens'

export type NdviJobStatus = 'bekliyor' | 'isleniyor' | 'tamam' | 'hata'

export interface NdviObservation {
  tarih: string // YYYY-MM-DD
  durum: 'tamam' | 'bulutlu'
  sceneId: string
  bulutOrani: number | null
  gecerliPikselOrani: number
  ortalama: number | null
  medyan: number | null
  p10: number | null
  p90: number | null
  min: number | null
  max: number | null
  pngVar: boolean
  /** PNG köşeleri [boylam, enlem]: sol-üst, sağ-üst, sağ-alt, sol-alt */
  koordinatlar: [number, number][] | null
  sorunluBolgeSayisi: number
  kaynak: 'sentinel-2' | 'ornek'
  surum: number
}

export interface NdviJob {
  id: string
  tur: 'ilk' | 'guncelleme' | 'yeniden'
  durum: NdviJobStatus
  toplam: number
  islenen: number
  hataMesaji: string | null
}

export interface NdviAlert {
  tur: 'ndvi_dusus'
  mesaj: string
  oncekiTarih: string
  oncekiOrtalama: number
  sonTarih: string
  sonOrtalama: number
  degisimYuzde: number
}

export interface NdviData {
  gozlemler: NdviObservation[]
  isleme: NdviJob | null
  sonKontrol: string | null
  uyarilar: NdviAlert[]
  ornekVeri: boolean
}

export interface NdviZoneCollection {
  type: 'FeatureCollection'
  features: {
    type: 'Feature'
    geometry: GeoJSON.Geometry
    properties: { alan_m2: number; piksel: number; ortalama_ndvi: number | null }
  }[]
}

interface ApiNdviResponse {
  gozlemler: {
    tarih: string
    durum: 'tamam' | 'bulutlu'
    scene_id: string
    bulut_orani: number | null
    gecerli_piksel_orani: number
    ortalama: number | null
    medyan: number | null
    p10: number | null
    p90: number | null
    min: number | null
    max: number | null
    png_var: boolean
    koordinatlar: [number, number][] | null
    sorunlu_bolge_sayisi: number
    kaynak: 'sentinel-2' | 'ornek'
    surum: number
  }[]
  isleme: {
    id: string
    tur: NdviJob['tur']
    durum: NdviJobStatus
    toplam: number
    islenen: number
    hata_mesaji: string | null
  } | null
  son_kontrol: string | null
  uyarilar: {
    tur: 'ndvi_dusus'
    mesaj: string
    onceki_tarih: string
    onceki_ortalama: number
    son_tarih: string
    son_ortalama: number
    degisim_yuzde: number
  }[]
  ornek_veri: boolean
}

function mapJob(job: ApiNdviResponse['isleme']): NdviJob | null {
  return job
    ? {
        id: job.id,
        tur: job.tur,
        durum: job.durum,
        toplam: job.toplam,
        islenen: job.islenen,
        hataMesaji: job.hata_mesaji,
      }
    : null
}

function fromApi(data: ApiNdviResponse): NdviData {
  return {
    gozlemler: data.gozlemler.map((o) => ({
      tarih: o.tarih,
      durum: o.durum,
      sceneId: o.scene_id,
      bulutOrani: o.bulut_orani,
      gecerliPikselOrani: o.gecerli_piksel_orani,
      ortalama: o.ortalama,
      medyan: o.medyan,
      p10: o.p10,
      p90: o.p90,
      min: o.min,
      max: o.max,
      pngVar: o.png_var,
      koordinatlar: o.koordinatlar,
      sorunluBolgeSayisi: o.sorunlu_bolge_sayisi,
      kaynak: o.kaynak,
      surum: o.surum,
    })),
    isleme: mapJob(data.isleme),
    sonKontrol: data.son_kontrol,
    uyarilar: data.uyarilar.map((u) => ({
      tur: u.tur,
      mesaj: u.mesaj,
      oncekiTarih: u.onceki_tarih,
      oncekiOrtalama: u.onceki_ortalama,
      sonTarih: u.son_tarih,
      sonOrtalama: u.son_ortalama,
      degisimYuzde: u.degisim_yuzde,
    })),
    ornekVeri: data.ornek_veri,
  }
}

export const ndviApi = {
  async get(gardenId: string): Promise<NdviData> {
    return fromApi(await apiRequest<ApiNdviResponse>(`/gardens/${gardenId}/ndvi`))
  },
  async refresh(gardenId: string): Promise<NdviJob | null> {
    return mapJob(
      await apiRequest<NonNullable<ApiNdviResponse['isleme']>>(`/gardens/${gardenId}/ndvi/refresh`, {
        method: 'POST',
      }),
    )
  },
  zones(gardenId: string, tarih: string): Promise<NdviZoneCollection> {
    return apiRequest<NdviZoneCollection>(`/gardens/${gardenId}/ndvi/${tarih}/zones`)
  },
}

/** Yetkili PNG adresi (mutlak). `v` görüntü yeniden üretilince önbelleği yeniler. */
export function ndviImageUrl(gardenId: string, observation: NdviObservation): string {
  const path = `${getApiBaseUrl()}/gardens/${gardenId}/ndvi/${observation.tarih}.png?v=${observation.surum}`
  return typeof window === 'undefined' ? path : new URL(path, window.location.origin).toString()
}

export const ndviKey = (gardenId: string) => ['ndvi', gardenId] as const

const isActive = (job: NdviJob | null | undefined) => job?.durum === 'bekliyor' || job?.durum === 'isleniyor'

/** İşleme sürerken 3 sn'de bir yenilenir; iş bitince bahçe listesi (rozet/silüet) de yenilenir. */
export function useNdvi(gardenId: string | null) {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: gardenId ? ndviKey(gardenId) : ['ndvi', 'none'],
    queryFn: () => ndviApi.get(gardenId as string),
    enabled: gardenId !== null,
    refetchInterval: (q) => (isActive(q.state.data?.isleme) ? 3000 : false),
    staleTime: 10_000,
  })

  const wasActive = useRef(false)
  const active = isActive(query.data?.isleme)
  useEffect(() => {
    if (wasActive.current && !active) void client.invalidateQueries({ queryKey: GARDENS_KEY })
    wasActive.current = active
  }, [active, client])

  return query
}

export function useRefreshNdvi(gardenId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => ndviApi.refresh(gardenId),
    onSuccess: () => client.invalidateQueries({ queryKey: ndviKey(gardenId) }),
  })
}

export function useNdviZones(gardenId: string | null, tarih: string | null, enabled = true) {
  return useQuery({
    queryKey: ['ndvi-zones', gardenId, tarih],
    queryFn: () => ndviApi.zones(gardenId as string, tarih as string),
    enabled: enabled && gardenId !== null && tarih !== null,
    staleTime: 60_000,
  })
}
