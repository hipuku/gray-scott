import type { ReactNode } from 'react'

export type PatternKind = 'spots' | 'stripes' | 'labyrinth' | 'mitosis' | 'branch'

// Both preset ids (leopard/coral/…) and Pearson region ids (spots/worms/…) map
// onto the same five pattern glyphs.
const KIND: Record<string, PatternKind> = {
  leopard: 'spots',   spots:   'spots',
  zebra:   'stripes', stripes: 'stripes',
  coral:   'branch',  worms:   'branch',
  labyrinth: 'labyrinth',
  mitosis:   'mitosis',
}

// Each glyph literally sketches its pattern class. Elements inherit the SVG's
// stroke; the spots glyph overrides to fill since dots read better solid.
const GLYPHS: Record<PatternKind, ReactNode> = {
  spots: (
    <>
      <circle cx="7"    cy="8"    r="2.3" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="6.5"  r="1.7" fill="currentColor" stroke="none" />
      <circle cx="17"   cy="14.5" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="8.5"  cy="16"   r="2"   fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="11"   r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  stripes: (
    <>
      <path d="M3 7 Q7.5 4 12 7 T21 7" />
      <path d="M3 12 Q7.5 9 12 12 T21 12" />
      <path d="M3 17 Q7.5 14 12 17 T21 17" />
    </>
  ),
  labyrinth: <path d="M4 20 V4 H20 V20 H8 V8 H16 V16 H11.5" />,
  mitosis: (
    <>
      <circle cx="8.8"  cy="12" r="4.6" />
      <circle cx="15.2" cy="12" r="4.6" />
    </>
  ),
  branch: (
    <>
      <path d="M12 21 V13" />
      <path d="M12 13 L7.5 8.5" />
      <path d="M12 13 L16.5 8.5" />
      <path d="M7.5 8.5 L5.5 5" />
      <path d="M7.5 8.5 L9.5 5.5" />
      <path d="M16.5 8.5 L18.5 5" />
      <path d="M16.5 8.5 L14.5 5.5" />
    </>
  ),
}

interface PatternGlyphProps {
  /** A preset id (leopard, coral, …) or Pearson region id (spots, worms, …). */
  id: string
  className?: string
}

// Tiny glyph on the same 24px grid as lucide, keyed by preset or region id.
// stroke/fill inherit currentColor so it follows the chip's accent automatically.
export function PatternGlyph({ id, className = 'w-3.5 h-3.5 shrink-0' }: PatternGlyphProps) {
  const kind = KIND[id]
  if (!kind) return null
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {GLYPHS[kind]}
    </svg>
  )
}
