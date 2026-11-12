import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/apiClient'

/** İç kalite ekranı (9I Dilim 1A, ADR 0028): kullanıcı API'si DEĞİL; sunucuda INTERNAL_EMAILS ile sınırlı (aksi 403). */
export interface EtaDurum {
  garden_id: string
  ad: string
  alan_dekar: number | null
  kapi: 'acik' | 'kapali'
  neden: string
  tutarlilik_p90: number | null
  tutarlilik_medyan: number | null
  cift_sayisi: number
  esik: number
  sahne_sayisi: number
  hesaplanan: number
  guncelleme: string
}
export interface EtaSahne {
  tarih: string
  sahne_id: string
  platform: string | null
  durum: 'ham' | 'hesaplandi' | 'elendi'
  neden: string | null
  gecerli_oran: number
  bahce_piksel: number
  ic_piksel: number
  karisik_pay: number
  termal_m: number | null
  lst_k: number | null
  ndvi: number | null
  dt_k: number | null
  c_sahne: number | null
  c_uzun: number | null
  tc_k: number | null
  etf: number | null
  etf_ic: number | null
  etf_sigma: number | null
  et0_mm: number | null
  eta_mm: number | null
  delta_etf: number | null
}
export interface EtaBaglam { bas: string; bit: string; et_mm_gun: number | null; piksel_dokunan: number; piksel_gecerli: number; piksel_m: number | null }
export interface EtaDogrulama { tarih: string; sahne_id: string; et_mm_gun: number | null; piksel_gecerli: number; piksel_dokunan: number }
export interface EtaKalibrasyon { tur: string; anahtar: string; deger: number | null; yayilim: number | null; n: number }
export interface EtaDetay { durum: EtaDurum | null; sahneler: EtaSahne[]; baglam: EtaBaglam[]; dogrulama: EtaDogrulama[]; kalibrasyon: EtaKalibrasyon[]; notlar: string[] }

export const useEtaBahceler = () => useQuery({ queryKey: ['ic-eta', 'bahceler'], queryFn: () => apiRequest<EtaDurum[]>('/ic/eta/bahceler'), retry: false })
export const useEtaDetay = (id: string | null) => useQuery({ queryKey: ['ic-eta', id], queryFn: () => apiRequest<EtaDetay>(`/ic/eta/bahceler/${id}`), enabled: id !== null, retry: false })
