import { useEffect, useRef, useState } from 'react'

/** Bir öğenin içerik genişliğini (px) izler; grafikler gerçek piksel ölçüsünde çizilsin diye. */
export function useElementWidth<T extends HTMLElement>(initial = 320) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(initial)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth || initial)
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width) || initial))
    observer.observe(el)
    return () => observer.disconnect()
  }, [initial])
  return [ref, width] as const
}
