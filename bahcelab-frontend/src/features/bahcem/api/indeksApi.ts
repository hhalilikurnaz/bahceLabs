import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest, apiRequestRaw, getApiBaseUrl } from '@/lib/apiClient'
import { INDEX_IDS, type IndexId, type LayerId } from '../lib/indices'
import { parseGrid, type Corners, type Grid } from '../lib/render'
import type { ApiIndexOverview, ApiScene } from './dto/ndvi'
import { GARDENS_KEY } from './useGardens'

export type JobStatus = 'bekliyor' | 'isleniyor' | 'tamam' | 'hata'

export interface IndexSummary {
  ortalama: number
  medyan: number
  p10: number
  p90: number
  min: number
  max: number
  pngVar: boolean
  /** Ham ızgara hazır: kontrastlı mod, değişim haritası ve karşılaştırma bu veriyle çalışır */
  veriVar: boolean
  sorunluBolgeSayisi: number
}

export interface Scene {
  tarih: string // YYYY-MM-DD
  durum: 'tamam' | 'bulutlu'
  sceneId: string
  bulutOrani: number | null
  gecerliPikselOrani: number
  satir: number | null
  sutun: number | null
  /** Görüntü köşeleri [boylam, enlem]: KB, KD, GD, GB */
  koordinatlar: [number, number][] | null
  gercekRenkVar: boolean
  indeksler: Partial<Record<IndexId, IndexSummary>>
  kaynak: string
  surum: number
}

export interface Job {
  id: string
  tur: 'ilk' | 'guncelleme' | 'yeniden'
  durum: JobStatus
  toplam: number
  islenen: number
  hataMesaji: string | null
}

export interface Alert {
  tur: 'indeks_dusus' | 'coklu_indeks'
  indeks: IndexId | null
  indeksler: IndexId[]
  oncelik: 'normal' | 'yuksek'
  baslik: string
  mesaj: string
  oncekiTarih: string | null
  sonTarih: string
  degisimYuzde: number | null
}

export interface IndexData {
  gozlemler: Scene[]
  isleme: Job | null
  sonKontrol: string | null
  uyarilar: Alert[]
  eksikCikti: boolean
}

export interface ZoneCollection {
  type: 'FeatureCollection'
  features: {
    type: 'Feature'
    geometry: GeoJSON.Geometry
    properties: { alan_m2: number; piksel: number; ortalama: number | null }
  }[]
}

export type YieldClass = 'dusuk' | 'orta' | 'yuksek'

export interface YieldZones {
  indeks: 'ndvi' | 'msavi'
  gozlemSayisi: number
  ilkTarih: string
  sonTarih: string
  toplamAlanM2: number
  bolgeler: GeoJSON.FeatureCollection<
    GeoJSON.Geometry,
    { sinif: YieldClass; etiket: string; alan_m2: number; pay: number; piksel: number; ortalama: number }
  >
}

function mapScene(o: ApiScene): Scene {
  const summaries: Scene['indeksler'] = {}
  for (const id of INDEX_IDS) {
    const s = o.indeksler?.[id]
    if (s) {
      summaries[id] = {
        ortalama: s.ortalama,
        medyan: s.medyan,
        p10: s.p10,
        p90: s.p90,
        min: s.min,
        max: s.max,
        pngVar: s.png_var,
        veriVar: s.veri_var,
        sorunluBolgeSayisi: s.sorunlu_bolge_sayisi,
      }
    }
  }
  return {
    tarih: o.tarih,
    durum: o.durum,
    sceneId: o.scene_id,
    bulutOrani: o.bulut_orani,
    gecerliPikselOrani: o.gecerli_piksel_orani,
    satir: o.satir,
    sutun: o.sutun,
    koordinatlar: o.koordinatlar,
    gercekRenkVar: o.gercek_renk_var,
    indeksler: summaries,
    kaynak: o.kaynak,
    surum: o.surum,
  }
}

function fromApi(data: ApiIndexOverview): IndexData {
  return {
    gozlemler: data.gozlemler.map(mapScene),
    isleme: data.isleme && {
      id: data.isleme.id,
      tur: data.isleme.tur,
      durum: data.isleme.durum,
      toplam: data.isleme.toplam,
      islenen: data.isleme.islenen,
      hataMesaji: data.isleme.hata_mesaji,
    },
    sonKontrol: data.son_kontrol,
    uyarilar: data.uyarilar.map(
      (u): Alert => ({
        tur: u.tur,
        indeks: u.indeks,
        indeksler: u.indeksler,
        oncelik: u.oncelik,
        baslik: u.baslik,
        mesaj: u.mesaj,
        oncekiTarih: u.onceki_tarih,
        sonTarih: u.son_tarih,
        degisimYuzde: u.degisim_yuzde,
      }),
    ),
    eksikCikti: data.eksik_cikti,
  }
}

export const indeksApi = {
  async get(gardenId: string): Promise<IndexData> {
    return fromApi(await apiRequest<ApiIndexOverview>(`/gardens/${gardenId}/indeks`))
  },
  async refresh(gardenId: string): Promise<Job | null> {
    const job = await apiRequest<{
      id: string
      tur: Job['tur']
      durum: JobStatus
      toplam: number
      islenen: number
      hata_mesaji: string | null
    }>(`/gardens/${gardenId}/indeks/refresh`, { method: 'POST' })
    return { id: job.id, tur: job.tur, durum: job.durum, toplam: job.toplam, islenen: job.islenen, hataMesaji: job.hata_mesaji }
  },
  zones(gardenId: string, indeks: IndexId, tarih: string): Promise<ZoneCollection> {
    return apiRequest<ZoneCollection>(`/gardens/${gardenId}/indeks/${indeks}/${tarih}/zones`)
  },
  async grid(gardenId: string, scene: Scene, indeks: IndexId): Promise<Grid> {
    if (!scene.satir || !scene.sutun || !scene.koordinatlar) throw new Error('Izgara bilgisi yok')
    const response = await apiRequestRaw(`/gardens/${gardenId}/indeks/${indeks}/${scene.tarih}.bin`)
    return parseGrid(await response.arrayBuffer(), scene.satir, scene.sutun, scene.koordinatlar as Corners)
  },
  async yieldZones(gardenId: string, indeks: 'ndvi' | 'msavi'): Promise<YieldZones> {
    const raw = await apiRequest<{
      indeks: 'ndvi' | 'msavi'
      gozlem_sayisi: number
      ilk_tarih: string
      son_tarih: string
      toplam_alan_m2: number
      bolgeler: YieldZones['bolgeler']
    }>(`/gardens/${gardenId}/verimlilik-bolgeleri?indeks=${indeks}`)
    return {
      indeks: raw.indeks,
      gozlemSayisi: raw.gozlem_sayisi,
      ilkTarih: raw.ilk_tarih,
      sonTarih: raw.son_tarih,
      toplamAlanM2: raw.toplam_alan_m2,
      bolgeler: raw.bolgeler,
    }
  },
}

/** Yetkili PNG adresi (mutlak). `v` görüntü yeniden üretilince önbelleği yeniler. */
export function layerImageUrl(gardenId: string, scene: Scene, layer: LayerId): string {
  const path = `${getApiBaseUrl()}/gardens/${gardenId}/indeks/${layer}/${scene.tarih}.png?v=${scene.surum}`
  return typeof window === 'undefined' ? path : new URL(path, window.location.origin).toString()
}

export const indeksKey = (gardenId: string) => ['indeks', gardenId] as const

const isActive = (job: Job | null | undefined) => job?.durum === 'bekliyor' || job?.durum === 'isleniyor'

/** İşleme sürerken 3 sn'de bir yenilenir; iş bitince bahçe listesi (rozet/silüet) de yenilenir. */
export function useIndices(gardenId: string | null) {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: gardenId ? indeksKey(gardenId) : ['indeks', 'none'],
    queryFn: () => indeksApi.get(gardenId as string),
    enabled: gardenId !== null,
    refetchInterval: (q) => (isActive(q.state.data?.isleme) ? 3000 : false),
    staleTime: 10_000,
  })

  const wasActive = useRef(false)
  const active = isActive(query.data?.isleme)
  useEffect(() => {
    if (wasActive.current && !active) {
      void client.invalidateQueries({ queryKey: GARDENS_KEY })
      // Ham ızgaralar yeni üretilmiş olabilir
      void client.invalidateQueries({ queryKey: ['grid'] })
    }
    wasActive.current = active
  }, [active, client])

  return query
}

export function useRefreshIndices(gardenId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => indeksApi.refresh(gardenId),
    onSuccess: () => client.invalidateQueries({ queryKey: indeksKey(gardenId) }),
  })
}

export const gridKey = (gardenId: string, indeks: IndexId, tarih: string, surum: number) =>
  ['grid', gardenId, indeks, tarih, surum] as const

/** Ham ızgara (kontrastlı mod, fark, karşılaştırma). Tarih başına bir kez indirilir ve önbelleklenir. */
export function useGrid(gardenId: string | null, scene: Scene | null, indeks: IndexId | null) {
  const ready = Boolean(gardenId && scene && indeks && scene.indeksler[indeks]?.veriVar)
  return useQuery({
    queryKey: ready ? gridKey(gardenId as string, indeks as IndexId, (scene as Scene).tarih, (scene as Scene).surum) : ['grid', 'none'],
    queryFn: () => indeksApi.grid(gardenId as string, scene as Scene, indeks as IndexId),
    enabled: ready,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  })
}

export function useZones(gardenId: string | null, indeks: IndexId, tarih: string | null, enabled = true) {
  return useQuery({
    queryKey: ['zones', gardenId, indeks, tarih],
    queryFn: () => indeksApi.zones(gardenId as string, indeks, tarih as string),
    enabled: enabled && gardenId !== null && tarih !== null,
    staleTime: 60_000,
  })
}

export function useYieldZones(gardenId: string | null, indeks: 'ndvi' | 'msavi', enabled: boolean) {
  return useQuery({
    queryKey: ['yield', gardenId, indeks],
    queryFn: () => indeksApi.yieldZones(gardenId as string, indeks),
    enabled: enabled && gardenId !== null,
    staleTime: 5 * 60_000,
    retry: false,
  })
}
