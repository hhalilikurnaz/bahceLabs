/** Backend `domain/agro/schemas.py` yanıt biçimleri (yılan_harf). */

export interface ApiKuralMeta {
  durum: 'dogrulanmadi' | 'muhendis_onayli'
  kaynak: string
  onaylayan: string | null
  onay_tarihi: string | null
}

export interface ApiKatalog {
  surum: number
  urunler: {
    kod: string
    ad: string
    cesitler: { kod: string; ad: string; not_: string | null }[]
    fenoloji: ApiKuralMeta | null
    kc: ApiKuralMeta | null
    gdd: ApiKuralMeta | null
    gdd_taban_c: number | null
  }[]
}

export interface ApiEvre {
  kod: string
  ad: string
  baslangic: string
  bitis: string
  baslangic_aagg: string
  bitis_aagg: string
  ozel: boolean
  kc: number | null
  sezon: number
}

export interface ApiFenoloji {
  sezon: number
  urun: string
  cesit_kodu: string | null
  kural: ApiKuralMeta | null
  kc_kural: ApiKuralMeta | null
  kural_yok: boolean
  evreler: ApiEvre[]
}

export interface ApiSeriGunu {
  tarih: string
  tmin: number | null
  tmax: number | null
  yagis_mm: number | null
  yagis_birikimli_mm: number
  onceki_yagis_birikimli_mm: number | null
  gdd: number | null
  gdd_birikimli: number | null
  onceki_gdd_birikimli: number | null
}

export interface ApiSeriler {
  sezon: number
  sezon_baslangici: string
  sezon_bitisi: string
  gdd_taban_c: number | null
  gdd_kural: ApiKuralMeta | null
  gunler: ApiSeriGunu[]
  ozet: {
    son_gun: string | null
    yagis_birikimli_mm: number | null
    onceki_ayni_gun_yagis_mm: number | null
    gdd_birikimli: number | null
    onceki_ayni_gun_gdd: number | null
  }
  eksik_gun: number
  onceki_sezon_var: boolean
  notlar: string[]
}

export type ApiSeviye = 'belirgin_dusuk' | 'normalin_alti' | 'normal' | 'normalin_ustu' | 'belirgin_yuksek'
export interface ApiBilesen {
  kod: 'agac_gucu' | 'su' | 'beslenme' | 'ani_degisim' | 'isi'
  ad: string
  seviye: ApiSeviye | null
  kullanilabilir: boolean
  bayat: boolean
  neden: string
  veri_tarihi: string | null
}

/** Durum (v2, ADR 0018): kademe + 5 bileşen. İç puan YOKTUR (arayüze sayı çıkmaz). */
export interface ApiDurum {
  durum: 'iyi' | 'izle' | 'dikkat' | 'sorun' | 'veri_yok'
  etiket: string
  ozet: string
  bilesenler: ApiBilesen[]
  riskler: string[]
  guven: 'yuksek' | 'orta' | 'dusuk'
  guven_nedeni: string
  nasil: string[]
  dusuren: string[]
  risk_sinirladi: boolean
  esik_durumu: string
  hesaplama_tarihi: string
}

export interface ApiBugun {
  tarih: string
  maddeler: { tur: string; oncelik: 'kritik' | 'onemli' | 'bilgi'; baslik: string; metin: string; sekme: 'durum' | 'analiz' | 'hava' | 'gunluk' | 'rapor'; ayrinti?: string | null }[]
}
