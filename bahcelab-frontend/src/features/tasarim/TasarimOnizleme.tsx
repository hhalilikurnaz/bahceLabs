import { useEffect } from 'react'
import '../bahcem/varliklar/defter.css'
import { Varliklar } from './saha/Varliklar'

const FONTS =
  'https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap'

/** /tasarim-onizleme — YALNIZ geliştirmede: varlık sayfası (ikonlar, gravürler, kartografik öğeler, paletler, tipografi). */
export function TasarimOnizleme() {
  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = FONTS
    document.head.appendChild(link)
    return () => link.remove()
  }, [])
  return (
    <div className="notebook" data-ready="true" style={{ minHeight: '100dvh' }}>
      <Varliklar />
    </div>
  )
}
