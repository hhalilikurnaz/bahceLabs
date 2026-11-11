import type { KcKaynagi, SektorDurumu } from '../api/sulamaPanelApi'

/** Vana ortalaması (alan ağırlıklı) günlük su dengesi: ihtiyaç (ETc), gerçek tüketim (ETa), sulama (net), yağmur (ham), karşılanmayan (ETc − ETa). Veri eksik günler atlanır (uydurulmaz). */
export interface DengeGunu {
  tarih: string
  etc: number
  eta: number
  sulama: number
  yagis: number
  karsilanmayan: number
  gecici: boolean
  olculdu: boolean
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
    let gecici = false
    let olculdu = false
    for (const s of sektorler) {
      const g = s.gunler.find((x) => x.tarih === t)
      if (!g || g.veri_eksik) continue
      const w = s.alan_dekar / alan
      etc += w * (g.etc_mm ?? 0)
      eta += w * (g.eta_mm ?? 0)
      sulama += w * (g.uygulandi ? g.net_mm : 0) // yalnız UYGULANAN: bugünkü planlı sulama henüz yapılmadı
      yagis += w * (g.yagis_mm ?? 0)
      gecici ||= g.gecici
      olculdu ||= g.yagis_olculdu
    }
    return { tarih: t, etc, eta, sulama, yagis, karsilanmayan: Math.max(0, etc - eta), gecici, olculdu }
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

/** Kc'nin KAYNAĞI (ekranda): vana çokgeninin Sentinel-2 pikselleri (piksel sayısı + bulut maskesi) ya da bahçe değeri ve nedeni. */
export function kcCumlesi(k: KcKaynagi): string {
  if (k.kaynak === 'vana' && k.piksel !== null && k.toplam_piksel !== null) {
    return `Taç örtüsü %${sayiTr(k.orten_yuzde)} · Kc ${sayiTr(k.kc_bugun, 2)} — bu vananın ${k.piksel} Sentinel-2 pikselinin ortalaması (${k.tarih ? gunAyTr(k.tarih) : '—'} görüntüsü${k.maske_orani !== null ? `, bulut maskesi %${sayiTr(k.maske_orani * 100)}` : ''}; toplam ${k.toplam_piksel} piksel).`
  }
  return `Taç örtüsü %${sayiTr(k.orten_yuzde)} · Kc ${sayiTr(k.kc_bugun, 2)} — bahçe değeri${k.neden ? `: ${k.neden}` : ''}.`
}


const sayiTr = (x: number, n = 0): string => x.toLocaleString('tr-TR', { minimumFractionDigits: n, maximumFractionDigits: n })
const gunAyTr = (iso: string): string => `${Number(iso.slice(8, 10))} ${['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'][Number(iso.slice(5, 7)) - 1]}`
