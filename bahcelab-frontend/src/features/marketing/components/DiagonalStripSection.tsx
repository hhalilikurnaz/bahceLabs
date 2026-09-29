import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Reveal } from './Reveal'
import { narrowAnchorForEdge, StripNarrowGlyph } from './StripNarrowGlyph'

export type StripTone = 'cream' | 'sage' | 'forest' | 'paper'
type TopEdge = 'flat' | 'slant-down' | 'slant-up'

const toneClasses: Record<StripTone, string> = {
  cream: 'bg-marketing-cream text-[#1a241c]',
  sage: 'bg-[#e4ede0] text-[#1a241c]',
  paper: 'bg-[#f0ece3] text-[#1a241c]',
  forest: 'bg-[#0f2a1c] text-[#f3efe4]',
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
  clipOverflow = true,
}: DiagonalStripSectionProps) {
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
        className={`relative z-10 mx-auto max-w-6xl px-5 sm:px-8 ${
          topEdge === 'flat' ? 'py-16 sm:py-20' : 'pt-[clamp(3.5rem,8vw,5.5rem)] pb-16 sm:pb-20'
        }`}
      >
        {children}
      </div>
    </section>
  )
}

export function textSideForStripEdge(topEdge: TopEdge): 'left' | 'right' {
  if (topEdge === 'slant-up') return 'left'
  return 'right'
}

interface StripTextContentProps {
  title: string
  children: ReactNode
  textSide: 'left' | 'right'
  eyebrow?: string
  /** Kart / grafik gibi geniş içerik için */
  wide?: boolean
}

export function StripTextContent({
  title,
  children,
  textSide,
  eyebrow,
  wide = false,
}: StripTextContentProps) {
  const alignLeft = textSide === 'left'
  const widthClass = wide ? 'max-w-4xl' : 'max-w-2xl'

  return (
    <div className={alignLeft ? widthClass : `ml-auto ${widthClass}`}>
      {eyebrow && (
        <Reveal>
            <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.24em] text-[#2d6b45]/75">
              {eyebrow}
            </p>
        </Reveal>
      )}
      <Reveal delayMs={60}>
          <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[#0c2418] sm:text-3xl lg:text-[1.875rem] lg:leading-snug">
          {title}
        </h2>
      </Reveal>
      <Reveal delayMs={120}>
        <div className="mt-5 space-y-4 text-[15px] leading-[1.75] text-[#4b554c] sm:text-base">
          {children}
        </div>
      </Reveal>
    </div>
  )
}

/** @deprecated use StripTextContent */
export const AlternatingStripContent = StripTextContent
