import type { NarrowAnchor } from './StripNarrowGlyph'

export function narrowAnchorForEdge(topEdge: 'flat' | 'slant-down' | 'slant-up'): NarrowAnchor {
  if (topEdge === 'slant-down') return 'top-left'
  if (topEdge === 'slant-up') return 'top-right'
  return 'edge-right'
}
