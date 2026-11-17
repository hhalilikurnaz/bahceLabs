import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest, apiRequestRaw } from '@/lib/apiClient'

/** Gece don riski ve topografya (ADIM 10, ADR 0031/0032). Kullanıcıya SÖZCÜK gösterilir (düşük / orta / yüksek); sayısal olasılık API'de yoktur. */
export type DonSeviye = 'yok' | 'izle' | 'uyari'
export type DonYanit = 'oldu' | 'olmadi' | 'bilmiyorum'

export interface DonGecesi {
  gece: string
  sabah: string
  olasilik_sozu: 'düşük' | 'orta' | 'yüksek'
  seviye: DonSeviye
  kritik_c: number
  evre: string
  organlar: string[]
  organ_adlari: string[]
  en_soguk_c: number
  en_soguk_saat: number | null
  model_tmin: Record<string, number>
  uzlasi_model: number
  neden: string
  uretildi: string
  saat_kritik_alti: number
  geri_bildirim: DonYanit | null
}
export interface DonOnlem {
  kod: string
  ad: string
  ne: string
  kosullar: string[]
  uyarilar: string[]
  kaynak: string
  url: string
}
export interface DonTopografya {
  profil: Record<string, number>
  konum: { sinif: 'cukur' | 'yamac' | 'sirt' | 'duz'; sinif_adi: string; baki_adi: string; cumle: string; esikler: string }
  bahce_ici: { uygun: boolean; neden?: string | null; rolyef_m?: number; egim_ort_der?: number; piksel?: number; aciklama?: string } | null
  hesaplandi: string
  kaynak: string
  not: string
}
export interface DonYaniti {
  geceler: DonGecesi[]
  onlemler: DonOnlem[]
  onlem_notu: string | null
  dun_soru: { gece: string; soru: string; secenekler: DonYanit[] } | null
  topografya: DonTopografya | null
  temkin_notu: string
  nasil: string
  esik_durumu: string
  kural_surum: string
  veri_yok_nedeni: string | null
}
export interface GoreliSoguk {
  uygun: boolean
  neden: string | null
  aciklama: string | null
  geojson: GeoJSON.FeatureCollection | null
  hucre_sayisi: number
  rolyef_m: number | null
  egim_ort_der: number | null
  rolyef_min_m: number | null
  egim_min_der: number | null
}

export const useDon = (gardenId: string | null) =>
  useQuery({ queryKey: ['don', gardenId], queryFn: () => apiRequest<DonYaniti>(`/gardens/${gardenId}/don`), enabled: gardenId !== null, staleTime: 5 * 60_000 })

export const useGoreliSoguk = (gardenId: string | null) =>
  useQuery({ queryKey: ['don-goreli', gardenId], queryFn: () => apiRequest<GoreliSoguk>(`/gardens/${gardenId}/don/goreli-soguk`), enabled: gardenId !== null, staleTime: 10 * 60_000 })

/** «Don oldu mu?» yanıtı → 9J kural performansı + Saha Defteri */
export function useDonGeriBildirim(gardenId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { gece: string; yanit: DonYanit }) => apiRequest<void>(`/gardens/${gardenId}/don/geri-bildirim`, { method: 'POST', body: JSON.stringify(v) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['don', gardenId] })
      void qc.invalidateQueries({ queryKey: ['saha-kayitlari', gardenId] })
    },
  })
}

/** Hasar raporu PDF taslağını indirir (tarayıcıda dosya olarak kaydedilir). */
export async function hasarRaporuIndir(gardenId: string, olayId: string): Promise<void> {
  const r = await apiRequestRaw(`/gardens/${gardenId}/olaylar/${olayId}/hasar-raporu`)
  const blob = await r.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') ?? '')?.[1] ?? 'don-hasar-raporu.pdf'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export const sayiTr = (x: number, n = 1): string => x.toLocaleString('tr-TR', { minimumFractionDigits: n, maximumFractionDigits: n })
