import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/apiClient'
import type { LayerId } from '../lib/indices'
import { absoluteApiUrl } from './overviewApi'
import type { ApiArchive, ApiArchiveScene } from './dto/ndvi'

export interface ArchiveScene {
  tarih: string
  durum: 'tamam' | 'bulutlu'
  deger: number | null
  bulutOrani: number | null
  net: boolean
  enNet: boolean
  /** Mutlak küçük resim adresi (yetkili, çerezli istek) */
  kucukResimUrl: string | null
  hamVeriVar: boolean
}

export interface Archive {
  parametre: string
  sezon: number
  sezonlar: number[]
  toplam: number
  netSayisi: number
  bulutluSayisi: number
  sayfa: number
  sayfaSayisi: number
  sahneler: ArchiveScene[]
}

const mapScene = (s: ApiArchiveScene): ArchiveScene => ({
  tarih: s.tarih,
  durum: s.durum,
  deger: s.deger,
  bulutOrani: s.bulut_orani,
  net: s.net,
  enNet: s.en_net,
  kucukResimUrl: s.kucuk_resim_url ? absoluteApiUrl(s.kucuk_resim_url) : null,
  hamVeriVar: s.ham_veri_var,
})

export const archiveApi = {
  async get(gardenId: string, parametre: LayerId, sezon: number | null, sayfa: number): Promise<Archive> {
    const params = new URLSearchParams({ parametre, sayfa: String(sayfa) })
    if (sezon !== null) params.set('sezon', String(sezon))
    const raw = await apiRequest<ApiArchive>(`/gardens/${gardenId}/indeks/arsiv?${params}`)
    return {
      parametre: raw.parametre,
      sezon: raw.sezon,
      sezonlar: raw.sezonlar,
      toplam: raw.toplam,
      netSayisi: raw.net_sayisi,
      bulutluSayisi: raw.bulutlu_sayisi,
      sayfa: raw.sayfa,
      sayfaSayisi: raw.sayfa_sayisi,
      sahneler: raw.sahneler.map(mapScene),
    }
  },
}

/** Sezon boyunca tüm sayfalar kullanıcı kaydırdıkça değil sayfa sayfa istenir (ilk sayfa hızlı gelir). */
export function useArchive(gardenId: string | null, parametre: LayerId, sezon: number | null, sayfa: number) {
  return useQuery({
    queryKey: ['arsiv', gardenId, parametre, sezon, sayfa],
    queryFn: () => archiveApi.get(gardenId as string, parametre, sezon, sayfa),
    enabled: gardenId !== null,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}
