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

export interface AkisSatiri { akis: string; ad: string; durum: 'taze' | 'gecikmeli' | 'kopuk' | 'bos'; son_veri: string | null; gecikme_gun: number | null; bosluk_gun: number | null; son_basari: string | null; beklenen_gun: number; kabul_gecikme_gun: number; kopuk_gun: number; neden: string }
export interface AkisNokta { akis: string; tarih: string; gecikme_gun: number | null; durum: AkisSatiri['durum'] }
export interface AkislarYanit { bugun: string; guncel: AkisSatiri[]; zaman: AkisNokta[] }
export interface UyumNokta { tarih: string; deger: number | null; taban: number | null; sapma: number | null; n: number; durum: 'uyumlu' | 'drift' | 'yetersiz' }
export interface UyumSeri { kontrol: string; garden_id: string | null; bahce: string | null; esik: number; son_durum: UyumNokta['durum']; noktalar: UyumNokta[] }
export interface UyumYanit { seriler: UyumSeri[] }
export interface KuralSatiri { kural: string; ad: string; ay: string; uretilen: number; yanit: number; yanit_orani: number | null; isabet_n: number; isabet: number | null; durum: 'olculuyor' | 'olculemiyor'; neden: string }
export interface KuralOzet { kural: string; ad: string; uretilen: number; yanit: number; isabet: number | null; durum: 'olculuyor' | 'olculemiyor' }
export interface KurallarYanit { bas: string; bit: string; aylik: KuralSatiri[]; ozet: KuralOzet[] }
export interface BahceGuven { garden_id: string; ad: string; etiket: 'yuksek' | 'orta' | 'dusuk'; puan: number; toplam: number; nedeni: string; eksik: string[] }
export interface BahcelerYanit { bugun: string; dagilim: Record<'yuksek' | 'orta' | 'dusuk', number>; en_dusuk: BahceGuven[]; toplam_bahce: number }

const izle = <T,>(yol: string) => ({ queryKey: ['ic-izleme', yol], queryFn: () => apiRequest<T>(`/ic/izleme/${yol}`), retry: false })
export const useAkislar = () => useQuery(izle<AkislarYanit>('akislar'))
export const useUyum = () => useQuery(izle<UyumYanit>('uyum'))
export const useKurallar = () => useQuery(izle<KurallarYanit>('kurallar'))
export const useBahceler = () => useQuery(izle<BahcelerYanit>('bahceler'))
