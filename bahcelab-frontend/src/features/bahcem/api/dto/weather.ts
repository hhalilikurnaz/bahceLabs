/** Backend `domain/weather/schemas.py` yanıt biçimleri. */

export type ApiSprayStatus = 'uygun' | 'sinirda' | 'uygun_degil'

export interface ApiWeatherNow {
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

export interface ApiWeatherAlert {
  tur: 'don' | 'sicak'
  seviye: 'sari' | 'kirmizi'
  baslik: string
  mesaj: string
  baslangic: string
  bitis: string
  sure_saat: number
  deger: number
}

export interface ApiWeatherDay {
  tarih: string
  min: number | null
  max: number | null
  yagis_mm: number | null
  yagis_olasiligi: number | null
  ruzgar_max: number | null
  hamle_max: number | null
  et0_mm: number | null
  kod: number | null
  aciklama: string
  ikon: string
  ilaclama: {
    uygun_saat: number
    sinirda_saat: number
    uygun_degil_saat: number
    en_iyi_aralik: [string, string] | null
  }
}

export interface ApiWeatherHour {
  zaman: string
  sicaklik: number
  nem: number | null
  yagis: number
  yagis_olasiligi: number | null
  ruzgar: number
  hamle: number
  et0: number | null
  kod: number
  ilaclama: ApiSprayStatus
  ilaclama_nedenleri: string[]
}

export interface ApiWaterBalance {
  gun: number
  yagis_mm: number
  et0_mm: number
  denge_mm: number
  eksik_gun: number
  aciklama: string
}

export interface ApiRainTotal {
  etiket: string
  gun: number
  mm: number | null
  gecen_yil_mm: number | null
}

export interface ApiWeather {
  guncelleme: string
  onbellekten: boolean
  atif: string
  simdi: ApiWeatherNow
  gunler: ApiWeatherDay[]
  saatlik: ApiWeatherHour[]
  uyarilar: ApiWeatherAlert[]
  su_dengesi: ApiWaterBalance[]
  yagis_toplamlari: ApiRainTotal[]
}

export interface ApiWeatherHistory {
  gunler: { tarih: string; min: number | null; max: number | null; yagis_mm: number | null; et0_mm: number | null }[]
}

export interface ApiWeatherSummary {
  garden_id: string
  ad: string
  hata: string | null
  guncelleme: string | null
  onbellekten: boolean
  simdi: ApiWeatherNow | null
  bugun_min: number | null
  bugun_max: number | null
  bugun_yagis_mm: number | null
  bugun_yagis_olasiligi: number | null
  uyarilar: ApiWeatherAlert[]
  sonraki_ilaclama: { baslangic: string; bitis: string } | null
}
