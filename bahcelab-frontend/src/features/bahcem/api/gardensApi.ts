import { ApiError, apiRequest } from '@/lib/apiClient'
import type { Garden, GardenGeometry, GardenInput, GardenPatch, Urun } from './types'

interface ApiGarden {
  id: string
  ad: string
  urun: Urun
  cesit: string | null
  dikim_yili: number | null
  agac_sayisi: number | null
  geometry: GardenGeometry
  alan_dekar: number
  il: string | null
  ilce: string | null
  created_at: string
  son_ndvi_ortalama: number | null
  son_ndvi_tarihi: string | null
}

function fromApi(garden: ApiGarden): Garden {
  return {
    id: garden.id,
    ad: garden.ad,
    urun: garden.urun,
    cesit: garden.cesit,
    dikimYili: garden.dikim_yili,
    agacSayisi: garden.agac_sayisi,
    geometry: garden.geometry,
    alanDekar: garden.alan_dekar,
    il: garden.il,
    ilce: garden.ilce,
    createdAt: garden.created_at,
    sonNdviOrtalama: garden.son_ndvi_ortalama,
    sonNdviTarihi: garden.son_ndvi_tarihi,
  }
}

const toApi = (patch: GardenPatch) => {
  const body: Record<string, unknown> = {}
  if ('ad' in patch) body.ad = patch.ad
  if ('urun' in patch) body.urun = patch.urun
  if ('cesit' in patch) body.cesit = patch.cesit
  if ('dikimYili' in patch) body.dikim_yili = patch.dikimYili
  if ('agacSayisi' in patch) body.agac_sayisi = patch.agacSayisi
  if ('geometry' in patch) body.geometry = patch.geometry
  if ('il' in patch) body.il = patch.il
  if ('ilce' in patch) body.ilce = patch.ilce
  return JSON.stringify(body)
}

export const gardensApi = {
  async list(): Promise<Garden[]> {
    return (await apiRequest<ApiGarden[]>('/gardens')).map(fromApi)
  },

  async create(input: GardenInput): Promise<Garden> {
    return fromApi(await apiRequest<ApiGarden>('/gardens', { method: 'POST', body: toApi(input) }))
  },

  async update(id: string, patch: GardenPatch): Promise<Garden> {
    return fromApi(
      await apiRequest<ApiGarden>(`/gardens/${id}`, { method: 'PATCH', body: toApi(patch) }),
    )
  },

  async remove(id: string): Promise<void> {
    await apiRequest<void>(`/gardens/${id}`, { method: 'DELETE' })
  },

  /** Kaydetmeden önce sınırı doğrular, alanı sunucuda hesaplatır. Geçersizse ApiError fırlatır. */
  async measure(geometry: GardenGeometry): Promise<{ alanDekar: number; alanM2: number }> {
    const result = await apiRequest<{ alan_dekar: number; alan_m2: number }>('/gardens/measure', {
      method: 'POST',
      body: JSON.stringify({ geometry }),
    })
    return { alanDekar: result.alan_dekar, alanM2: result.alan_m2 }
  },
}

/** Sunucu hatasını kullanıcıya gösterilecek Türkçe metne çevirir. */
export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    const errors = err.details.errors as { msg?: string }[] | undefined
    const first = errors?.[0]?.msg
    if (err.status === 422 && first) return first.replace(/^Value error, /, '')
    return err.message
  }
  return 'Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.'
}
