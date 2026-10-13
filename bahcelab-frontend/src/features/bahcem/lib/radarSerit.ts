/** «Bulut altında görüş» şeridi için SAF hesaplar (ADR 0016): son 90 günün optik/radar satırları, bulutlu dönem bantları ve bulgu cümlesi. */
import type { Edinimler } from '../api/edinimApi'
import type { RadarDegisim, RadarEdinim } from '../api/radarApi'
import { yonAdi } from '../api/radarApi'
import { gunAy } from './format'

export const PENCERE_GUN = 90
const GUN_MS = 86_400_000
/** Ardışık bulutlu optik geçişler bu kadar günden yakınsa tek bulutlu dönem sayılır (Sentinel-2 ≈ 5 günde bir geçer). */
const BANT_BIRLESTIR_GUN = 6

export interface SeritNoktasi {
  tarih: string
  /** Pencere başından gün sayısı (0 … 90) */
  gun: number
}
export interface Serit {
  baslangic: string
  bitis: string
  optik: (SeritNoktasi & { tur: 'net' | 'bulutlu' })[]
  radar: (SeritNoktasi & { yorunge: number; yon: string; aday: RadarDegisim | null })[]
  rvi: (SeritNoktasi & { deger: number })[]
  bantlar: { bas: number; bit: number }[]
  /** Pencere içinde bulut yüzünden alınamayan optik geçiş sayısı */
  optikGoremedi: number
  optikNet: number
  radarGordu: number
  adaylar: RadarDegisim[]
}

const gunFarki = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / GUN_MS)
const isoGun = (t: number) => new Date(t).toISOString().slice(0, 10)

export function buildSerit(bugun: string, edinimler: Edinimler | undefined, radar: RadarEdinim[] | undefined, olaylar: RadarDegisim[] | undefined): Serit {
  const baslangic = isoGun(Date.parse(bugun) - PENCERE_GUN * GUN_MS)
  const icinde = (t: string) => t >= baslangic && t <= bugun
  const gun = (t: string) => gunFarki(baslangic, t)
  const optikNet = (edinimler?.edinimler ?? []).filter((e) => icinde(e.tarih)).map((e) => ({ tarih: e.tarih, gun: gun(e.tarih), tur: 'net' as const }))
  const bulutlu = (edinimler?.bulutlu_tarihler ?? []).filter(icinde).map((t) => ({ tarih: t, gun: gun(t), tur: 'bulutlu' as const }))
  const adaylar = (olaylar ?? []).filter((o) => o.durum === 'aday' && icinde(o.tarih))
  const radarSon = (radar ?? []).filter((r) => icinde(r.tarih))
  const rviler = radarSon.filter((r) => r.birincil && r.rvi != null).map((r) => ({ tarih: r.tarih, gun: gun(r.tarih), deger: r.rvi as number }))
  // Bulutlu dönemler: yakın bulutlu geçişler birleşir; bant her yönde yarım geçiş aralığı (≈ 2,5 gün) kadar genişler
  const bantlar: Serit['bantlar'] = []
  for (const b of bulutlu) {
    const son = bantlar[bantlar.length - 1]
    if (son && b.gun - (son.bit - 2.5) <= BANT_BIRLESTIR_GUN) son.bit = b.gun + 2.5
    else bantlar.push({ bas: Math.max(0, b.gun - 2.5), bit: Math.min(PENCERE_GUN, b.gun + 2.5) })
  }
  return {
    baslangic,
    bitis: bugun,
    optik: [...optikNet, ...bulutlu].sort((a, b) => a.gun - b.gun),
    radar: radarSon.map((r) => ({ tarih: r.tarih, gun: gun(r.tarih), yorunge: r.yorunge, yon: r.gecis_yonu, aday: adaylar.find((o) => o.tarih === r.tarih && o.yorunge === r.yorunge) ?? null })),
    rvi: rviler,
    bantlar,
    optikGoremedi: bulutlu.length,
    optikNet: optikNet.length,
    radarGordu: radarSon.length,
    adaylar,
  }
}

const kez = (n: number) => `${n} kez`

/** Üstteki bulgu cümlesi: sayılar yalnızca eldeki kayıtlardan; belirsizlik (ön değer, ıslaklık) cümlede kalır. */
export function bulguCumlesi(s: Serit): string {
  const optik = s.optikGoremedi > 0 ? `Son ${PENCERE_GUN} günde optik uydu ${kez(s.optikGoremedi)} göremedi` : `Son ${PENCERE_GUN} günde optik uydu ${s.optikNet} net görüntü aldı`
  if (s.radarGordu === 0) return `${optik}; bu sürede radar geçişi kaydı yok.`
  if (s.adaylar.length === 0) return `${optik}; radar bu sürede ${kez(s.radarGordu)} gördü, anlamlı değişim yok.`
  const son = s.adaylar[0] // sunucu tarihe göre azalan sıralar
  const yon = son.isaret === 'azalis' ? 'azalma' : 'artış'
  const islak = son.guven === 'dusuk' ? ' — düşük güven: önceki 48 saatte yağış var, ıslaklık olabilir' : ''
  return `${optik}; radar bu sürede ${kez(s.radarGordu)} gördü, ${gunAy(son.tarih)} geçişinde alanın %${Math.round(son.alan_orani * 100)}’inde ${yon} (${son.buyukluk_db > 0 ? '+' : ''}${son.buyukluk_db.toFixed(1)} dB, yörünge ${son.yorunge} · ${yonAdi(son.gecis_yonu)}) olay adayı${islak}.`
}

/** Durum üstündeki tek satır: son net optik görüntü `esikGun`dan eskiyse (varsayılan 10) radarın son geçişi ve anlamlı değişim durumu. */
export function eskiOptikSatiri(bugun: string, sonOptik: string | null, radar: RadarEdinim[] | undefined, olaylar: RadarDegisim[] | undefined, esikGun = 10): string | null {
  if (!sonOptik) return null
  const yas = gunFarki(sonOptik, bugun)
  if (yas <= esikGun) return null
  const sonRadar = [...(radar ?? [])].reverse().find((r) => r.tarih >= sonOptik)
  if (!sonRadar) return `Son optik görüntü ${yas} gün önce · bu sürede radar geçişi kaydı yok`
  const aday = (olaylar ?? []).find((o) => o.durum === 'aday' && o.tarih >= sonOptik)
  const durum = aday ? `${aday.isaret === 'azalis' ? 'azalma' : 'artış'} olay adayı (${gunAy(aday.tarih)})` : 'anlamlı değişim yok'
  return `Son optik görüntü ${yas} gün önce · radar ${gunAy(sonRadar.tarih)}: ${durum}`
}
