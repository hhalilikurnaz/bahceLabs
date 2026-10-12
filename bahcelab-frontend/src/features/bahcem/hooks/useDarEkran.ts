import { useSyncExternalStore } from 'react'

/** Dar ekran (≤ 560 px, telefon) mi? CSS kırılmasıyla aynı eşik; açılır/kapanır bileşenlerin başlangıç durumunu belirler. */
const SORGU = '(max-width: 560px)'
const abone = (cb: () => void) => {
  const mq = window.matchMedia(SORGU)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
export function useDarEkran(): boolean {
  return useSyncExternalStore(abone, () => window.matchMedia(SORGU).matches, () => false)
}
