// Approximate classification of (f, k) parameter space based on
// Pearson, J.E. (1993) "Complex Patterns in a Simple System", Science 261(5118).
//
// Each region entry defines the bounding box in (f, k) space and the
// pattern type that emerges. Used by ViewSpace to colour the map and
// label clickable regions.

export interface PearsonRegion {
  id: string
  label: string
  fMin: number
  fMax: number
  kMin: number
  kMax: number
  // hex used for canvas drawing (CSS variables don't resolve in canvas context)
  hex: string
  // CSS variable used for styled legend chips
  colour: string
  /** The named preset that sits inside this region, which its button runs. */
  preset: string
  // StatusChip colour token name
  chipColour: 'nebula' | 'aurora' | 'tidal' | 'quasar' | 'dusk'
}

// f axis: 0.01 – 0.08   (feed rate)
// k axis: 0.04 – 0.075  (kill rate)
export const PEARSON_REGIONS: PearsonRegion[] = [
  {
    id: 'spots',
    preset: 'leopard',
    label: 'Spots',
    fMin: 0.025, fMax: 0.055,
    kMin: 0.058, kMax: 0.068,
    hex: '#68D0CA',
    colour: 'var(--color-tidal)',
    chipColour: 'tidal',
  },
  {
    id: 'stripes',
    preset: 'zebra',
    label: 'Stripes',
    fMin: 0.014, fMax: 0.030,
    kMin: 0.051, kMax: 0.062,
    hex: '#82D25D',
    colour: 'var(--color-aurora)',
    chipColour: 'aurora',
  },
  {
    id: 'labyrinth',
    preset: 'labyrinth',
    label: 'Labyrinth',
    fMin: 0.030, fMax: 0.055,
    kMin: 0.053, kMax: 0.062,
    hex: '#BF9FF1',
    colour: 'var(--color-quasar)',
    chipColour: 'quasar',
  },
  {
    id: 'mitosis',
    preset: 'mitosis',
    label: 'Mitosis',
    fMin: 0.022, fMax: 0.036,
    kMin: 0.057, kMax: 0.065,
    hex: '#15AD70',
    colour: 'var(--color-nebula)',
    chipColour: 'nebula',
  },
  {
    id: 'worms',
    preset: 'coral',
    label: 'Worms',
    fMin: 0.046, fMax: 0.068,
    kMin: 0.058, kMax: 0.066,
    hex: '#F5D4C0',
    colour: 'var(--color-dusk)',
    chipColour: 'dusk',
  },
]

/**
 * The region a point belongs to. Pearson's regions overlap, because the
 * pattern classes shade into one another at their edges, so a point inside
 * more than one goes to the region whose centre is nearest. Distance is
 * measured on each axis relative to the map's range, since f spans twice the
 * range k does. Taking the first match instead labelled the Mitosis preset
 * "Spots", because the Spots box also contains it.
 */
export function classifyRegion(f: number, k: number): PearsonRegion | null {
  let best: PearsonRegion | null = null
  let bestDistance = Infinity
  for (const r of PEARSON_REGIONS) {
    if (f < r.fMin || f > r.fMax || k < r.kMin || k > r.kMax) continue
    const df = (f - (r.fMin + r.fMax) / 2) / (F_MAX - F_MIN)
    const dk = (k - (r.kMin + r.kMax) / 2) / (K_MAX - K_MIN)
    const distance = Math.hypot(df, dk)
    if (distance < bestDistance) {
      best = r
      bestDistance = distance
    }
  }
  return best
}

// Axis ranges for the parameter space canvas
export const F_MIN = 0.01
export const F_MAX = 0.08
export const K_MIN = 0.04
export const K_MAX = 0.075
