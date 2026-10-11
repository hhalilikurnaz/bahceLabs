/** Backend `domain/overview/schemas.py` yanıt biçimleri. */

export type ApiGardenStatus = 'iyi' | 'izle' | 'dikkat' | 'veri_yok'

export interface ApiOverviewAlert {
  kaynak: 'uydu' | 'hava'
  tur: 'indeks_dusus' | 'coklu_indeks' | 'don' | 'sicak'
  seviye: 'sari' | 'kirmizi'
  baslik: string
}

export interface ApiGardenOverview {
  id: string
  ad: string
  urun: string
  cesit: string | null
  dekar: number
  il: string | null
  ilce: string | null
  durum: ApiGardenStatus
  durum_nedeni: string | null
  indeks: string
  son_goruntu: { tarih: string; kucuk_resim_url: string } | null
  seri: { tarih: string; deger: number }[]
  uyarilar: ApiOverviewAlert[]
  hava: { sicaklik: number; kod: number; aciklama: string; ikon: string; guncelleme: string; bayat: boolean } | null
}

export interface ApiOverviewResponse {
  toplamlar: { bahce_sayisi: number; toplam_dekar: number; dikkat_sayisi: number; izle_sayisi: number }
  bahceler: ApiGardenOverview[]
}
