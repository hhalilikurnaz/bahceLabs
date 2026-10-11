import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Bir öğenin içerik genişliğini (px) izler; grafikler gerçek piksel ölçüsünde çizilsin, araç çubuğu genişliğe göre
 * moda geçsin diye. Geri çağrı (callback) ref'i olduğundan öğe sonradan (koşullu) belirse de izlenir.
 */
export function useElementWidth<T extends HTMLElement>(initial = 320) {
  const [width, setWidth] = useState(initial)
  const observer = useRef<ResizeObserver | null>(null)

  const ref = useCallback(
    (element: T | null) => {
      observer.current?.disconnect()
      observer.current = null
      if (!element) return
      setWidth(element.clientWidth || initial)
      observer.current = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width) || initial))
      observer.current.observe(element)
    },
    [initial],
  )

  useEffect(() => () => observer.current?.disconnect(), [])
  return [ref, width] as const
}
