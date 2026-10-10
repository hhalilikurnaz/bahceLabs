let probe: HTMLElement | null = null

/** Haritadaki çizimler koyu yüzey token'larını kullanır (altlık üstünde okunur); açık panel değerlerini değil. */
function darkSurface(): HTMLElement {
  if (!probe || !probe.isConnected) {
    probe = document.createElement('div')
    probe.className = 'surface-dark'
    probe.style.display = 'none'
    document.body.appendChild(probe)
  }
  return probe
}

/** Tema token'ını (Tailwind @theme değişkeni) harita boyası için gerçek renk değerine çevirir. */
export function cssColor(variable: string, fallback = '#7fcb6b'): string {
  const value = getComputedStyle(darkSurface()).getPropertyValue(variable).trim()
  return value || fallback
}
