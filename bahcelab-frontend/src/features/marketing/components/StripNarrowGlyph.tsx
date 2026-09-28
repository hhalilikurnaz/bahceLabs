import type { LucideIcon } from 'lucide-react'

export type NarrowAnchor = 'top-left' | 'top-right' | 'edge-right'

interface StripNarrowGlyphProps {
  icon: LucideIcon
  anchor: NarrowAnchor
  label: string
}

const anchorClass: Record<NarrowAnchor, string> = {
  'top-left':
    'left-0 top-0 bottom-0 flex w-[min(58%,24rem)] items-center justify-start overflow-visible lg:w-[min(54%,26rem)]',
  'top-right':
    'right-0 top-0 bottom-0 flex w-[min(58%,24rem)] items-center justify-end overflow-visible lg:w-[min(54%,26rem)]',
  'edge-right':
    'right-0 top-0 bottom-0 flex w-[min(56%,23rem)] items-center justify-end overflow-visible lg:w-[min(52%,25rem)]',
}

const driftClass: Record<NarrowAnchor, string> = {
  'top-left': 'marketing-accent-drift-left',
  'top-right': 'marketing-accent-drift-right',
  'edge-right': 'marketing-accent-drift-right',
}

const nudgeClass: Record<NarrowAnchor, string> = {
  'top-left': '-translate-x-[22%]',
  'top-right': 'translate-x-[22%]',
  'edge-right': 'translate-x-[18%]',
}

export function narrowAnchorForEdge(topEdge: 'flat' | 'slant-down' | 'slant-up'): NarrowAnchor {
  if (topEdge === 'slant-down') return 'top-left'
  if (topEdge === 'slant-up') return 'top-right'
  return 'edge-right'
}

export function StripNarrowGlyph({ icon: Icon, anchor, label }: StripNarrowGlyphProps) {
  return (
    <div
      className={`pointer-events-none absolute z-0 ${anchorClass[anchor]}`}
      role="img"
      aria-label={label}
    >
      <div className={`${driftClass[anchor]} ${nudgeClass[anchor]}`}>
        <Icon
          className="size-[clamp(11rem,62vmin,20rem)] shrink-0 text-[#2d6b45]/[0.08] sm:size-[clamp(12rem,58vmin,22rem)] lg:size-[clamp(13rem,52vmin,24rem)]"
          strokeWidth={0.75}
          aria-hidden
        />
      </div>
    </div>
  )
}
