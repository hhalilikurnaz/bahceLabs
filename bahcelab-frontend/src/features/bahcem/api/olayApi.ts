import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/apiClient'

/** Olay motoru kayıtları (ADR 0018): don, aşırı yağış, rüzgâr, optik düşüş, radar; birleşen olay (don + optik hasar izi) TEK satırdır. */
export interface Olay {
  id: string
  tur: string
  tur_adi: string
  turler: string[]
  baslangic: string
  bitis: string
  alan_da: number | null
  guven: 'dusuk' | 'orta' | 'yuksek'
  siddet: string | null
  katman: string | null
  tahmin: boolean
  kaynak_sayisi: number
  durum: 'olay' | 'bekliyor' | 'suphe'
  neden: string | null
  /** çiftçinin «Uydu haklı mıydı?» yanıtı (Saha Defteri); yoksa null */
  dogrulama: 'gerceklesti' | 'gerceklesmedi' | 'bilinmiyor' | null
}
export interface Olaylar {
  olaylar: Olay[]
  supheler: Olay[]
  not_: string
}

/** `baslangic` verilmezse tüm geçmiş (2015→). */
export function useOlaylar(gardenId: string | null, baslangic?: string) {
  return useQuery({
    queryKey: ['olaylar', gardenId, baslangic ?? null],
    queryFn: () => apiRequest<Olaylar>(`/gardens/${gardenId}/olaylar${baslangic ? `?baslangic=${baslangic}` : ''}`),
    enabled: gardenId !== null,
    staleTime: 60_000,
  })
}

export const GUVEN_AD: Record<Olay['guven'], string> = { yuksek: 'güven yüksek', orta: 'güven orta', dusuk: 'güven düşük' }
