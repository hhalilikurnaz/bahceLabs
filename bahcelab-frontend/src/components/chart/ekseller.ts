/** Grafik ekseni için SAF yardımcılar (1-2-5 «yuvarlak» çentik; tek kaynak: features/bahcem/lib/chartScale). */
export { niceTicks, paddedDomain, type Domain } from '@/features/bahcem/lib/chartScale'

/** SVG içi yazı tabanı (ilke 9): 12 px altı yok, yarım piksel yok. tests/chart.test.ts bunu bekler. */
export const YAZI_TABAN = 12
export const YAZI = { eksen: 12, etiket: 12, vurgu: 13 } as const

const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'] as const
export const ayKisa = (i: number): string => AY[i]

/** Dar alanda her ikinci ayı etiketle (sığmayan etiket kesilmez, atlanır). */
export const ayAdimi = (genislikPx: number, etiketPx = 34): 1 | 2 | 3 => (genislikPx / 12 >= etiketPx ? 1 : genislikPx / 6 >= etiketPx ? 2 : 3)

/** Sayı biçimi (Türkçe virgül) */
export const fmt = (v: number, d = 2): string => v.toFixed(d).replace('.', ',').replace('-', '−')
