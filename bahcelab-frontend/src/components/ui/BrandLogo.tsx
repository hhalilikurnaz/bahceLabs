interface BrandLogoProps {
  /** Logonun üzerinde durduğu zemin: koyu zeminde açık renkli işaret ve yazı kullanılır */
  surface?: 'light' | 'dark'
  height?: number
  className?: string
}

/** Marka işareti: uygulama üst çubuğundaki yaprak işaretiyle aynı çizim (tek logo). Renkler token'dan. */
export function BrandMark({ size = 32, surface = 'light', className = '' }: { size?: number; surface?: 'light' | 'dark'; className?: string }) {
  const dark = surface === 'dark'
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden className={`shrink-0 ${className}`.trim()}>
      <rect width={32} height={32} rx={3} className={dark ? 'fill-mk-on-dark' : 'fill-brand'} />
      <path d="M8 24C8 14 14 8 24 8c0 10-6 16-16 16zM8 24l9-9" className={dark ? 'stroke-mk-night' : 'stroke-cream'} strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  )
}

/** Tek marka logosu: işaret + «BahçeLab» (ç ile, gerçek metin). Her yerde bu bileşen kullanılır. */
export function BrandLogo({ surface = 'light', height = 32, className = '' }: BrandLogoProps) {
  const dark = surface === 'dark'
  return (
    <span className={`inline-flex select-none items-center gap-2.5 whitespace-nowrap ${className}`.trim()} style={{ height }}>
      <BrandMark size={height} surface={surface} />
      <span className={`font-semibold tracking-tight ${dark ? 'text-mk-on-dark' : 'text-mk-ink'}`} style={{ fontSize: Math.max(16, Math.round(height * 0.62)), lineHeight: 1 }}>
        BahçeLab
      </span>
    </span>
  )
}
