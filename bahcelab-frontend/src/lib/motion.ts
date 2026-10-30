import { useEffect, useState } from 'react'

/** Hareket token'ları (CSS karşılıkları styles/tokens.css'te). Süreler 150–250 ms, eğri ease-out; yaylı bırakma yalnız alt sayfada. */
export const MOTION = {
  hizli: 150,
  temel: 200,
  panel: 250,
  cizim: 600,
  sayi: 400,
  ucus: 600,
  ease: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
} as const

export const reducedMotion = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** «prefers-reduced-motion» değişimini izler (animasyon kapalıysa süreler 0). */
export function useReducedMotion(): boolean {
  const [azalt, setAzalt] = useState(reducedMotion)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const q = window.matchMedia('(prefers-reduced-motion: reduce)')
    const f = () => setAzalt(q.matches)
    q.addEventListener('change', f)
    return () => q.removeEventListener('change', f)
  }, [])
  return azalt
}

/** Süre (ms): reduced-motion'da 0 */
export const sure = (ms: number): number => (reducedMotion() ? 0 : ms)
