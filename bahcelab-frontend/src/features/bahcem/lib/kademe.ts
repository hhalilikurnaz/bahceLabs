/** Durum kademeleri (Adım 9B, v1): İyi · İzle · Dikkat · Sorun. Renkler durum paletidir (veri paletlerinden ayrı); her zaman etiket + işaretle. */
export const KADEMELER = ['iyi', 'izle', 'dikkat', 'sorun'] as const
export type Kademe = (typeof KADEMELER)[number]

export const KADEME_META: Record<Kademe, { ad: string; isaret: string; renk: string }> = {
  iyi: { ad: 'İyi', isaret: '●', renk: 'var(--color-app-success)' },
  izle: { ad: 'İzle', isaret: '▲', renk: 'var(--color-app-watch)' },
  dikkat: { ad: 'Dikkat', isaret: '◆', renk: 'var(--color-app-warn)' },
  sorun: { ad: 'Sorun', isaret: '■', renk: 'var(--color-app-danger)' },
}

/** Bileşen etiketi (TEK kural, her bileşende aynı): p25–p75 normal · p10–p25 / p75–p90 normalin altı/üstü · <p10 / >p90 belirgin. Renk yerine metin + işaret (renk körlüğü). */
export const SEVIYE_META = {
  normal: { ad: 'normal', isaret: '✓', renk: 'var(--color-app-success)' },
  normalin_alti: { ad: 'normalin altı', isaret: '▼', renk: 'var(--color-app-watch)' },
  belirgin_dusuk: { ad: 'belirgin düşük', isaret: '■', renk: 'var(--color-app-danger)' },
  normalin_ustu: { ad: 'normalin üstü', isaret: '▲', renk: 'var(--color-app-text-muted)' },
  belirgin_yuksek: { ad: 'belirgin yüksek', isaret: '◆', renk: 'var(--color-app-text-muted)' },
} as const
export type SeviyeKodu = keyof typeof SEVIYE_META

/** Isıda YUKARI yön kötüdür (yüzey–hava farkı normalin üstü); diğer bileşenlerde yukarı yön ceza değildir. */
export function seviyeMeta(kod: string, seviye: SeviyeKodu | null): { ad: string; isaret: string; renk: string } | null {
  if (!seviye) return null
  if (kod === 'isi' && seviye === 'normalin_ustu') return { ad: 'normalin üstü', isaret: '▲', renk: 'var(--color-app-watch)' }
  if (kod === 'isi' && seviye === 'belirgin_yuksek') return { ad: 'belirgin yüksek', isaret: '■', renk: 'var(--color-app-danger)' }
  return SEVIYE_META[seviye]
}

/** Harita çokgen dolguları için sabit renkler (MapLibre CSS değişkeni okumaz); `KADEME_META.renk` ile aynı tonlar. */
export const KADEME_HEX: Record<Kademe | 'veri_yok', string> = { iyi: '#2d6a4a', izle: '#8a6a0c', dikkat: '#a24f1b', sorun: '#a8322a', veri_yok: '#687068' }
