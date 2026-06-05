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
  // StatusChip colour token name
  chipColour: 'nebula' | 'aurora' | 'tidal' | 'quasar' | 'dusk'
}

// f axis: 0.01 – 0.08   (feed rate)
// k axis: 0.04 – 0.075  (kill rate)
export const PEARSON_REGIONS: PearsonRegion[] = [
  {
    id: 'spots',
    label: 'Spots',
    fMin: 0.025, fMax: 0.055,
    kMin: 0.058, kMax: 0.068,
    hex: '#68D0CA',
    colour: 'var(--color-tidal)',
    chipColour: 'tidal',
  },
  {
    id: 'stripes',
    label: 'Stripes',
    fMin: 0.014, fMax: 0.030,
    kMin: 0.051, kMax: 0.062,
    hex: '#82D25D',
    colour: 'var(--color-aurora)',
    chipColour: 'aurora',
  },
  {
    id: 'labyrinth',
    label: 'Labyrinth',
    fMin: 0.030, fMax: 0.055,
    kMin: 0.053, kMax: 0.062,
    hex: '#BF9FF1',
    colour: 'var(--color-quasar)',
    chipColour: 'quasar',
  },
  {
    id: 'mitosis',
    label: 'Mitosis',
    fMin: 0.022, fMax: 0.036,
    kMin: 0.057, kMax: 0.065,
    hex: '#15AD70',
    colour: 'var(--color-nebula)',
    chipColour: 'nebula',
  },
  {
    id: 'worms',
    label: 'Worms',
    fMin: 0.046, fMax: 0.068,
    kMin: 0.058, kMax: 0.066,
    hex: '#F5D4C0',
    colour: 'var(--color-dusk)',
    chipColour: 'dusk',
  },
]

export function classifyRegion(f: number, k: number): PearsonRegion | null {
  return PEARSON_REGIONS.find(r =>
    f >= r.fMin && f <= r.fMax && k >= r.kMin && k <= r.kMax
  ) ?? null
}

// Axis ranges for the parameter space canvas
export const F_MIN = 0.01
export const F_MAX = 0.08
export const K_MIN = 0.04
export const K_MAX = 0.075
