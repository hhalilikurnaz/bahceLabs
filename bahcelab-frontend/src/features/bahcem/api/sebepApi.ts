import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/apiClient'

/** Olası sebep ayrıştırma (ADIM 10B, ADR 0033): kural tabanlı, açıklanabilir; yüzde YOK. Ağırlıklar ön değer · mühendis onayı bekliyor. */
export type SebepGuven = 'daha_olasi' | 'olasi' | 'zayif' | 'belirsiz'
export type SebepKodu = 'don' | 'su' | 'goruntu'
export type KontrolSebep = SebepKodu | 'besin' | 'hastalik' | 'mekanik'
export type SebepYanitKodu = 'su' | 'don' | 'besin' | 'hastalik_zararli' | 'budama_hasat' | 'bilmiyorum'

export interface SebepKanit {
  kod: string
  yon: 'lehte' | 'aleyhte'
  metin: string
  /** bagimsiz:istasyon|dis_kayit|kullanici · bagimli:model|uydu|radar */
  bagimsizlik: string
  tur: 'dogrudan' | 'destekleyici' | 'dislayici'
  baglanti: string | null
}
export interface SebepSirasi {
  sebep: SebepKodu
  ad: string
  dogrudan_kanit: number
  bagimsiz_kanit: number
  kanitlar: SebepKanit[]
}
export interface KontrolMaddesi { metin: string; kaynak: string | null; url: string | null }
export interface SebepCikti {
  surum: string
  durum: string
  aciklama: string
  secim: SebepKodu | null
  secim_ad: string | null
  guven: SebepGuven
  guven_dusuruldu: boolean
  belirsiz_nedeni: string | null
  kapi: { kapali: boolean; mesaj: string | null; beklenen_gecis: string | null; beklenen_gecis_tahmini: boolean }
  siralama: SebepSirasi[]
  kontrol_listesi: Record<KontrolSebep, { ad: string; maddeler: KontrolMaddesi[] }>
  secilemeyen: string[]
  olay: { id: string; anahtar: string; tarih: string }
  kullanici_yaniti: SebepYanitKodu | null
}

export const KAPI_BASLIK = 'Görüntü kaynaklı olabilir'

export const GUVEN_SOZ: Record<SebepGuven, string> = { daha_olasi: 'daha olası', olasi: 'olası', zayif: 'zayıf olasılık', belirsiz: 'belirsiz' }

/** Kanıt satırı bağımsızlık etiketi (döngüsellik açık): bağımsız = istasyon · kamu kaydı · kullanıcı yanıtı; bağımlı = model/ERA5 · uydu · radar. */
export const BAGIMSIZLIK_AD: Record<string, string> = {
  'bagimsiz:istasyon': 'bağımsız · istasyon',
  'bagimsiz:dis_kayit': 'bağımsız · kamu kaydı',
  'bagimsiz:kullanici': 'bağımsız · sizin yanıtınız',
  'bagimli:model': 'bağımlı · model (ERA5)',
  'bagimli:uydu': 'bağımlı · uydu',
  'bagimli:radar': 'bağımlı · radar',
}

export const SEBEP_YANITLARI: { kod: SebepYanitKodu; ad: string }[] = [
  { kod: 'su', ad: 'Su' },
  { kod: 'don', ad: 'Don' },
  { kod: 'besin', ad: 'Besin' },
  { kod: 'hastalik_zararli', ad: 'Hastalık / zararlı' },
  { kod: 'budama_hasat', ad: 'Budama / hasat' },
  { kod: 'bilmiyorum', ad: 'Bilmiyorum' },
]

export const useOlaySebep = (gardenId: string | null, olayId: string | null) =>
  useQuery({
    queryKey: ['sebep', gardenId, olayId],
    queryFn: () => apiRequest<SebepCikti>(`/gardens/${gardenId}/olaylar/${olayId}/sebep`),
    enabled: gardenId !== null && olayId !== null,
    staleTime: 60_000,
    retry: false,
  })

/** «Sebep buydu» yanıtı → etiket tablosu + Saha Defteri + 9J kural performansı. */
export function useSebepYaniti(gardenId: string, olayId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sebep: SebepYanitKodu) => apiRequest<void>(`/gardens/${gardenId}/olaylar/${olayId}/sebep-yaniti`, { method: 'POST', body: JSON.stringify({ sebep }) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sebep', gardenId, olayId] })
      void qc.invalidateQueries({ queryKey: ['saha-kayitlari', gardenId] })
    },
  })
}
