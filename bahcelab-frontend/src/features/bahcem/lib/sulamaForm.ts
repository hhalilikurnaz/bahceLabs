import type { Enerji, SulamaProfil, SulamaSistemi } from '../api/sulamaApi'

/** Sulama sihirbazı girdileri (metin) ↔ sunucu gövdesi. Virgül/nokta ondalık kabul edilir; boş = bilinmiyor (uydurulmaz). */
export interface SihirbazGirdisi {
  sistem: SulamaSistemi
  damlaticiSayisi: string
  damlaticiDebi: string
  siraAralik: string
  agacAralik: string
  pompaBilinmiyor: boolean
  pompaKw: string
  pompaDebi: string
  enerji: Enerji
  kwhFiyat: string
  m3Maliyet: string
  suUcreti: string
}

export const sayiOku = (s: string): number | null => {
  const t = s.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : Number.NaN
}

export type SihirbazHatalari = Partial<Record<keyof SihirbazGirdisi, string>>

const POZITIF: (keyof SihirbazGirdisi)[] = ['damlaticiSayisi', 'damlaticiDebi', 'siraAralik', 'agacAralik', 'pompaKw', 'pompaDebi', 'kwhFiyat', 'm3Maliyet', 'suUcreti']
const SIFIR_OK = new Set<keyof SihirbazGirdisi>(['kwhFiyat', 'm3Maliyet', 'suUcreti'])

export function sihirbazDogrula(g: SihirbazGirdisi): SihirbazHatalari {
  const e: SihirbazHatalari = {}
  for (const k of POZITIF) {
    const v = g[k]
    if (typeof v !== 'string') continue
    const n = sayiOku(v)
    if (n === null) continue
    if (Number.isNaN(n)) e[k] = 'Sayı girin.'
    else if (n < 0 || (n === 0 && !SIFIR_OK.has(k))) e[k] = 'Sıfırdan büyük olmalı.'
  }
  const adet = sayiOku(g.damlaticiSayisi)
  if (adet !== null && !Number.isNaN(adet) && (!Number.isInteger(adet) || adet > 64)) e.damlaticiSayisi = '1–64 arası tam sayı girin.'
  return e
}

export function sihirbazGovdesi(g: SihirbazGirdisi): SulamaProfil {
  const damla = g.sistem === 'damla'
  const pompa = !g.pompaBilinmiyor
  return {
    sistem: g.sistem,
    damlatici_sayisi: damla ? sayiOku(g.damlaticiSayisi) : null,
    damlatici_debi_lh: damla ? sayiOku(g.damlaticiDebi) : null,
    sira_aralik_m: sayiOku(g.siraAralik),
    agac_aralik_m: sayiOku(g.agacAralik),
    pompa_kw: pompa ? sayiOku(g.pompaKw) : null,
    pompa_debi_m3h: pompa ? sayiOku(g.pompaDebi) : null,
    enerji: g.enerji,
    kwh_fiyat_tl: g.enerji === 'sebeke' ? sayiOku(g.kwhFiyat) : null,
    enerji_m3_maliyet_tl: g.enerji === 'sebeke' ? null : sayiOku(g.m3Maliyet),
    su_ucreti_m3_tl: sayiOku(g.suUcreti),
  }
}

const metin = (n: number | null): string => (n === null ? '' : String(n).replace('.', ','))

export function sihirbazBaslangici(p: SulamaProfil | null): SihirbazGirdisi {
  return {
    sistem: p?.sistem ?? 'damla',
    damlaticiSayisi: metin(p?.damlatici_sayisi ?? null),
    damlaticiDebi: metin(p?.damlatici_debi_lh ?? null),
    siraAralik: metin(p?.sira_aralik_m ?? null),
    agacAralik: metin(p?.agac_aralik_m ?? null),
    pompaBilinmiyor: p !== null && p.pompa_kw === null && p.pompa_debi_m3h === null,
    pompaKw: metin(p?.pompa_kw ?? null),
    pompaDebi: metin(p?.pompa_debi_m3h ?? null),
    enerji: p?.enerji ?? 'sebeke',
    kwhFiyat: metin(p?.kwh_fiyat_tl ?? null),
    m3Maliyet: metin(p?.enerji_m3_maliyet_tl ?? null),
    suUcreti: metin(p?.su_ucreti_m3_tl ?? null),
  }
}

export const SISTEM_AD: Record<SulamaSistemi, string> = { damla: 'Damla sulama', mini_yagmurlama: 'Mini yağmurlama', salma: 'Salma sulama' }
export const ENERJI_AD: Record<Enerji, string> = { sebeke: 'Şebeke elektriği', gunes: 'Güneş', dizel: 'Dizel' }
