import { useSyncExternalStore } from 'react'

/** Dar ekran (varsayılan ≤ 560 px, telefon) mi? CSS kırılmasıyla aynı eşik; açılır/kapanır bileşenlerin başlangıç durumunu belirler. */
export function useDarEkran(azamiGenislik = 560): boolean {
  const sorgu = `(max-width: ${azamiGenislik}px)`
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(sorgu)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia(sorgu).matches,
    () => false,
  )
}
