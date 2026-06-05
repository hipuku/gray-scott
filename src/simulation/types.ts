export interface SimBuffer {
  U: Float32Array
  V: Float32Array
}

export interface SimParams {
  f: number   // feed rate
  k: number   // kill rate
  Du: number  // diffusion coefficient for U
  Dv: number  // diffusion coefficient for V
}

export interface Preset {
  id: string
  name: string
  f: number
  k: number
}
