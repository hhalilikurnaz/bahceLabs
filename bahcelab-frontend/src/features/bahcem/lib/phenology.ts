/** Fenoloji evresi için grafik bandı etiketi (SAF): kısa ad; tam ad ipucundadır. Sığmazsa etiket gizlenir (kesik metin yok). */
const SHORT: Record<string, string> = {
  kis_dinlenme: 'Dinlenme',
  tomurcuklanma: 'Tomurcuk',
  ciceklenme: 'Çiçek',
  meyve_tutumu: 'Tutum',
  meyve_gelisimi: 'Büyüme',
  olgunlasma: 'Olgun.',
}

/** Bilinmeyen evre kodunda adın ilk sözcüğü kullanılır. */
export const stageShortName = (code: string, name: string): string => SHORT[code] ?? (name.split(/\s+/)[0] ?? name)

/** Etiket bandın içine sığıyorsa etiketi, sığmıyorsa null verir. */
export function bandLabel(code: string, name: string, bandWidthPx: number, charPx = 6.4, padPx = 8): string | null {
  const text = stageShortName(code, name)
  return text.length * charPx + padPx <= bandWidthPx ? text : null
}
