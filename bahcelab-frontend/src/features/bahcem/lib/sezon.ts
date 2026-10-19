/** Sezon eğrisi yardımcıları (SAF): takvim yılı ekseni (0–12 ay), bu yılın edinim noktaları, aya dokununca haritanın gideceği tarih. */
import type { Edinim, GostergeId } from '../api/edinimApi'
import type { BandKonumu, NormalBantAy } from '../api/normalBantApi'

export const AY_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'] as const
export const AY_ADI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'] as const
export const AY_UZUN = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'] as const

/** Tarihin yıl içindeki konumu: 0 (1 Ocak) … 12 (31 Aralık). Takvim ayı ekseniyle uyumlu (her ay 1 birim). */
export function yilIciKonum(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  const gunSayisi = new Date(y, m, 0).getDate()
  return m - 1 + (d - 0.5) / gunSayisi
}

export interface SezonNoktasi {
  tarih: string
  x: number
  deger: number
}

/** Seçili yıldaki net edinimlerin gösterge değeri (bahçe medyanı), tarih sıralı. */
export function sezonNoktalari(edinimler: Edinim[], gosterge: GostergeId, yil: number): SezonNoktasi[] {
  return edinimler
    .filter((e) => e.tarih.startsWith(`${yil}-`) && e.gostergeler[gosterge])
    .map((e) => ({ tarih: e.tarih, x: yilIciKonum(e.tarih), deger: e.gostergeler[gosterge]!.medyan }))
    .sort((a, b) => a.tarih.localeCompare(b.tarih))
}

/** Aya dokununca haritanın geçeceği tarih: o yıl ve ayın en son net edinimi; yoksa null. */
export function ayTarihi(edinimler: Edinim[], yil: number, ay: number, gosterge: GostergeId): string | null {
  const prefix = `${yil}-${String(ay).padStart(2, '0')}-`
  return edinimler.filter((e) => e.tarih.startsWith(prefix) && e.gostergeler[gosterge]).map((e) => e.tarih).sort().pop() ?? null
}

/** Band çizimi için kullanılabilir aylar: p25–p75 (koyu) ve p10–p90 (açık) yeterli olanlar. */
export function bandAylari(bantlar: NormalBantAy[] | undefined): { koyu: NormalBantAy[]; acik: NormalBantAy[] } {
  const list = bantlar ?? []
  return { koyu: list.filter((b) => b.ceyrek_yeterli && b.p25 !== null && b.p75 !== null), acik: list.filter((b) => b.onluk_yeterli && b.p10 !== null && b.p90 !== null) }
}

export const KONUM_METNI: Record<Exclude<BandKonumu, null>, string> = {
  ust: 'üst kısmında',
  normal: 'normal aralıkta',
  alt: 'alt kısmında',
  en_dusuk: 'en düşüğünde',
}

/** Gösterge çubuğu için ölçek: bant uçları ve değer birlikte görünsün (%8 pay). */
export function cubukAraligi(deger: number, band: NormalBantAy | undefined): [number, number] {
  const uclar = [deger, band?.p10, band?.p25, band?.p75, band?.p90].filter((v): v is number => typeof v === 'number')
  const lo = Math.min(...uclar)
  const hi = Math.max(...uclar)
  const pay = (hi - lo) * 0.08 || 0.02
  return [lo - pay, hi + pay]
}

const gunSayisi = (y: number, m: number) => new Date(y, m, 0).getDate()
/** Tarihin ay ekseni konumu: başlangıç için günün başı, bitiş için günün sonu (0–12). */
const konum = (iso: string, son: boolean): number => {
  const [y, m, d] = iso.split('-').map(Number)
  return m - 1 + (son ? d : d - 1) / gunSayisi(y, m)
}

/** Evrenin verilen takvim yılındaki aralığı [x0, x1] (ay ekseni 0–12); yıl dışında kalıyorsa null. Yıl sınırında kırpılır. */
export function evreAraligi(baslangic: string, bitis: string, yil: number): [number, number] | null {
  const ilk = `${yil}-01-01`
  const son = `${yil}-12-31`
  if (bitis < ilk || baslangic > son) return null
  const x0 = baslangic < ilk ? 0 : konum(baslangic, false)
  const x1 = bitis > son ? 12 : konum(bitis, true)
  return x1 > x0 ? [x0, x1] : null
}
