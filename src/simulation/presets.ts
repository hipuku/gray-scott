import type { Preset } from './types'

// f/k values from Pearson (1993) and widely cited Gray-Scott parameter surveys.
// Each combination produces a qualitatively distinct pattern class.
export const PRESETS: Preset[] = [
  { id: 'leopard',   name: 'Leopard',   f: 0.035, k: 0.065 },
  { id: 'coral',     name: 'Coral',     f: 0.060, k: 0.062 },
  { id: 'labyrinth', name: 'Labyrinth', f: 0.040, k: 0.060 },
  { id: 'mitosis',   name: 'Mitosis',   f: 0.028, k: 0.062 },
  { id: 'zebra',     name: 'Zebra',     f: 0.022, k: 0.059 },
]

export const DEFAULT_PRESET = PRESETS[0]
