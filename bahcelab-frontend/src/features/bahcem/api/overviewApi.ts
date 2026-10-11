import { useQuery } from '@tanstack/react-query'
import { apiRequest, getApiBaseUrl } from '@/lib/apiClient'
import type { ApiGardenOverview, ApiGardenStatus, ApiOverviewAlert, ApiOverviewResponse } from './dto/overview'
import { GARDENS_KEY } from './useGardens'

export type GardenStatus = ApiGardenStatus

export interface OverviewAlert {
  kaynak: ApiOverviewAlert['kaynak']
  tur: ApiOverviewAlert['tur']
  seviye: ApiOverviewAlert['seviye']
  baslik: string
}

export interface GardenOverview {
  id: string
  ad: string
  urun: string
  cesit: string | null
  dekar: number
  il: string | null
  ilce: string | null
  durum: GardenStatus
  durumNedeni: string | null
  indeks: string
  sonGoruntu: { tarih: string; kucukResimUrl: string } | null
  seri: { tarih: string; deger: number }[]
  uyarilar: OverviewAlert[]
  hava: { sicaklik: number; kod: number; aciklama: string; ikon: string; guncelleme: string; bayat: boolean } | null
}

export interface OverviewData {
  toplamlar: { bahceSayisi: number; toplamDekar: number; dikkatSayisi: number; izleSayisi: number }
  bahceler: GardenOverview[]
}

/** API'nin göreli küçük resim adresini tarayıcının yükleyebileceği mutlak adrese çevirir. */
export function absoluteApiUrl(path: string): string {
  const full = `${getApiBaseUrl()}${path}`
  return typeof window === 'undefined' ? full : new URL(full, window.location.origin).toString()
}

function mapGarden(g: ApiGardenOverview): GardenOverview {
  return {
    id: g.id,
    ad: g.ad,
    urun: g.urun,
    cesit: g.cesit,
    dekar: g.dekar,
    il: g.il,
    ilce: g.ilce,
    durum: g.durum,
    durumNedeni: g.durum_nedeni,
    indeks: g.indeks,
    sonGoruntu: g.son_goruntu
      ? { tarih: g.son_goruntu.tarih, kucukResimUrl: absoluteApiUrl(g.son_goruntu.kucuk_resim_url) }
      : null,
    seri: g.seri,
    uyarilar: g.uyarilar,
    hava: g.hava,
  }
}

export const overviewApi = {
  async get(indeks = 'ndvi'): Promise<OverviewData> {
    const data = await apiRequest<ApiOverviewResponse>(`/gardens/overview?indeks=${indeks}`)
    return {
      toplamlar: {
        bahceSayisi: data.toplamlar.bahce_sayisi,
        toplamDekar: data.toplamlar.toplam_dekar,
        dikkatSayisi: data.toplamlar.dikkat_sayisi,
        izleSayisi: data.toplamlar.izle_sayisi,
      },
      bahceler: data.bahceler.map(mapGarden),
    }
  },
}

/** Bahçe listesi ve harita genel görünümü bu tek isteği paylaşır (bahçe değişince `GARDENS_KEY` ile birlikte yenilenir). */
export const OVERVIEW_KEY = [...GARDENS_KEY, 'overview'] as const

export function useGardensOverview() {
  return useQuery({
    queryKey: OVERVIEW_KEY,
    queryFn: () => overviewApi.get('ndvi'),
    staleTime: 60_000,
    retry: 1,
  })
}
