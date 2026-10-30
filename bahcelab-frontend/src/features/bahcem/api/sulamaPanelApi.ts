import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/apiClient'
import type { SulamaSistemi } from './sulamaApi'

/** Sulama paneli (9H-S4): vanalar (sektörler), panel (Bugün), simülasyon. Sunucu şemalarıyla birebir; katsayılar «ön değer · mühendis onayı bekliyor». */
export type DurumEtiketi = 'stres' | 'yakin' | 'yeterli' | 'dolu'
export type AgacKaynak = 'sektor' | 'orantili' | 'beyan' | 'yok'

export interface SektorGunu {
  tarih: string
  doluluk_pct: number | null
  etc_mm: number | null
  eta_mm: number | null
  net_mm: number
  brut_mm: number
  yagis_mm: number | null
  etkili_yagis_mm: number | null
  bosa_mm: number
  ks: number | null
  planli: boolean
  uygulandi: boolean
  tahmin: boolean
  veri_eksik: boolean
}
export interface SektorDurumu {
  id: string | null
  ad: string
  alan_dekar: number
  agac_sayisi: number | null
  agac_kaynak: AgacKaynak
  vana_debi_m3h: number | null
  doluluk_pct: number | null
  etiket: DurumEtiketi | null
  sonraki_sulama: string | null
  esik_alti_7gun: boolean
  gunler: SektorGunu[]
}
export interface VardiyaKalemi {
  sektor: string
  baslangic: string | null
  bitis: string | null
  sure_dk: number | null
  m3: number
  brut_mm: number
  litre_agac: number | null
  emitor_dakika: number | null
}
export interface Vardiya {
  tarih: string
  baslangic: string
  kalemler: VardiyaKalemi[]
  toplam_m3: number
  onayli: boolean
  zaman_notu: string | null
}
export interface Guven {
  etiket: 'dusuk' | 'orta' | 'yuksek'
  puan: number
  toplam: number
  kosullar: { ad: string; ok: boolean; not: string | null }[]
}
export interface PanelYaniti {
  durum: 'hazir' | 'profil_yok' | 'veri_yok'
  neden: string | null
  bugun: string
  taw_mm: number | null
  raw_mm: number | null
  stres_pct: number
  yakin_pct: number
  yeterli_pct: number
  tetik_pct: number | null
  sektorler: SektorDurumu[]
  sektor_tanimli: boolean
  kpi: {
    sonraki: { tarih: string; gun_sonra: number; vanalar: string[] } | null
    ihtiyac_karsilandi_pct: number | null
    ihtiyac_renk: 'yesil' | 'sari' | 'kirmizi' | null
    sezon_m3: number | null
    sezon_hedef_pct: number | null
    sezon_kaynak: 'uygulanan' | 'planlanan' | null
  } | null
  hafta: { tarih: string; ort_doluluk_pct: number | null; yagis_mm: number | null; sulama: boolean }[]
  vardiya: Vardiya | null
  en_dusuk: { ad: string; pct: number } | null
  esik_alti_sektorler: string[]
  uyarilar: { kod: string; mesaj: string }[]
  guven: Guven | null
  kaynaklar: { ad: string; not: string | null }[]
  yagis_vurgu_mm: number
  katalog_surum: number
  onayli_tarih: string | null
}
export interface SimSayac {
  m3: number
  kwh: number | null
  tl: number | null
  fiyat_kaynagi: 'kullanici' | 'katalog' | 'yok'
  eksik: string | null
  stres_gun: number
  bosa_m3: number
  sulama_gunu: number
}
export interface SimulasyonYaniti {
  durum: 'hazir' | 'profil_yok' | 'veri_yok'
  neden: string | null
  yil: number | null
  mod: 'plan' | 'aliskanlik'
  sistem: SulamaSistemi | null
  yillar: { yil: number; tip: 'kuru' | 'normal' | 'islak' | null; yagis_mm: number }[]
  gunler: { tarih: string; yagis_mm: number; et0_mm: number; sulama: boolean }[]
  sektorler: { ad: string; doluluk_pct: (number | null)[]; brut_mm: number[]; stres: boolean[] }[]
  vardiyalar: Vardiya[]
  sayac: SimSayac | null
  karsilastirma: { plan: SimSayac; aliskanlik: SimSayac } | null
  karsilastirma_cumle: string | null
  aliskanlik: { kaynak: 'kayit' | 'elle'; gunler: number[]; brut_mm: number; kayit_sayisi: number } | null
  aliskanlik_neden: string | null
  kisinti_uygulandi: boolean
  kilitli_donemler: { kod: string; ad: string; baslangic: string; bitis: string; mesaj: string }[]
  kaynaklar: { ad: string; not: string | null }[]
}
export interface SimGirdisi {
  yil?: number
  mod: 'plan' | 'aliskanlik'
  sistem?: SulamaSistemi
  kisinti: boolean
  kwh_fiyat?: number
  gunler?: number[]
  saat?: number
}
export interface SektorKaydi {
  id: string | null
  ad: string
  geometry: GeoJSON.Polygon | null
  alan_m2: number
  alan_dekar: number
  agac_sayisi: number | null
  agac_kaynak: AgacKaynak
  sira_aralik_m: number | null
  agac_aralik_m: number | null
  vana_debi_m3h: number | null
}

export function useSulamaPanel(gardenId: string | null) {
  return useQuery({ queryKey: ['sulama-panel', gardenId], queryFn: () => apiRequest<PanelYaniti>(`/gardens/${gardenId}/sulama-panel`), enabled: gardenId !== null, staleTime: 2 * 60_000 })
}
export function useSulamaSimulasyon(gardenId: string | null, g: SimGirdisi, etkin = true) {
  const q = new URLSearchParams({ mod: g.mod, kisinti: String(g.kisinti) })
  if (g.yil) q.set('yil', String(g.yil))
  if (g.sistem) q.set('sistem', g.sistem)
  if (g.kwh_fiyat !== undefined) q.set('kwh_fiyat', String(g.kwh_fiyat))
  if (g.gunler?.length && g.saat) {
    q.set('gunler', g.gunler.join(','))
    q.set('saat', String(g.saat))
  }
  return useQuery({ queryKey: ['sulama-sim', gardenId, q.toString()], queryFn: () => apiRequest<SimulasyonYaniti>(`/gardens/${gardenId}/sulama-simulasyon?${q}`), enabled: gardenId !== null && etkin, staleTime: 10 * 60_000, placeholderData: (onceki) => onceki })
}
export function useSulamaSektorleri(gardenId: string | null) {
  return useQuery({ queryKey: ['sulama-sektor', gardenId], queryFn: () => apiRequest<{ tanimli: boolean; sektorler: SektorKaydi[]; not: string | null }>(`/gardens/${gardenId}/sulama-sektorleri`), enabled: gardenId !== null, staleTime: 60_000 })
}

function useYenile(gardenId: string) {
  const qc = useQueryClient()
  return () => {
    for (const k of ['sulama-panel', 'sulama-plani', 'sulama-sim', 'sulama-sektor', 'su', 'saha-kayitlari', 'today']) void qc.invalidateQueries({ queryKey: [k, gardenId] })
    void qc.invalidateQueries({ queryKey: ['saha'] })
  }
}
export function useSulamaOnayla(gardenId: string) {
  const yenile = useYenile(gardenId)
  return useMutation({ mutationFn: (tarih: string) => apiRequest<PanelYaniti>(`/gardens/${gardenId}/sulama-onay`, { method: 'POST', body: JSON.stringify({ tarih }) }), onSuccess: yenile })
}
export function useSulamaIsle(gardenId: string) {
  const yenile = useYenile(gardenId)
  return useMutation({ mutationFn: (tarih: string) => apiRequest<{ yazilan: number }>(`/gardens/${gardenId}/sulama-isle`, { method: 'POST', body: JSON.stringify({ tarih }) }), onSuccess: yenile })
}
