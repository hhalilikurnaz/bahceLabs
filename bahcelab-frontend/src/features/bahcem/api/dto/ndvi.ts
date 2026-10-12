/** Backend `domain/ndvi/schemas.py` yanıt biçimleri (yılan_harf alan adları). */

export type ApiIndexId = 'ndvi' | 'msavi' | 'ndre' | 'ndmi' | 'cigreen'

export interface ApiIndexSummary {
  ortalama: number
  medyan: number
  p10: number
  p90: number
  min: number
  max: number
  png_var: boolean
  veri_var: boolean
  sorunlu_bolge_sayisi: number
}

export interface ApiScene {
  tarih: string
  durum: 'tamam' | 'bulutlu'
  scene_id: string
  bulut_orani: number | null
  gecerli_piksel_orani: number
  satir: number | null
  sutun: number | null
  koordinatlar: [number, number][] | null
  gercek_renk_var: boolean
  indeksler: Partial<Record<ApiIndexId, ApiIndexSummary>>
  kaynak: string
  surum: number
}

export interface ApiJob {
  id: string
  tur: 'ilk' | 'guncelleme' | 'yeniden'
  durum: 'bekliyor' | 'isleniyor' | 'tamam' | 'hata'
  toplam: number
  islenen: number
  hata_mesaji: string | null
}

export interface ApiAlert {
  tur: 'indeks_dusus' | 'coklu_indeks'
  indeks: ApiIndexId | null
  indeksler: ApiIndexId[]
  oncelik: 'normal' | 'yuksek'
  baslik: string
  mesaj: string
  onceki_tarih: string | null
  son_tarih: string
  degisim_yuzde: number | null
}

export interface ApiTipikBant {
  alt: number
  ust: number
  durum: 'dogrulanmadi' | 'muhendis_onayli'
}

export interface ApiIndexOverview {
  tipik_bantlar?: Record<string, ApiTipikBant>
  gozlemler: ApiScene[]
  isleme: ApiJob | null
  son_kontrol: string | null
  uyarilar: ApiAlert[]
  eksik_cikti: boolean
}

export interface ApiArchiveScene {
  tarih: string
  durum: 'tamam' | 'bulutlu'
  deger: number | null
  bulut_orani: number | null
  gecerli_piksel_orani: number
  net: boolean
  en_net: boolean
  kucuk_resim_url: string | null
  ham_veri_var: boolean
}

export interface ApiArchive {
  parametre: string
  sezon: number
  sezonlar: number[]
  toplam: number
  net_sayisi: number
  bulutlu_sayisi: number
  sayfa: number
  boyut: number
  sayfa_sayisi: number
  sahneler: ApiArchiveScene[]
}
