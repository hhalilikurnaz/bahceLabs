import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/apiClient'
import type { ApiBugun, ApiDurum, ApiFenoloji, ApiKatalog, ApiKuralMeta, ApiSeriler } from './dto/agro'

export type RuleStatus = 'dogrulanmadi' | 'muhendis_onayli'

export interface RuleMeta {
  durum: RuleStatus
  kaynak: string
  onaylayan: string | null
}

export interface CatalogProduct {
  kod: string
  ad: string
  cesitler: { kod: string; ad: string; not: string | null }[]
  fenoloji: RuleMeta | null
  kc: RuleMeta | null
  gdd: RuleMeta | null
  gddTabanC: number | null
}

export interface Stage {
  kod: string
  ad: string
  baslangic: string
  bitis: string
  baslangicAagg: string
  bitisAagg: string
  ozel: boolean
  kc: number | null
  sezon: number
}

export interface Phenology {
  sezon: number
  kural: RuleMeta | null
  kcKural: RuleMeta | null
  kuralYok: boolean
  evreler: Stage[]
}

export interface SeriesDay {
  tarih: string
  yagisBirikimli: number
  oncekiYagisBirikimli: number | null
  gddBirikimli: number | null
  oncekiGddBirikimli: number | null
}

export interface Series {
  sezon: number
  gddTabanC: number | null
  gddKural: RuleMeta | null
  gunler: SeriesDay[]
  ozet: { sonGun: string | null; yagis: number | null; oncekiYagis: number | null; gdd: number | null; oncekiGdd: number | null }
  oncekiSezonVar: boolean
  notlar: string[]
}

export interface ScoreComponent {
  kod: string
  ad: string
  puan: number | null
  agirlik: number
  kullanilabilir: boolean
  neden: string
}

export interface GardenStatus {
  durum: 'iyi' | 'izle' | 'dikkat' | 'veri_yok'
  etiket: string
  skor: number | null
  ozet: string
  veriYeterli: boolean
  veriYetersizNedeni: string | null
  bilesenler: ScoreComponent[]
  guven: { seviye: 'yuksek' | 'orta' | 'dusuk'; aciklama: string; gecmisGun: number; sonGoruntuYasiGun: number | null }
}

export interface TodayItem {
  tur: string
  oncelik: 'kritik' | 'uyari' | 'bilgi'
  baslik: string
  metin: string
  sekme: 'durum' | 'analiz' | 'hava' | 'gunluk' | 'rapor'
  /** Teknik ayrıntı (GDD, eşikler): «Ayrıntı» açılırında */
  ayrinti: string | null
}

const meta = (m: ApiKuralMeta | null): RuleMeta | null => (m ? { durum: m.durum, kaynak: m.kaynak, onaylayan: m.onaylayan } : null)

export const agroApi = {
  async catalog(): Promise<CatalogProduct[]> {
    const raw = await apiRequest<ApiKatalog>('/agro/katalog')
    return raw.urunler.map((u) => ({
      kod: u.kod,
      ad: u.ad,
      cesitler: u.cesitler.map((c) => ({ kod: c.kod, ad: c.ad, not: c.not_ })),
      fenoloji: meta(u.fenoloji),
      kc: meta(u.kc),
      gdd: meta(u.gdd),
      gddTabanC: u.gdd_taban_c,
    }))
  },
  async phenology(gardenId: string, sezon?: number): Promise<Phenology> {
    const raw = await apiRequest<ApiFenoloji>(`/gardens/${gardenId}/agro/fenoloji${sezon ? `?sezon=${sezon}` : ''}`)
    return {
      sezon: raw.sezon,
      kural: meta(raw.kural),
      kcKural: meta(raw.kc_kural),
      kuralYok: raw.kural_yok,
      evreler: raw.evreler.map((e) => ({
        kod: e.kod, ad: e.ad, baslangic: e.baslangic, bitis: e.bitis, baslangicAagg: e.baslangic_aagg, bitisAagg: e.bitis_aagg, ozel: e.ozel, kc: e.kc, sezon: e.sezon,
      })),
    }
  },
  async series(gardenId: string, sezon: number): Promise<Series> {
    const raw = await apiRequest<ApiSeriler>(`/gardens/${gardenId}/agro/seriler?sezon=${sezon}`)
    return {
      sezon: raw.sezon,
      gddTabanC: raw.gdd_taban_c,
      gddKural: meta(raw.gdd_kural),
      gunler: raw.gunler.map((g) => ({
        tarih: g.tarih,
        yagisBirikimli: g.yagis_birikimli_mm,
        oncekiYagisBirikimli: g.onceki_yagis_birikimli_mm,
        gddBirikimli: g.gdd_birikimli,
        oncekiGddBirikimli: g.onceki_gdd_birikimli,
      })),
      ozet: {
        sonGun: raw.ozet.son_gun,
        yagis: raw.ozet.yagis_birikimli_mm,
        oncekiYagis: raw.ozet.onceki_ayni_gun_yagis_mm,
        gdd: raw.ozet.gdd_birikimli,
        oncekiGdd: raw.ozet.onceki_ayni_gun_gdd,
      },
      oncekiSezonVar: raw.onceki_sezon_var,
      notlar: raw.notlar,
    }
  },
  async status(gardenId: string): Promise<GardenStatus> {
    const raw = await apiRequest<ApiDurum>(`/gardens/${gardenId}/durum`)
    return {
      durum: raw.durum,
      etiket: raw.etiket,
      skor: raw.skor,
      ozet: raw.ozet,
      veriYeterli: raw.veri_yeterli,
      veriYetersizNedeni: raw.veri_yetersiz_nedeni,
      bilesenler: raw.bilesenler,
      guven: { seviye: raw.guven.seviye, aciklama: raw.guven.aciklama, gecmisGun: raw.guven.gecmis_gun, sonGoruntuYasiGun: raw.guven.son_goruntu_yasi_gun },
    }
  },
  async today(gardenId: string): Promise<TodayItem[]> {
    return (await apiRequest<ApiBugun>(`/gardens/${gardenId}/bugun`)).maddeler.map((m) => ({ ...m, ayrinti: m.ayrinti ?? null }))
  },
}

/** Katalog sürümlüdür ve oturum boyunca değişmez. */
export function useCatalog() {
  return useQuery({ queryKey: ['agro', 'katalog'], queryFn: agroApi.catalog, staleTime: Infinity })
}

export function useGardenStatus(gardenId: string | null) {
  return useQuery({ queryKey: ['agro', 'durum', gardenId], queryFn: () => agroApi.status(gardenId as string), enabled: gardenId !== null, staleTime: 60_000 })
}

export function useToday(gardenId: string | null) {
  return useQuery({ queryKey: ['agro', 'bugun', gardenId], queryFn: () => agroApi.today(gardenId as string), enabled: gardenId !== null, staleTime: 60_000 })
}

export function usePhenology(gardenId: string | null) {
  return useQuery({ queryKey: ['agro', 'fenoloji', gardenId], queryFn: () => agroApi.phenology(gardenId as string), enabled: gardenId !== null, staleTime: 5 * 60_000 })
}

export function useSeries(gardenId: string | null, sezon: number) {
  return useQuery({ queryKey: ['agro', 'seri', gardenId, sezon], queryFn: () => agroApi.series(gardenId as string, sezon), enabled: gardenId !== null, staleTime: 5 * 60_000 })
}

/** Aralığın dokunduğu sezonların serileri (en fazla birkaç sezon) tek listede, tarihe göre sıralı ve tekrarsız. */
export function useSeriesForSeasons(gardenId: string | null, seasons: number[]) {
  const results = useQueries({
    queries: seasons.map((sezon) => ({
      queryKey: ['agro', 'seri', gardenId, sezon],
      queryFn: () => agroApi.series(gardenId as string, sezon),
      enabled: gardenId !== null,
      staleTime: 5 * 60_000,
    })),
  })
  const loading = results.some((r) => r.isLoading)
  const error = results.find((r) => r.isError)?.error ?? null
  const list = results.flatMap((r) => (r.data ? [r.data] : []))
  const seen = new Set<string>()
  const days = list
    .flatMap((s) => s.gunler)
    .sort((a, b) => a.tarih.localeCompare(b.tarih))
    .filter((d) => (seen.has(d.tarih) ? false : (seen.add(d.tarih), true)))
  const latest = [...list].sort((a, b) => b.sezon - a.sezon)[0]
  return { days, series: list, latest, loading, error }
}

export function useSetOverride(gardenId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ evre, baslangic, bitis }: { evre: string; baslangic: string; bitis: string }) =>
      apiRequest(`/gardens/${gardenId}/agro/fenoloji/${evre}`, { method: 'PUT', body: JSON.stringify({ baslangic, bitis }) }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['agro', 'fenoloji', gardenId] }),
  })
}

export function useResetOverride(gardenId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (evre: string) => apiRequest(`/gardens/${gardenId}/agro/fenoloji/${evre}`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['agro', 'fenoloji', gardenId] }),
  })
}

// ----------------------------------------------------------------------------- sulama ve riskler (8B)
export interface IrrigationWindow {
  gun: number
  etcMm: number
  etkiliYagisMm: number
  netMm: number
  eksikGun: number
}

export interface Irrigation {
  veriYeterli: boolean
  veriYetersizNedeni: string | null
  sonGunler: IrrigationWindow | null
  onumuzdekiGunler: IrrigationWindow | null
  ihtiyacMm: number | null
  brutIhtiyacMm: number | null
  tonDekar: number | null
  toplamTon: number | null
  sistem: { kod: string | null; ad: string | null; verimlilik: number | null }
  gerekli: boolean
  cumle: string
  not: string
  kurallar: { etkiliYagis: RuleMeta; sistem: RuleMeta; kc: RuleMeta | null }
}

export interface Risk {
  kod: string
  ad: string
  kisa: string
  seviye: 'dusuk' | 'orta' | 'yuksek'
  gerekce: string
  gecerlilikBaslangic: string
  gecerlilikBitis: string
  veriYeterli: boolean
  kural: RuleMeta
}

export interface Risks {
  tarih: string
  riskler: Risk[]
  tuzak: { desteklenir: boolean; adim: string; aciklama: string }
  not: string
}

interface ApiWindow {
  gun: number
  etc_mm: number
  etkili_yagis_mm: number
  net_mm: number
  eksik_gun: number
}

const win = (w: ApiWindow | null): IrrigationWindow | null =>
  w ? { gun: w.gun, etcMm: w.etc_mm, etkiliYagisMm: w.etkili_yagis_mm, netMm: w.net_mm, eksikGun: w.eksik_gun } : null

export const sulamaRiskApi = {
  async irrigation(gardenId: string): Promise<Irrigation> {
    const raw = await apiRequest<{
      veri_yeterli: boolean
      veri_yetersiz_nedeni: string | null
      son_gunler: ApiWindow | null
      onumuzdeki_gunler: ApiWindow | null
      ihtiyac_mm: number | null
      brut_ihtiyac_mm: number | null
      ton_dekar: number | null
      toplam_ton: number | null
      sistem: { kod: string | null; ad: string | null; verimlilik: number | null }
      gerekli: boolean
      cumle: string
      not_: string
      etkili_yagis_kural: ApiKuralMeta
      sistem_kural: ApiKuralMeta
      kc_kural: ApiKuralMeta | null
    }>(`/gardens/${gardenId}/sulama`)
    return {
      veriYeterli: raw.veri_yeterli,
      veriYetersizNedeni: raw.veri_yetersiz_nedeni,
      sonGunler: win(raw.son_gunler),
      onumuzdekiGunler: win(raw.onumuzdeki_gunler),
      ihtiyacMm: raw.ihtiyac_mm,
      brutIhtiyacMm: raw.brut_ihtiyac_mm,
      tonDekar: raw.ton_dekar,
      toplamTon: raw.toplam_ton,
      sistem: raw.sistem,
      gerekli: raw.gerekli,
      cumle: raw.cumle,
      not: raw.not_,
      kurallar: { etkiliYagis: meta(raw.etkili_yagis_kural) as RuleMeta, sistem: meta(raw.sistem_kural) as RuleMeta, kc: meta(raw.kc_kural) },
    }
  },
  async risks(gardenId: string): Promise<Risks> {
    const raw = await apiRequest<{
      tarih: string
      riskler: {
        kod: string
        ad: string
        kisa: string
        seviye: Risk['seviye']
        gerekce: string
        gecerlilik_baslangic: string
        gecerlilik_bitis: string
        veri_yeterli: boolean
        kural: ApiKuralMeta
      }[]
      tuzak: Risks['tuzak']
      not_: string
    }>(`/gardens/${gardenId}/riskler`)
    return {
      tarih: raw.tarih,
      riskler: raw.riskler.map((r) => ({
        kod: r.kod, ad: r.ad, kisa: r.kisa, seviye: r.seviye, gerekce: r.gerekce, gecerlilikBaslangic: r.gecerlilik_baslangic,
        gecerlilikBitis: r.gecerlilik_bitis, veriYeterli: r.veri_yeterli, kural: meta(r.kural) as RuleMeta,
      })),
      tuzak: raw.tuzak,
      not: raw.not_,
    }
  },
}

export function useIrrigation(gardenId: string | null) {
  return useQuery({ queryKey: ['agro', 'sulama', gardenId], queryFn: () => sulamaRiskApi.irrigation(gardenId as string), enabled: gardenId !== null, staleTime: 5 * 60_000 })
}

export function useRisks(gardenId: string | null) {
  return useQuery({ queryKey: ['agro', 'riskler', gardenId], queryFn: () => sulamaRiskApi.risks(gardenId as string), enabled: gardenId !== null, staleTime: 5 * 60_000 })
}
