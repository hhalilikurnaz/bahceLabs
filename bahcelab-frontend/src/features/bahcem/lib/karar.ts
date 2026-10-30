/**
 * Karar cümleleri (ilke 1, 2): kısa, tek cümle, noktalı virgülsüz, jargonsuz; bir ziraat mühendisinin konuşması gibi.
 * «Normal bant», «kademe», «p10–p90», «NDVI» başlıkta geçmez; ayrıntı «?» ve akordeon içinde kalır. Hepsi SAF işlevdir (tests/karar.test.ts).
 */
import type { NormalBantAy } from '../api/normalBantApi'

export type KonumKodu = 'icinde' | 'altinda' | 'ustunde'

/** Değerin bahçenin kendi normal bandına (p25–p75) göre konumu; band yetersizse null. */
export function konumOf(deger: number, band: Pick<NormalBantAy, 'p25' | 'p75' | 'ceyrek_yeterli'> | undefined): KonumKodu | null {
  if (!band || !band.ceyrek_yeterli || band.p25 === null || band.p75 === null) return null
  return deger < band.p25 ? 'altinda' : deger > band.p75 ? 'ustunde' : 'icinde'
}

const fmt = (v: number, d = 2) => v.toFixed(d).replace('.', ',').replace('-', '−')

/** Durum başlığı: «Bahçe bu mevsim için normal.» */
export function durumKarar(konum: KonumKodu | null): string {
  if (konum === null) return 'Bahçe durumu için veri yetersiz.'
  return { icinde: 'Bahçe bu mevsim için normal.', altinda: 'Bahçe bu mevsim için normalin altında.', ustunde: 'Bahçe bu mevsim için normalin üstünde.' }[konum]
}

/** Büyük sayı: bandın içindeyse «Normal»; dışındaysa ortancaya göre sapma («−%8»). Gerçek değer küçük yazıda. */
export function konumSayisi(deger: number, band: Pick<NormalBantAy, 'p25' | 'p50' | 'p75' | 'ceyrek_yeterli'> | undefined): { buyuk: string; kucuk: string } | null {
  const k = konumOf(deger, band)
  if (k === null || !band || band.p25 === null || band.p75 === null || band.p50 === null) return null
  const kucuk = `canlılık ${fmt(deger)} · bu ay genelde ${fmt(band.p25)}–${fmt(band.p75)}`
  if (k === 'icinde') return { buyuk: 'Normal', kucuk }
  const sapma = (deger / band.p50 - 1) * 100
  return { buyuk: `${sapma > 0 ? '+' : '−'}%${Math.abs(sapma).toFixed(0)}`, kucuk }
}

/** «İzlemede: meyve sineği ve kuruma hastalığı riski orta.» (API `riskler` satırlarından) */
export function riskCumlesi(riskler: string[]): string {
  const adlar: string[] = []
  const seviyeler = new Set<string>()
  for (const r of riskler) {
    const [ad, , sev] = r.split(/ (·) /)
    adlar.push(ad.split(' (')[0].toLowerCase().replace(/^akdeniz /, ''))
    if (sev) seviyeler.add(sev)
  }
  if (!adlar.length) return ''
  const s = adlar.join(' ve ')
  return `${s.charAt(0).toUpperCase()}${s.slice(1)} riski ${seviyeler.size === 1 ? [...seviyeler][0] : 'var'}.`
}

/** Su başlığı: «Toprak nemli, bu hafta sulama gerekmiyor.» */
export function suKarar(karar: 'gerekmiyor' | 'sulama' | 'izle' | 'veri_yok', sinif: 'nemli' | 'orta' | 'kuru' | string | null): string {
  if (karar === 'veri_yok' || sinif === null) return 'Su durumu için veri yetersiz.'
  const toprak = sinif === 'nemli' ? 'Toprak nemli' : sinif === 'kuru' ? 'Toprak kuru' : 'Toprak nemi orta'
  const son = { gerekmiyor: 'bu hafta sulama gerekmiyor', sulama: 'sulama zamanı geldi', izle: 'sulamayı yakından izleyin' }[karar]
  return `${toprak}, ${son}.`
}

/** Geçmiş başlığı: Sentinel-2 görüntülerinin normal banda göre dağılımından. */
export function gecmisKarar(ic: number, alt: number, ust: number): string {
  const n = ic + alt + ust
  if (n === 0) return 'Bu sezon için yeterli görüntü yok.'
  if (ic / n >= 0.5) return 'Bu sezon normal.'
  if (alt / n >= 0.5) return 'Bu sezon normalin altında kaldı.'
  if (ust / n >= 0.5) return 'Bu sezon normalin üstünde.'
  return alt / n <= 0.15 ? 'Bu sezon normal ya da normalin üstünde.' : 'Bu sezon değişken.'
}

/** Analiz başlığı: çok yıllık bölge özetinden (sunucu cümlesi değil). */
export function analizKarar(opts: { hazir: boolean; sureniyor: boolean; homojen: boolean; zayifPay: number | null }): string {
  if (opts.sureniyor) return 'Analiz sürüyor.'
  if (!opts.hazir) return 'Bölge analizi için veri yetersiz.'
  if (opts.homojen || opts.zayifPay === null) return 'Bahçe baştan sona benzer.'
  return `Bahçenin %${Math.round(opts.zayifPay * 100)}’i yıllardır zayıf.`
}

/** Saha Defteri başlığı: bu sayfanın tek işi. */
export const DEFTER_KARAR = 'Uydunun gördüğünü sahada doğrulayın.'

/** Bildirimler başlığı: okunmamış bahçe uyarısı sayısından. */
export function bildirimKarar(urun: number | null, sistem = 0): string {
  if (urun === null) return 'Bildirimler yükleniyor.'
  if (urun === 0) return sistem > 0 ? 'Bahçeniz için uyarı yok, sistem uyarısı var.' : 'Bahçeniz için yeni uyarı yok.'
  return urun === 1 ? 'Bir yeni uyarınız var.' : `${urun} yeni uyarınız var.`
}

/** Analiz büyük sayı etiketi */
export function analizBuyukSayi(zayifDekar: number | null): { buyuk: string; etiket: string } | null {
  if (zayifDekar === null) return null
  return { buyuk: `${fmt(zayifDekar, 1)} da`, etiket: 'sürekli zayıf alan' }
}

/** Hava başlığı: yağış ve don durumuna göre tek cümle. */
export function havaKarar(opts: { don: boolean; yagisYakin: boolean; ilaclamaUygun: boolean }): string {
  if (opts.don) return 'Don bekleniyor, önlem alın.'
  if (opts.yagisYakin) return 'Yağış yakın, ilaçlamayı erteleyin.'
  return opts.ilaclamaUygun ? 'Bu hafta ilaçlama için uygun.' : 'Bu hafta ilaçlama için dikkatli olun.'
}

const SAYI_ADI = ['Sıfır', 'Bir', 'İki', 'Üç', 'Dört', 'Beş', 'Altı', 'Yedi', 'Sekiz', 'Dokuz', 'On']
const KADEME_FIILI: Record<string, string> = { iyi: 'iyi durumda', izle: 'izlemede', dikkat: 'dikkat istiyor', sorun: 'sorunlu' }

/** Bahçeler listesi başlığı: «İki bahçe de izlemede.» / «Bir bahçe dikkat istiyor.» (kademe adı değil, fiil). */
export function listeKarar(kademeler: (string | undefined)[]): string | null {
  const v = kademeler.filter((k): k is string => !!k && k in KADEME_FIILI)
  if (v.length === 0) return null
  const sayi = (n: number) => SAYI_ADI[n] ?? String(n)
  if (v.length === 1) return `Bahçe ${KADEME_FIILI[v[0]]}.`
  if (v.every((k) => k === v[0])) return `${sayi(v.length)} bahçe de ${KADEME_FIILI[v[0]]}.`
  const sira = ['sorun', 'dikkat', 'izle', 'iyi']
  const en = sira.find((k) => v.includes(k))!
  return `${sayi(v.filter((k) => k === en).length)} bahçe ${KADEME_FIILI[en]}.`
}

// ----------------------------------------------------------------------------- sulama planı (9H)
const HAFTA_GUNU = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
const gunFarki = (a: string, b: string): number => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000)
const gunAdi = (iso: string): string => HAFTA_GUNU[new Date(`${iso}T12:00:00Z`).getUTCDay()]

/** Damlatıcı süresi: «2 sa 25 dk» (kısa, çizelge/satır) ya da «2 saat 25 dakika» (cümle). */
export function sureMetni(dk: number, uzun = false): string {
  const s = Math.floor(dk / 60)
  const d = Math.round(dk % 60)
  const sa = uzun ? 'saat' : 'sa'
  const dak = uzun ? 'dakika' : 'dk'
  return [s > 0 ? `${s} ${sa}` : '', d > 0 || s === 0 ? `${d} ${dak}` : ''].filter(Boolean).join(' ')
}

export interface SulamaKararGirdisi {
  durum: 'hazir' | 'profil_yok' | 'veri_yok'
  bugun: string
  sonraki: { tarih: string; emitor_dakika: number | null; m3_bahce: number } | null
}

/** Sulama planı başlığı: «Perşembe sabah 2 saat 25 dakika sulayın.» / «Bu hafta sulama gerekmiyor.» Süre yoksa (damlatıcı bilgisi eksik) m³ söylenir, sayı uydurulmaz. */
export function sulamaKarar(p: SulamaKararGirdisi): string {
  if (p.durum === 'profil_yok') return 'Sulama planı için bahçenizin sulama bilgisi gerekiyor.'
  if (p.durum === 'veri_yok' || !p.sonraki) return p.durum === 'veri_yok' ? 'Sulama planı için veri yetersiz.' : 'Bu hafta sulama gerekmiyor.'
  const fark = gunFarki(p.bugun, p.sonraki.tarih)
  if (fark > 6) return 'Bu hafta sulama gerekmiyor.'
  const zaman = fark === 0 ? 'Bugün' : fark === 1 ? 'Yarın' : gunAdi(p.sonraki.tarih)
  return p.sonraki.emitor_dakika ? `${zaman} sabah ${sureMetni(p.sonraki.emitor_dakika, true)} sulayın.` : `${zaman} yaklaşık ${Math.round(p.sonraki.m3_bahce)} metreküp sulayın.`
}

/** Durum/Bugün kartındaki tek satır: «Sulama: Perşembe, 2 sa 25 dk». Plan yoksa null (satır hiç çizilmez). */
export function sulamaSatiri(p: SulamaKararGirdisi): string | null {
  if (p.durum !== 'hazir') return null
  if (!p.sonraki || gunFarki(p.bugun, p.sonraki.tarih) > 6) return 'Sulama: bu hafta gerekmiyor'
  const fark = gunFarki(p.bugun, p.sonraki.tarih)
  const gun = fark === 0 ? 'bugün' : fark === 1 ? 'yarın' : gunAdi(p.sonraki.tarih)
  return `Sulama: ${gun}, ${p.sonraki.emitor_dakika ? sureMetni(p.sonraki.emitor_dakika) : `≈ ${Math.round(p.sonraki.m3_bahce)} m³`}`
}
