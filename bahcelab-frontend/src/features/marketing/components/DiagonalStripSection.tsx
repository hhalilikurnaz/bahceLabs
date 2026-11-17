import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { StripNarrowGlyph } from './StripNarrowGlyph'
import { narrowAnchorForEdge } from './stripKenar'

export type StripTone = 'cream' | 'sage' | 'forest' | 'paper'
type TopEdge = 'flat' | 'slant-down' | 'slant-up'

const toneClasses: Record<StripTone, string> = {
  cream: 'bg-mk-cream text-mk-text',
  sage: 'bg-mk-sage text-mk-text',
  paper: 'bg-mk-paper text-mk-text',
  forest: 'bg-mk-forest text-mk-on-dark',
}

const topEdgeClass: Record<TopEdge, string> = {
  flat: 'marketing-strip-top-flat',
  'slant-down': 'marketing-strip-top-slant-down',
  'slant-up': 'marketing-strip-top-slant-up',
}

interface DiagonalStripSectionProps {
  id?: string
  tone: StripTone
  topEdge: TopEdge
  overlap?: boolean
  glyph?: { icon: LucideIcon; label: string }
  children: ReactNode
  className?: string
  /** İçerik sarmalayıcısı (alt bölüm / footer için pb ayarı) */
  contentClassName?: string
  /** Bölüm arka planı içinde, içerik sarmalayıcısının altında (ör. footer) */
  bottomSlot?: ReactNode
  /** false: position:sticky çocuklar için (blog yan sütun) */
  clipOverflow?: boolean
}

export function DiagonalStripSection({
  id,
  tone,
  topEdge,
  overlap = true,
  glyph,
  children,
  className = '',
  contentClassName = '',
  bottomSlot,
  clipOverflow = true,
}: DiagonalStripSectionProps) {
  const contentPadding =
    topEdge === 'flat' ? 'py-16 sm:py-20' : 'pt-[clamp(3.5rem,8vw,5.5rem)] pb-16 sm:pb-20'

  return (
    <section
      id={id}
      className={`relative ${clipOverflow ? 'overflow-hidden' : 'overflow-visible'} ${toneClasses[tone]} ${topEdgeClass[topEdge]} ${overlap && topEdge !== 'flat' ? 'marketing-strip-overlap' : ''} ${className}`}
    >
      {glyph && (
        <StripNarrowGlyph
          icon={glyph.icon}
          label={glyph.label}
          anchor={narrowAnchorForEdge(topEdge)}
        />
      )}
      <div
        className={`relative z-10 mx-auto max-w-6xl px-5 sm:px-8 ${contentPadding} ${contentClassName}`}
      >
        {children}
      </div>
      {bottomSlot}
    </section>
  )
}
