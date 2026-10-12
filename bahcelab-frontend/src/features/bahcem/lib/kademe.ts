/** Durum kademeleri (Adım 9B, v1): İyi · İzle · Dikkat · Sorun. Renkler durum paletidir (veri paletlerinden ayrı); her zaman etiket + işaretle. */
export const KADEMELER = ['iyi', 'izle', 'dikkat', 'sorun'] as const
export type Kademe = (typeof KADEMELER)[number]

export const KADEME_META: Record<Kademe, { ad: string; isaret: string; renk: string }> = {
  iyi: { ad: 'İyi', isaret: '●', renk: 'var(--color-app-success)' },
  izle: { ad: 'İzle', isaret: '▲', renk: 'var(--color-app-watch)' },
  dikkat: { ad: 'Dikkat', isaret: '◆', renk: 'var(--color-app-warn)' },
  sorun: { ad: 'Sorun', isaret: '■', renk: 'var(--color-app-danger)' },
}

/** Bileşen çipi seviyesi: renk yerine metin + işaret (renk körlüğü). */
export const SEVIYE_META = {
  normal: { ad: 'normal', isaret: '✓', renk: 'var(--color-app-success)' },
  normalin_alti: { ad: 'normalin altı', isaret: '▲', renk: 'var(--color-app-watch)' },
  belirgin_dusuk: { ad: 'belirgin düşük', isaret: '■', renk: 'var(--color-app-danger)' },
} as const
export type SeviyeKodu = keyof typeof SEVIYE_META
