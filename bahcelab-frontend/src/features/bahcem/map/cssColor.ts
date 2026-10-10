/** Tema token'ını (Tailwind @theme değişkeni) harita boyası için gerçek renk değerine çevirir. */
export function cssColor(variable: string, fallback = '#7cc65a'): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
  return value || fallback
}
