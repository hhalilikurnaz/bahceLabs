import logoMark from '@/assets/brand/logo-mark.png'
import logoOnDark from '@/assets/brand/logo-on-dark.png'
import logoOnLight from '@/assets/brand/logo-on-light.png'

interface BrandLogoProps {
  /** Logonun üzerinde durduğu zemin: koyu zeminde açık yazılı varyant kullanılır */
  surface?: 'light' | 'dark'
  height?: number
  className?: string
}

/** bahcelabs.com landing'indeki logo; koyu ve açık zemin varyantı. */
export function BrandLogo({ surface = 'light', height = 32, className = '' }: BrandLogoProps) {
  return (
    <img
      src={surface === 'dark' ? logoOnDark : logoOnLight}
      alt="BahçeLab"
      height={height}
      className={`w-auto select-none object-contain object-left ${className}`.trim()}
      style={{ height }}
      draggable={false}
    />
  )
}

/** Yalnızca renkli çubuklu marka işareti (dar alanlar: sol menü, favicon benzeri kullanım). */
export function BrandMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src={logoMark}
      alt="BahçeLab"
      width={size}
      height={size}
      className={`select-none object-contain ${className}`.trim()}
      style={{ width: size, height: size }}
      draggable={false}
    />
  )
}
