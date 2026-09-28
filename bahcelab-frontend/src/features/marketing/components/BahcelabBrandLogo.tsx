import type { ComponentPropsWithoutRef } from 'react'
import logoMark from '@/assets/marketing/bahcelab-logo.png'

type LogoTone = 'light' | 'dark'

interface BahcelabBrandLogoProps extends Omit<ComponentPropsWithoutRef<'img'>, 'src' | 'alt'> {
  tone?: LogoTone
  height?: number
}

export function BahcelabBrandLogo({
  tone = 'light',
  height = 36,
  className = '',
  ...imgProps
}: BahcelabBrandLogoProps) {
  return (
    <img
      src={logoMark}
      alt="BahçeLab"
      height={height}
      className={`w-auto object-contain object-left ${tone === 'dark' ? 'brightness-0' : ''} ${className}`.trim()}
      style={{ height }}
      {...imgProps}
    />
  )
}
