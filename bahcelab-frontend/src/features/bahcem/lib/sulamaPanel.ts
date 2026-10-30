import type { SektorDurumu } from '../api/sulamaPanelApi'

/** Vana ortalaması (alan ağırlıklı) günlük su dengesi: ihtiyaç (ETc), gerçek tüketim (ETa), sulama (net), yağmur (ham), karşılanmayan (ETc − ETa). Veri eksik günler atlanır (uydurulmaz). */
export interface DengeGunu {
  tarih: string
  etc: number
  eta: number
  sulama: number
  yagis: number
  karsilanmayan: number
}
export interface DengeOzeti {
  gunler: DengeGunu[]
  toplam: { etc: number; eta: number; sulama: number; yagmur: number; karsilanmayan: number }
}

export function suDengesi(sektorler: SektorDurumu[], bugun: string, gunSayisi = 14): DengeOzeti {
  const alan = sektorler.reduce((a, s) => a + s.alan_dekar, 0)
  const tarihler = new Set<string>()
  for (const s of sektorler) for (const g of s.gunler) if (!g.tahmin && !g.veri_eksik && g.tarih <= bugun) tarihler.add(g.tarih)
  const sirali = [...tarihler].sort().slice(-gunSayisi)
  const gunler: DengeGunu[] = sirali.map((t) => {
    let etc = 0
    let eta = 0
    let sulama = 0
    let yagis = 0
    for (const s of sektorler) {
      const g = s.gunler.find((x) => x.tarih === t)
      if (!g || g.veri_eksik) continue
      const w = s.alan_dekar / alan
      etc += w * (g.etc_mm ?? 0)
      eta += w * (g.eta_mm ?? 0)
      sulama += w * (g.uygulandi ? g.net_mm : 0) // yalnız UYGULANAN: bugünkü planlı sulama henüz yapılmadı
      yagis += w * (g.yagis_mm ?? 0)
    }
    return { tarih: t, etc, eta, sulama, yagis, karsilanmayan: Math.max(0, etc - eta) }
  })
  const topla = (f: (g: DengeGunu) => number) => gunler.reduce((a, g) => a + f(g), 0)
  return { gunler, toplam: { etc: topla((g) => g.etc), eta: topla((g) => g.eta), sulama: topla((g) => g.sulama), yagmur: topla((g) => g.yagis), karsilanmayan: topla((g) => g.karsilanmayan) } }
}

export const ETIKET_AD = { stres: 'stres', yakin: 'yakın', yeterli: 'yeterli', dolu: 'dolu' } as const

/** «V2 · %92» ve «yeterli · sonraki 22 Tem» (harita etiketi ve vana satırı AYNI metni kullanır). */
export function vanaEtiketi(s: SektorDurumu): { baslik: string; alt: string } {
  const pct = s.doluluk_pct === null ? '—' : `%${Math.round(s.doluluk_pct)}`
  const ay = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
  const sonraki = s.sonraki_sulama ? `sonraki ${Number(s.sonraki_sulama.slice(8, 10))} ${ay[Number(s.sonraki_sulama.slice(5, 7)) - 1]}` : 'sulama gerekmiyor'
  return { baslik: `${s.ad} · ${pct}`, alt: `${s.etiket ? ETIKET_AD[s.etiket] : 'veri yok'} · ${sonraki}` }
}
