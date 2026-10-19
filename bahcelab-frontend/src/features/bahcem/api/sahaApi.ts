import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/apiClient'

/** Saha Defteri (ADR 0019): konumlu kayıtlar, «Uydu haklı mıydı?» doğrulaması, doğruluk özeti, saha turu. */
export const KAYIT_TURLERI = ['gozlem', 'ilaclama', 'gubreleme', 'sulama', 'hasat', 'tuzak'] as const
export type KayitTuru = (typeof KAYIT_TURLERI)[number]
export const KAYIT_TUR_AD: Record<KayitTuru, string> = { gozlem: 'Gözlem', ilaclama: 'İlaçlama', gubreleme: 'Gübreleme', sulama: 'Sulama', hasat: 'Hasat', tuzak: 'Tuzak' }
export const KAYIT_TUR_ISARET: Record<KayitTuru, string> = { gozlem: '◉', ilaclama: '✚', gubreleme: '▲', sulama: '≈', hasat: '■', tuzak: '⌖' }

export type Sonuc = 'gerceklesti' | 'gerceklesmedi' | 'bilinmiyor'
export const SONUC_AD: Record<Sonuc, string> = { gerceklesti: 'Gerçekleşti', gerceklesmedi: 'Gerçekleşmedi', bilinmiyor: 'Bilinmiyor' }

export interface Foto {
  id: string
  url: string
  boyut_bayt: number
}
export interface Kayit {
  id: string
  tur: KayitTuru
  tarih: string
  konum_tur: 'nokta' | 'alan' | null
  konum: GeoJSON.Point | GeoJSON.Polygon | null
  aciklama: string | null
  ayrinti: Record<string, unknown> | null
  fotograflar: Foto[]
  created_at: string
}
export interface KayitGirdisi {
  tur: KayitTuru
  tarih: string
  konum: GeoJSON.Point | GeoJSON.Polygon | null
  aciklama: string | null
}
export interface DogrulamaKarti {
  hedef_tur: 'olay' | 'uyari'
  hedef_anahtar: string
  baslik: string
  tur_grubu: string
  baslangic: string
  bitis: string
  guven: string | null
  durum: 'olay' | 'bekliyor' | 'suphe' | 'uyari'
  olay_id: string | null
  sonuc: Sonuc | null
  aciklama: string | null
  dogrulama_id: string | null
  fotograflar: Foto[]
  dogrulandi: string | null
}
export interface DogrulamaListesi {
  kartlar: DogrulamaKarti[]
  bekleyen: number
  not_: string
}
export interface TurOzeti {
  tur: string
  ad: string
  gerceklesti: number
  gerceklesmedi: number
  bilinmiyor: number
  bekleyen: number
  dogrulanan: number
  yeterli: boolean
  metin: string
}
export interface DogrulukOzeti {
  turler: TurOzeti[]
  asgari_dogrulama: number
  esik_durumu: string
  not_: string
}
export interface TurNoktasi {
  anahtar: string
  tur: 'zayif_kesim' | 'stres_yamasi' | 'bekliyor'
  baslik: string
  neden: string
  lng: number
  lat: number
  sira: number
  mesafe_m: number
  ziyaret_edildi: boolean
  ziyaret_zamani: string | null
  kayit_id: string | null
  olay_anahtar: string | null
}
export interface SahaTuru {
  noktalar: TurNoktasi[]
  baslangic: { lng: number; lat: number }
  rota: [number, number][]
  toplam_m: number
  sure_dk: number
  ziyaret_edilen: number
  esik_durumu: string
  not_: string
}

const base = (id: string) => `/gardens/${id}`
export const sahaKeys = {
  kayitlar: (id: string | null) => ['saha-kayitlari', id] as const,
  kartlar: (id: string | null) => ['dogrulama', id] as const,
  ozet: (id: string | null) => ['dogruluk-ozeti', id] as const,
  tur: (id: string | null) => ['saha-turu', id] as const,
}

export function useSahaKayitlari(gardenId: string | null) {
  return useQuery({ queryKey: sahaKeys.kayitlar(gardenId), queryFn: () => apiRequest<{ kayitlar: Kayit[] }>(`${base(gardenId!)}/saha-kayitlari`).then((r) => r.kayitlar), enabled: gardenId !== null, staleTime: 30_000 })
}
export function useDogrulamaKartlari(gardenId: string | null) {
  return useQuery({ queryKey: sahaKeys.kartlar(gardenId), queryFn: () => apiRequest<DogrulamaListesi>(`${base(gardenId!)}/dogrulama`), enabled: gardenId !== null, staleTime: 30_000 })
}
export function useDogrulukOzeti(gardenId: string | null) {
  return useQuery({ queryKey: sahaKeys.ozet(gardenId), queryFn: () => apiRequest<DogrulukOzeti>(`${base(gardenId!)}/dogruluk-ozeti`), enabled: gardenId !== null, staleTime: 30_000 })
}
export function useSahaTuru(gardenId: string | null, baslangic: { lng: number; lat: number } | null) {
  return useQuery({
    queryKey: [...sahaKeys.tur(gardenId), baslangic?.lng ?? null, baslangic?.lat ?? null],
    queryFn: () => apiRequest<SahaTuru>(`${base(gardenId!)}/saha-turu${baslangic ? `?lng=${baslangic.lng}&lat=${baslangic.lat}` : ''}`),
    enabled: gardenId !== null,
    staleTime: 30_000,
  })
}

/** Değişen tüm saha sorguları yenilenir (kayıt, doğrulama, özet ve tur birbirine bağlıdır). */
function useInvalidateSaha(gardenId: string) {
  const client = useQueryClient()
  return () => {
    for (const key of [sahaKeys.kayitlar(gardenId), sahaKeys.kartlar(gardenId), sahaKeys.ozet(gardenId), sahaKeys.tur(gardenId), ['gecmis-ozeti', gardenId], ['olaylar', gardenId]]) void client.invalidateQueries({ queryKey: key })
  }
}

export function useKayitOlustur(gardenId: string) {
  const yenile = useInvalidateSaha(gardenId)
  return useMutation({
    mutationFn: async ({ girdi, fotolar }: { girdi: KayitGirdisi; fotolar: File[] }) => {
      const kayit = await apiRequest<Kayit>(`${base(gardenId)}/saha-kayitlari`, { method: 'POST', body: JSON.stringify(girdi) })
      for (const dosya of fotolar) await fotoYukle(`${base(gardenId)}/saha-kayitlari/${kayit.id}/foto`, dosya)
      return kayit
    },
    onSettled: yenile, // fotoğraf yüklemesi başarısız olsa bile kayıt oluşmuştur: liste yenilenir
  })
}
export function useKayitSil(gardenId: string) {
  const yenile = useInvalidateSaha(gardenId)
  return useMutation({ mutationFn: (id: string) => apiRequest(`${base(gardenId)}/saha-kayitlari/${id}`, { method: 'DELETE' }), onSuccess: yenile })
}
export function useDogrula(gardenId: string) {
  const yenile = useInvalidateSaha(gardenId)
  return useMutation({
    mutationFn: async ({ kart, sonuc, aciklama, foto }: { kart: Pick<DogrulamaKarti, 'hedef_tur' | 'hedef_anahtar'>; sonuc: Sonuc; aciklama: string | null; foto?: File | null }) => {
      const yanit = await apiRequest<DogrulamaKarti>(`${base(gardenId)}/dogrulama`, { method: 'PUT', body: JSON.stringify({ hedef_tur: kart.hedef_tur, hedef_anahtar: kart.hedef_anahtar, sonuc, aciklama }) })
      if (foto && yanit.dogrulama_id) await fotoYukle(`${base(gardenId)}/dogrulama/${yanit.dogrulama_id}/foto`, foto)
      return yanit
    },
    onSuccess: yenile,
  })
}
export function useZiyaret(gardenId: string) {
  const yenile = useInvalidateSaha(gardenId)
  return useMutation({
    mutationFn: (g: { nokta_anahtar: string; kayit_id?: string | null; ziyaret_edildi: boolean }) => apiRequest(`${base(gardenId)}/saha-turu/ziyaret`, { method: 'PUT', body: JSON.stringify(g) }),
    onSuccess: yenile,
  })
}

async function fotoYukle(yol: string, dosya: File): Promise<void> {
  const form = new FormData()
  form.append('file', dosya)
  await apiRequest(yol, { method: 'POST', body: form })
}

/** Tek dosya yüklemesi gerekirse (kayıt sonrası fotoğraf ekleme). */
export function useKayitFoto(gardenId: string) {
  const yenile = useInvalidateSaha(gardenId)
  return useMutation({ mutationFn: ({ kayitId, dosya }: { kayitId: string; dosya: File }) => fotoYukle(`${base(gardenId)}/saha-kayitlari/${kayitId}/foto`, dosya), onSuccess: yenile })
}
