import type { SicaklikNoktasi } from '../api/suApi'
import { sayi } from './format'

/** Bir Landsat geçişinin yorumu: yüzey − hava farkı bahçenin AYNI AY geçmişine göre (sabit eşik yok). Karışık pikselde ve geçmiş yetersizken yargı verilmez. */
export function sicaklikCumlesi(n: SicaklikNoktasi): string {
  if (n.fark_c == null) return 'Hava sıcaklığı bulunamadığından yüzey–hava farkı hesaplanamadı.'
  if (n.sapma_c == null || n.normal == null) return `${n.ay} için bu bahçenin yeterli Landsat geçmişi yok; fark ${isaretli(n.fark_c)} °C, normale göre yorum yapılamıyor.`
  const ek = n.karisik_piksel ? ' (karışık piksel: bahçe dışı etkisi olabilir, stres denmez)' : n.stres ? ' (normal bandın üstünde: ısı stresi olabilir)' : ''
  if (n.durum === 'icinde') return `${n.ay} normali içinde (${isaretli(n.sapma_c)} °C)${ek}.`
  return `${n.ay} normaline göre ${isaretli(n.sapma_c)} °C ${n.sapma_c > 0 ? 'sıcak' : 'serin'}${ek}.`
}

export function isaretli(v: number, basamak = 1): string {
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${sayi(Math.abs(v), basamak)}`
}
