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

export interface ApiBilesen {
  kod: string
  ad: string
  puan: number | null
  agirlik: number
  kullanilabilir: boolean
  neden: string
}

export interface ApiDurum {
  durum: 'iyi' | 'izle' | 'dikkat' | 'veri_yok'
  etiket: string
  skor: number | null
  ozet: string
  veri_yeterli: boolean
  veri_yetersiz_nedeni: string | null
  bilesenler: ApiBilesen[]
  guven: { seviye: 'yuksek' | 'orta' | 'dusuk'; aciklama: string; gecmis_gun: number; son_goruntu_yasi_gun: number | null }
  hesaplama_tarihi: string
}

export interface ApiBugun {
  tarih: string
  maddeler: { tur: string; oncelik: 'kritik' | 'uyari' | 'bilgi'; baslik: string; metin: string; sekme: 'durum' | 'analiz' | 'hava' | 'gunluk' | 'rapor'; ayrinti?: string | null }[]
}
