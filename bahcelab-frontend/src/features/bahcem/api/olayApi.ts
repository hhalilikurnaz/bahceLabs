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
  /** yalnız don: «yeniden değerlendirildi» işareti (olay silinmez; ADIM 10) */
  yeniden_degerlendirme?: { sonuc: string; aciklama: string | null; model_en_dusuk_c: number | null; istasyon_en_dusuk_c: number | null; kural_surum: string; yeniden_degerlendirildi: boolean } | null
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

/** Olay etiketi (yeniden değerlendirme sonucu) kullanıcı dili; hasar raporunda da aynı açıklık. */
export const OLAY_ETIKET_AD: Record<string, string> = {
  istasyon_destekliyor: 'İstasyon destekliyor',
  dis_kayit_destekliyor: 'Kamu kaydı destekliyor',
  model_sapmasi_olasi: 'Model sapması olası',
  belirsiz: 'Belirsiz',
  kanit_yok: 'Kanıt yok',
}
