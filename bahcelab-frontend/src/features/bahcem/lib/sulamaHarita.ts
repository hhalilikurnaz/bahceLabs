import type { DurumEtiketi, SimulasyonYaniti } from '../api/sulamaPanelApi'
import { HARITA } from '../map/haritaRenkleri'

/** Harita göstergeleri ve sezon şeridi için SAF hesaplar (React/MapLibre yok): panel, harita ve alt çubuk aynı sayıyı bu dosyadan alır. */
export type Gosterge = 'toprak' | 'stres' | 'fazla'
export const GOSTERGE_AD: Record<Gosterge, string> = { toprak: 'Toprak suyu', stres: 'Stres · 7 gün', fazla: 'Fazla su · 7 gün' }

export interface Bantlar {
  stres: number
  yakin: number
  yeterli: number
}
/** Katalogdaki durum bantları (50/70/97; ön değer · mühendis onayı bekliyor) panelden gelir; sunucudaki `_etiket` ile aynı mantık. */
export function etiketle(pct: number | null, b: Bantlar): DurumEtiketi | null {
  if (pct === null) return null
  return pct < b.stres ? 'stres' : pct < b.yakin ? 'yakin' : pct < b.yeterli ? 'yeterli' : 'dolu'
}
export const ETIKET_RENK: Record<DurumEtiketi, string> = { stres: HARITA.ra8322a, yakin: HARITA.rf2c94c, yeterli: HARITA.r4e8750, dolu: HARITA.r2a78d6 }
/** Fazla su sınıfları (gösterim sınıfı; ön değer): 7 günde kökün altına sızan + sistem kaybı (mm). */
export const FAZLA_SINIR_MM = { az: 2, cok: 8 } as const
export const VERI_YOK_RENK = HARITA.rcccccc

export interface VanaGunu {
  ad: string
  pct: number | null
  etiket: DurumEtiketi | null
  /** son 7 günde (seçili gün dahil) Ks < 1 gün sayısı */
  stres7: number
  /** son 7 günde kökün altına sızan + sistem kaybı (mm) */
  fazla7: number
  sulaniyor: boolean
  brutMm: number
  ks: number | null
  gecici: boolean
}
export function vanaGunu(sim: SimulasyonYaniti, k: number, i: number, b: Bantlar): VanaGunu {
  const v = sim.sektorler[k]!
  let stres7 = 0
  let fazla7 = 0
  for (let j = Math.max(0, i - 6); j <= i; j++) {
    const ks = v.ks[j]
    if (ks !== null && ks !== undefined && ks < 1) stres7++
    fazla7 += v.bosa_mm[j] ?? 0
  }
  const pct = v.doluluk_pct[i] ?? null
  return { ad: v.ad, pct, etiket: etiketle(pct, b), stres7, fazla7: Math.round(fazla7 * 10) / 10, sulaniyor: (v.brut_mm[i] ?? 0) > 0, brutMm: v.brut_mm[i] ?? 0, ks: v.ks[i] ?? null, gecici: sim.gunler[i]?.gecici ?? false }
}
/** Seçili göstergeye göre dolgu rengi + yazılı sınıf (renk TEK başına anlam taşımaz: etiket metni her zaman yazılır). */
export function gostergeSinifi(g: Gosterge, v: VanaGunu): { renk: string; metin: string } {
  if (g === 'toprak') return v.etiket ? { renk: ETIKET_RENK[v.etiket], metin: { stres: 'stres', yakin: 'yakın', yeterli: 'yeterli', dolu: 'dolu' }[v.etiket] } : { renk: VERI_YOK_RENK, metin: 'veri yok' }
  if (g === 'stres') return v.stres7 === 0 ? { renk: ETIKET_RENK.yeterli, metin: 'stres yok' } : v.stres7 <= 2 ? { renk: ETIKET_RENK.yakin, metin: `${v.stres7} gün stres` } : { renk: ETIKET_RENK.stres, metin: `${v.stres7} gün stres` }
  const f = v.fazla7
  return f < FAZLA_SINIR_MM.az ? { renk: ETIKET_RENK.yeterli, metin: `${f.toLocaleString('tr-TR')} mm` } : f < FAZLA_SINIR_MM.cok ? { renk: ETIKET_RENK.yakin, metin: `${f.toLocaleString('tr-TR')} mm fazla` } : { renk: ETIKET_RENK.dolu, metin: `${f.toLocaleString('tr-TR')} mm fazla` }
}
export interface GostergeLejandi {
  renk: string
  ad: string
}
export function lejant(g: Gosterge): GostergeLejandi[] {
  if (g === 'toprak') return [{ renk: ETIKET_RENK.stres, ad: 'stres' }, { renk: ETIKET_RENK.yakin, ad: 'yakın' }, { renk: ETIKET_RENK.yeterli, ad: 'yeterli' }, { renk: ETIKET_RENK.dolu, ad: 'dolu' }]
  if (g === 'stres') return [{ renk: ETIKET_RENK.yeterli, ad: 'yok' }, { renk: ETIKET_RENK.yakin, ad: '1–2 gün' }, { renk: ETIKET_RENK.stres, ad: '3+ gün' }]
  return [{ renk: ETIKET_RENK.yeterli, ad: `< ${FAZLA_SINIR_MM.az} mm` }, { renk: ETIKET_RENK.yakin, ad: `${FAZLA_SINIR_MM.az}–${FAZLA_SINIR_MM.cok} mm` }, { renk: ETIKET_RENK.dolu, ad: `≥ ${FAZLA_SINIR_MM.cok} mm` }]
}
/** Taç rengi: stresli vanada sararır (Ks < 1); aksi halde yeşil. */
export function tacRengi(v: VanaGunu): string {
  return v.ks !== null && v.ks < 1 ? HARITA.rf2c94c : HARITA.r357a43
}

/** Sulama günleri (indeks): ← önceki / sonraki sulama → ve sezon şeridi için. Bir vanada brüt su varsa gün sulamalıdır. */
export function sulamaGunleri(sim: SimulasyonYaniti): number[] {
  const out: number[] = []
  for (let i = 0; i < sim.gunler.length; i++) if (sim.sektorler.some((v) => (v.brut_mm[i] ?? 0) > 0)) out.push(i)
  return out
}
export function oncekiSonraki(gunler: number[], i: number): { onceki: number | null; sonraki: number | null } {
  let onceki: number | null = null
  let sonraki: number | null = null
  for (const g of gunler) {
    if (g < i) onceki = g
    if (g > i && sonraki === null) sonraki = g
  }
  return { onceki, sonraki }
}
/** Vardiya, seçili günün sulama kalemi: saatler vardiyalardan; «şu an» çizgisi ve ilerleme için. */
export function vardiyaIlerleme(baslangicDk: number, bitisDk: number, simdiDk: number): number {
  if (bitisDk <= baslangicDk) return 0
  return Math.max(0, Math.min(1, (simdiDk - baslangicDk) / (bitisDk - baslangicDk)))
}
/** Bahçe ortalama (alan ağırlıksız) toprak suyu: üst kartta «ortalama toprak suyu». */
export function ortalama(v: (number | null)[]): number | null {
  const d = v.filter((x): x is number => x !== null)
  return d.length ? d.reduce((a, b) => a + b, 0) / d.length : null
}
/** Bearing: uzun eksen (0–180, kuzeyden saat yönü) ekranda YATAY (geniş) ya da DİKEY (dar) olacak biçimde harita dönüşü (-90..90]. */
export function hedefBearing(uzunEksen: number, yatay: boolean): number {
  const b = yatay ? uzunEksen - 90 : uzunEksen
  const n = ((((b + 90) % 180) + 180) % 180) - 90
  return n === -90 ? 90 : n
}
