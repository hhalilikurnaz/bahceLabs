import { useEffect, useRef } from 'react'
import type { Upscaled } from '../../lib/canvas'

/** Çizilmiş görüntüyü bir canvas'a basar; kutuya sığdırılır (en-boy oranı korunur). */
export function RasterCanvas({ image, label, className = '' }: { image: Upscaled; label: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    canvas.width = image.width
    canvas.height = image.height
    canvas.getContext('2d')?.putImageData(image.data, 0, 0)
  }, [image])
  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={label}
      className={`ndvi-pixelated max-h-full max-w-full ${className}`}
      style={{ aspectRatio: `${image.width} / ${image.height}` }}
    />
  )
}
