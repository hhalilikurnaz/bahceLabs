import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/apiClient'

/** Sulama planı (ADR 0023): FAO-56 günlük su dengesi. Katsayılar «ön değer · mühendis onayı bekliyor». Sunucudaki şemalarla birebir. */
export type SulamaSistemi = 'damla' | 'mini_yagmurlama' | 'salma'
export type Enerji = 'sebeke' | 'gunes' | 'dizel'

export interface SulamaProfil {
  sistem: SulamaSistemi
  damlatici_sayisi: number | null
  damlatici_debi_lh: number | null
  sira_aralik_m: number | null
  agac_aralik_m: number | null
  pompa_kw: number | null
  pompa_debi_m3h: number | null
  enerji: Enerji
  kwh_fiyat_tl: number | null
  enerji_m3_maliyet_tl: number | null
  su_ucreti_m3_tl: number | null
}
export interface Tarife {
  ad: string
  kaynak_url: string
  gecerlilik_baslangic: string | null
  gecerlilik_bitis: string | null
  birim_fiyat_tl_kwh: number | null
  guncel: boolean
  mesaj: string | null
}
export interface ProfilYaniti {
  profil: SulamaProfil | null
  alan_m2: number
  agac_sayisi: number | null
  agac_kontrol: { beyan: number | null; beklenen: number | null; tutarli: boolean | null; mesaj: string | null }
  tarife: Tarife
  fiyat_kaynagi: 'kullanici' | 'katalog' | 'yok'
}
export interface Maliyet {
  m3: number
  pompa_saat: number | null
  kwh: number | null
  enerji_tl: number | null
  su_ucreti_tl: number | null
  toplam_tl: number | null
  fiyat_kaynagi: 'kullanici' | 'katalog' | 'yok'
  eksik: string | null
}
export interface PlanGunu {
  tarih: string
  yagis_mm: number | null
  etkili_yagis_mm: number | null
  etc_mm: number | null
  uygulanan_net_mm: number
  planli_net_mm: number
  planli_brut_mm: number
  tukenme_mm: number
  tahmin: boolean
  veri_eksik: boolean
}
export interface Sulama {
  tarih: string
  net_mm: number
  brut_mm: number
  m3_bahce: number
  m3_dekar: number
  litre_agac: number | null
  emitor_dakika: number | null
}
export interface Aralik {
  alt: number
  orta: number
  ust: number
}
export interface AyCubugu {
  ay: number
  plan_m3: number
  uygulanan_m3: number | null
  gecen_yil_plan_m3: number | null
  tahmin: boolean
}
export interface PlanYaniti {
  durum: 'hazir' | 'profil_yok' | 'veri_yok'
  neden: string | null
  bugun: string
  on_deger: boolean
  taw_mm: number | null
  raw_mm: number | null
  orten_yuzde: number | null
  kc_bugun: number | null
  sistem_verimi: number | null
  gunler: PlanGunu[]
  sulamalar: Sulama[]
  sonraki: Sulama | null
  uyarilar: { kod: string; mesaj: string }[]
  hafta_maliyet: Maliyet | null
  planlanan_bugune_kadar_m3: number | null
  uygulanan_sezon_m3: number | null
  uygulanan_kayit_sayisi: number
  sapma_mm: number | null
  sapma_ciddi: boolean
  projeksiyon: { yil_sayisi: number; ilk_yil: number; son_yil: number; m3: Aralik | null; tl: Aralik | null; alt_yuzde: number; ust_yuzde: number } | null
  aylik: AyCubugu[]
  kaynaklar: { ad: string; not: string | null }[]
  katalog_surum: number
}
export interface SezonGunu {
  tarih: string
  tukenme_mm: number
  yagis_mm: number
  brut_mm: number
  kumulatif_m3: number
  kumulatif_tl: number | null
  stres: boolean
}
export interface SezonYaniti {
  yil: number
  taw_mm: number
  raw_mm: number
  gunler: SezonGunu[]
  toplam_m3: number
  toplam_tl: number | null
  sulama_sayisi: number
  yagis_mm: number
  stres_gun: number
  tahmin_dahil: boolean
}
export interface Toplam {
  m3: number
  kwh: number | null
  tl: number | null
  sulama_sayisi: number
  stres_gun: number
}
export interface YilSonucu {
  yil: number
  m3: number
  tl: number | null
  yagis_mm: number
  et0_mm: number
}
export interface SenaryoYaniti {
  durum: 'hazir' | 'profil_yok' | 'veri_yok'
  neden: string | null
  aliskanlik: { yil: number; plan: Toplam; aliskanlik: Toplam; fark_m3: number; fark_tl: number | null; ozet: string } | null
  kuru_islak: { secili: YilSonucu; ortanca: YilSonucu | null; yillar: YilSonucu[]; fark_m3: number | null; fark_tl: number | null } | null
  kisinti: {
    yil: number
    uygulanabilir: boolean
    tam: Toplam
    kisintili: Toplam | null
    tasarruf_m3: number | null
    tasarruf_tl: number | null
    verim_riski: 'dusuk' | 'orta' | 'yuksek' | null
    kilitli_donemler: { kod: string; ad: string; baslangic: string; bitis: string; mesaj: string }[]
    onayli_donemler: string[]
    mesaj: string
  } | null
  sistem: { yil: number; mevcut: SulamaSistemi; hedef: SulamaSistemi; mevcut_toplam: Toplam; hedef_toplam: Toplam; fark_m3: number; fark_kwh: number | null; fark_tl: number | null; yatirim_tl: number | null; geri_odeme_sezon: number | null; not: string } | null
  kaynaklar: { ad: string; not: string | null }[]
}
export interface SenaryoGirdisi {
  yil?: number
  gunler?: number[]
  saat?: number
  hedef?: SulamaSistemi
  yatirim_tl?: number
}

export function useSulamaProfili(gardenId: string | null) {
  return useQuery({ queryKey: ['sulama-profil', gardenId], queryFn: () => apiRequest<ProfilYaniti>(`/gardens/${gardenId}/sulama-profili`), enabled: gardenId !== null, staleTime: 60_000 })
}
export function useSulamaPlani(gardenId: string | null) {
  return useQuery({ queryKey: ['sulama-plani', gardenId], queryFn: () => apiRequest<PlanYaniti>(`/gardens/${gardenId}/sulama-plani`), enabled: gardenId !== null, staleTime: 5 * 60_000 })
}
export function useSulamaSezon(gardenId: string | null, yil: number | null, etkin = true) {
  return useQuery({ queryKey: ['sulama-sezon', gardenId, yil], queryFn: () => apiRequest<SezonYaniti>(`/gardens/${gardenId}/sulama-sezon${yil ? `?yil=${yil}` : ''}`), enabled: gardenId !== null && etkin, staleTime: 10 * 60_000, retry: false })
}
export function useSulamaSenaryolari(gardenId: string | null, g: SenaryoGirdisi, etkin = true) {
  const q = new URLSearchParams()
  if (g.yil) q.set('yil', String(g.yil))
  if (g.gunler?.length && g.saat) {
    q.set('gunler', g.gunler.join(','))
    q.set('saat', String(g.saat))
  }
  if (g.hedef) q.set('hedef', g.hedef)
  if (g.yatirim_tl !== undefined) q.set('yatirim_tl', String(g.yatirim_tl))
  return useQuery({ queryKey: ['sulama-senaryo', gardenId, q.toString()], queryFn: () => apiRequest<SenaryoYaniti>(`/gardens/${gardenId}/sulama-senaryolar?${q}`), enabled: gardenId !== null && etkin, staleTime: 10 * 60_000, placeholderData: (onceki) => onceki })
}
export function useSulamaProfiliKaydet(gardenId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (govde: SulamaProfil) => apiRequest<ProfilYaniti>(`/gardens/${gardenId}/sulama-profili`, { method: 'PUT', body: JSON.stringify(govde) }),
    onSuccess: () => {
      for (const k of ['sulama-profil', 'sulama-plani', 'sulama-sezon', 'sulama-senaryo']) void qc.invalidateQueries({ queryKey: [k, gardenId] })
    },
  })
}
