import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/apiClient'

export type SprayStatus = 'uygun' | 'sinirda' | 'uygun_degil'
export type AlertLevel = 'sari' | 'kirmizi'

export interface WeatherNow {
  zaman: string
  sicaklik: number
  hissedilen: number | null
  nem: number | null
  yagis: number
  ruzgar: number
  hamle: number | null
  yon: number | null
  kod: number
  aciklama: string
  ikon: string
}

export interface SpraySummary {
  uygunSaat: number
  sinirdaSaat: number
  uygunDegilSaat: number
  enIyiAralik: [string, string] | null
}

export interface WeatherDay {
  tarih: string
  min: number | null
  max: number | null
  yagisMm: number | null
  yagisOlasiligi: number | null
  ruzgarMax: number | null
  hamleMax: number | null
  et0Mm: number | null
  aciklama: string
  ikon: string
  ilaclama: SpraySummary
}

export interface WeatherHour {
  zaman: string // yerel saat, "YYYY-MM-DDTHH:00"
  sicaklik: number
  nem: number | null
  yagis: number
  yagisOlasiligi: number | null
  ruzgar: number
  hamle: number
  et0: number | null
  ilaclama: SprayStatus
  nedenler: string[]
}

export interface WeatherAlert {
  tur: 'don' | 'sicak'
  seviye: AlertLevel
  baslik: string
  mesaj: string
  baslangic: string
  bitis: string
  sureSaat: number
  deger: number
}

export interface WaterBalance {
  gun: number
  yagisMm: number
  et0Mm: number
  dengeMm: number
  eksikGun: number
  aciklama: string
}

export interface RainTotal {
  etiket: string
  gun: number
  mm: number | null
  gecenYilMm: number | null
}

export interface Weather {
  guncelleme: string
  onbellekten: boolean
  atif: string
  simdi: WeatherNow
  gunler: WeatherDay[]
  saatlik: WeatherHour[]
  uyarilar: WeatherAlert[]
  suDengesi: WaterBalance[]
  yagisToplamlari: RainTotal[]
}

export interface HistoryDay {
  tarih: string
  min: number | null
  max: number | null
  yagisMm: number | null
  et0Mm: number | null
}

export interface WeatherSummary {
  gardenId: string
  ad: string
  hata: string | null
  guncelleme: string | null
  onbellekten: boolean
  simdi: WeatherNow | null
  bugunMin: number | null
  bugunMax: number | null
  bugunYagisMm: number | null
  bugunYagisOlasiligi: number | null
  uyarilar: WeatherAlert[]
  sonrakiIlaclama: { baslangic: string; bitis: string } | null
}

/* eslint-disable @typescript-eslint/no-explicit-any -- API yanıtı eşlenirken */
const mapAlert = (a: any): WeatherAlert => ({
  tur: a.tur,
  seviye: a.seviye,
  baslik: a.baslik,
  mesaj: a.mesaj,
  baslangic: a.baslangic,
  bitis: a.bitis,
  sureSaat: a.sure_saat,
  deger: a.deger,
})

const mapNow = (n: any): WeatherNow => ({
  zaman: n.zaman,
  sicaklik: n.sicaklik,
  hissedilen: n.hissedilen,
  nem: n.nem,
  yagis: n.yagis,
  ruzgar: n.ruzgar,
  hamle: n.hamle,
  yon: n.yon,
  kod: n.kod,
  aciklama: n.aciklama,
  ikon: n.ikon,
})

function mapWeather(d: any): Weather {
  return {
    guncelleme: d.guncelleme,
    onbellekten: d.onbellekten,
    atif: d.atif,
    simdi: mapNow(d.simdi),
    gunler: d.gunler.map(
      (g: any): WeatherDay => ({
        tarih: g.tarih,
        min: g.min,
        max: g.max,
        yagisMm: g.yagis_mm,
        yagisOlasiligi: g.yagis_olasiligi,
        ruzgarMax: g.ruzgar_max,
        hamleMax: g.hamle_max,
        et0Mm: g.et0_mm,
        aciklama: g.aciklama,
        ikon: g.ikon,
        ilaclama: {
          uygunSaat: g.ilaclama.uygun_saat,
          sinirdaSaat: g.ilaclama.sinirda_saat,
          uygunDegilSaat: g.ilaclama.uygun_degil_saat,
          enIyiAralik: g.ilaclama.en_iyi_aralik,
        },
      }),
    ),
    saatlik: d.saatlik.map(
      (h: any): WeatherHour => ({
        zaman: h.zaman,
        sicaklik: h.sicaklik,
        nem: h.nem,
        yagis: h.yagis,
        yagisOlasiligi: h.yagis_olasiligi,
        ruzgar: h.ruzgar,
        hamle: h.hamle,
        et0: h.et0,
        ilaclama: h.ilaclama,
        nedenler: h.ilaclama_nedenleri,
      }),
    ),
    uyarilar: d.uyarilar.map(mapAlert),
    suDengesi: d.su_dengesi.map(
      (b: any): WaterBalance => ({
        gun: b.gun,
        yagisMm: b.yagis_mm,
        et0Mm: b.et0_mm,
        dengeMm: b.denge_mm,
        eksikGun: b.eksik_gun,
        aciklama: b.aciklama,
      }),
    ),
    yagisToplamlari: d.yagis_toplamlari.map(
      (t: any): RainTotal => ({ etiket: t.etiket, gun: t.gun, mm: t.mm, gecenYilMm: t.gecen_yil_mm }),
    ),
  }
}

function mapSummary(s: any): WeatherSummary {
  return {
    gardenId: s.garden_id,
    ad: s.ad,
    hata: s.hata,
    guncelleme: s.guncelleme,
    onbellekten: s.onbellekten,
    simdi: s.simdi ? mapNow(s.simdi) : null,
    bugunMin: s.bugun_min,
    bugunMax: s.bugun_max,
    bugunYagisMm: s.bugun_yagis_mm,
    bugunYagisOlasiligi: s.bugun_yagis_olasiligi,
    uyarilar: s.uyarilar.map(mapAlert),
    sonrakiIlaclama: s.sonraki_ilaclama,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const weatherApi = {
  async get(gardenId: string): Promise<Weather> {
    return mapWeather(await apiRequest(`/gardens/${gardenId}/weather`))
  },
  async history(gardenId: string, from: string, to: string): Promise<HistoryDay[]> {
    const data = await apiRequest<{ gunler: { tarih: string; min: number | null; max: number | null; yagis_mm: number | null; et0_mm: number | null }[] }>(
      `/gardens/${gardenId}/weather/history?from=${from}&to=${to}`,
    )
    return data.gunler.map((g) => ({ tarih: g.tarih, min: g.min, max: g.max, yagisMm: g.yagis_mm, et0Mm: g.et0_mm }))
  },
  async overview(): Promise<WeatherSummary[]> {
    return (await apiRequest<unknown[]>('/weather/ozet')).map(mapSummary)
  },
}

export const weatherKey = (gardenId: string) => ['weather', gardenId] as const
export const WEATHER_OVERVIEW_KEY = ['weather', 'ozet'] as const

/** Tahmin sunucuda 1 saat önbelleklenir; arayüz 10 dakikada bir tazeler. */
export function useWeather(gardenId: string | null) {
  return useQuery({
    queryKey: gardenId ? weatherKey(gardenId) : ['weather', 'none'],
    queryFn: () => weatherApi.get(gardenId as string),
    enabled: gardenId !== null,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
    retry: 1,
  })
}

export function useWeatherHistory(gardenId: string | null, from: string, to: string, enabled: boolean) {
  return useQuery({
    queryKey: ['weather', 'history', gardenId, from, to],
    queryFn: () => weatherApi.history(gardenId as string, from, to),
    enabled: enabled && gardenId !== null,
    staleTime: 30 * 60_000,
    retry: 1,
  })
}

export function useWeatherOverview(enabled = true) {
  return useQuery({
    queryKey: WEATHER_OVERVIEW_KEY,
    queryFn: weatherApi.overview,
    enabled,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
    retry: 1,
  })
}
