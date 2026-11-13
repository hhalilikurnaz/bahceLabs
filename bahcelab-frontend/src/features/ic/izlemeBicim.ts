export const sayi = (x: number | null | undefined, n = 2): string => (x === null || x === undefined ? '—' : x.toLocaleString('tr-TR', { minimumFractionDigits: n, maximumFractionDigits: n }))
export const yuzde = (x: number | null | undefined): string => (x === null || x === undefined ? '—' : `%${Math.round(x * 100)}`)
const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
export const gunAy = (iso: string): string => `${Number(iso.slice(8, 10))} ${AY[Number(iso.slice(5, 7)) - 1]}`
export const ayYil = (iso: string): string => `${AY[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`

/** Renk tek başına anlam taşımaz: her durumun simgesi ve metni var (WCAG 1.4.1). */
export const DURUM_META: Record<string, { ad: string; isaret: string; sinif: string; hucre: string }> = {
  taze: { ad: 'taze', isaret: '●', sinif: 'text-app-success', hucre: 'bg-app-success' },
  uyumlu: { ad: 'uyumlu', isaret: '●', sinif: 'text-app-success', hucre: 'bg-app-success' },
  gecikmeli: { ad: 'gecikmeli', isaret: '▲', sinif: 'text-app-warn', hucre: 'bg-app-warn' },
  kopuk: { ad: 'kopuk', isaret: '✕', sinif: 'text-app-danger', hucre: 'bg-app-danger' },
  drift: { ad: 'kayıyor (drift)', isaret: '✕', sinif: 'text-app-danger', hucre: 'bg-app-danger' },
  bos: { ad: 'veri yok', isaret: '○', sinif: 'text-app-text-muted', hucre: 'bg-app-border-strong' },
  yetersiz: { ad: 'yetersiz veri', isaret: '○', sinif: 'text-app-text-muted', hucre: 'bg-app-border-strong' },
}
export const GUVEN_AD: Record<string, string> = { yuksek: 'yüksek', orta: 'orta', dusuk: 'düşük' }
