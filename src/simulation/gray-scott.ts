// Gray-Scott reaction-diffusion model.
//
// ∂U/∂t = Du·∇²U − UV² + f(1 − U)
// ∂V/∂t = Dv·∇²V + UV² − (f + k)V
//
// Discretised with a 5-point Laplacian stencil on a toroidal grid
// (wrap-around boundaries) and forward-Euler time integration.
//
// References:
//   Gray, P. & Scott, S.K. (1984). Autocatalytic reactions in the isothermal,
//     continuous stirred tank reactor. Chemical Engineering Science 39(6).
//   Pearson, J.E. (1993). Complex Patterns in a Simple System.
//     Science 261(5118), 189–192.

import type { SimBuffer, SimParams } from './types'

export const GRID_SIZE = 512  // width = height; 512² = 262,144 pixels per frame

export const DEFAULT_PARAMS: SimParams = {
  f: 0.035,
  k: 0.065,
  Du: 0.2097,
  Dv: 0.1050,
}

// ─── OKLCH colour lookup tables ───────────────────────────────────────────────
//
// Each LUT maps a concentration value index 0–255 to [R, G, B] bytes.
// Interpolation is done in OKLCH space (perceptually uniform) at build time;
// the tight pixel loop does a single array lookup per pixel instead of per-pixel
// float arithmetic.
//
// Using Björn Ottosson's Oklab/OKLCH formulas (2020).

function srgbToLinear(c: number): number {
  const n = c / 255
  return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4)
}

function linearToSrgbByte(c: number): number {
  const clamped = Math.max(0, Math.min(1, c))
  const out = clamped <= 0.0031308
    ? 12.92 * clamped
    : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055
  return Math.round(out * 255)
}

function hexToOklch(hex: string): [number, number, number] {
  const r = srgbToLinear(parseInt(hex.slice(1, 3), 16))
  const g = srgbToLinear(parseInt(hex.slice(3, 5), 16))
  const b = srgbToLinear(parseInt(hex.slice(5, 7), 16))

  // Linear sRGB → Oklab
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  const L =  0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
  const a =  1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
  const bk = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s

  const C = Math.sqrt(a * a + bk * bk)
  const H = Math.atan2(bk, a)
  return [L, C, H]
}

function oklchToRgbBytes(L: number, C: number, H: number): [number, number, number] {
  const a  = C * Math.cos(H)
  const bk = C * Math.sin(H)

  // Oklab → Linear sRGB
  const l_ = L + 0.3963377774 * a + 0.2158037573 * bk
  const m_ = L - 0.1055613458 * a - 0.0638541728 * bk
  const s_ = L - 0.0894841775 * a - 1.2914855480 * bk

  const lc = l_ * l_ * l_
  const mc = m_ * m_ * m_
  const sc = s_ * s_ * s_

  const r =  4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc
  const g = -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc
  const b = -0.0041960863 * lc - 0.7034186147 * mc + 1.7076147010 * sc

  return [linearToSrgbByte(r), linearToSrgbByte(g), linearToSrgbByte(b)]
}

function buildLut(fromHex: string, toHex: string): Uint8Array {
  const [L0, C0, H0raw] = hexToOklch(fromHex)
  const [L1, C1, H1raw] = hexToOklch(toHex)

  // An achromatic endpoint (near-black/grey) has no meaningful hue — atan2 of a
  // near-zero a/b pair returns an arbitrary angle (e.g. void-0 reads as ~blue).
  // Interpolating toward it drags the ramp through off-palette hues, which is
  // why the void→nebula ramp used to show navy midtones. Anchor the achromatic
  // end's hue to the chromatic end so the ramp is a clean constant-hue sweep.
  const CHROMA_EPS = 0.01
  const H0 = C0 < CHROMA_EPS ? H1raw : H0raw
  const H1 = C1 < CHROMA_EPS ? H0raw : H1raw

  // Angular interpolation on hue: take the shortest path around the circle
  let dH = H1 - H0
  if (dH >  Math.PI) dH -= 2 * Math.PI
  if (dH < -Math.PI) dH += 2 * Math.PI

  const lut = new Uint8Array(256 * 3)
  for (let i = 0; i < 256; i++) {
    const t = i / 255
    const [r, g, b] = oklchToRgbBytes(
      L0 + (L1 - L0) * t,
      C0 + (C1 - C0) * t,
      H0 + dH * t,
    )
    lut[i * 3]     = r
    lut[i * 3 + 1] = g
    lut[i * 3 + 2] = b
  }
  return lut
}

// void-0 → nebula  (V channel default, U channel)
const LUT_NEBULA = buildLut('#121213', '#15AD70')
// void-0 → supernova  (V/activator channel in Channels view)
const LUT_SUPERNOVA = buildLut('#121213', '#FFC700')

// ─── Buffers ──────────────────────────────────────────────────────────────────

export function createBuffers(n = GRID_SIZE): [SimBuffer, SimBuffer] {
  const size = n * n
  return [
    { U: new Float32Array(size), V: new Float32Array(size) },
    { U: new Float32Array(size), V: new Float32Array(size) },
  ]
}

// Seed the simulation: U = 1 everywhere, V = 0, with a noisy square of
// V = 0.25 in the centre. Multiple seeds give richer initial patterns.
// Seed radii scale proportionally with n.
export function seed(buf: SimBuffer, n = GRID_SIZE): void {
  buf.U.fill(1.0)
  buf.V.fill(0.0)

  const r0 = Math.max(4, Math.floor(n / 42))  // ≈12 at n=512, ≈6 at n=256
  const r1 = Math.max(3, Math.floor(n / 64))  // ≈8  at n=512, ≈4 at n=256

  const seeds = [
    { cx: Math.floor(n / 2),     cy: Math.floor(n / 2),     r: r0 },
    { cx: Math.floor(n / 4),     cy: Math.floor(n / 4),     r: r1 },
    { cx: Math.floor(3 * n / 4), cy: Math.floor(3 * n / 4), r: r1 },
  ]

  for (const { cx, cy, r } of seeds) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = ((cx + dx) + n) % n
        const y = ((cy + dy) + n) % n
        const i = y * n + x
        buf.U[i] = 0.50 + (Math.random() * 0.04 - 0.02)
        buf.V[i] = 0.25 + (Math.random() * 0.04 - 0.02)
      }
    }
  }
}

// Advance one time step. Reads from `src`, writes to `dst`.
// Call repeatedly, swapping src/dst on each call (ping-pong).
export function step(
  src: SimBuffer,
  dst: SimBuffer,
  params: SimParams,
  n = GRID_SIZE,
): void {
  const { f, k, Du, Dv } = params
  const { U: sU, V: sV } = src
  const { U: dU, V: dV } = dst

  for (let y = 0; y < n; y++) {
    const yUp   = y === 0     ? n - 1 : y - 1
    const yDown = y === n - 1 ? 0     : y + 1

    for (let x = 0; x < n; x++) {
      const i     = y     * n + x
      const left  = y     * n + (x === 0     ? n - 1 : x - 1)
      const right = y     * n + (x === n - 1 ? 0     : x + 1)
      const up    = yUp   * n + x
      const down  = yDown * n + x

      const u = sU[i]
      const v = sV[i]

      // 5-point Laplacian (unit grid spacing)
      const lapU = sU[left] + sU[right] + sU[up] + sU[down] - 4.0 * u
      const lapV = sV[left] + sV[right] + sV[up] + sV[down] - 4.0 * v

      const uvv = u * v * v

      dU[i] = Math.max(0.0, Math.min(1.0, u + (Du * lapU - uvv + f * (1.0 - u))))
      dV[i] = Math.max(0.0, Math.min(1.0, v + (Dv * lapV + uvv - (f + k) * v)))
    }
  }
}

// ─── Render functions ─────────────────────────────────────────────────────────
//
// Each render function maps a concentration to a pixel via the precomputed LUT.
// V is amplified (×3) for visual contrast since typical concentrations are low.

// U hovers near its feed baseline of 1 and only dips to ~0.4 where the reaction
// consumes it, so drawn straight it reads as a flat mid-green and its inverse
// relationship to V is invisible. Stretch the band [U_BLACK, 1] across the full
// ramp: depleted regions (where V's structure lives) fall to black, replenished
// regions stay bright — making U a true photo-negative of V, contrast-matched to
// V's ×3 amplification.
const U_BLACK = 0.5

export function renderU(imageData: ImageData, buf: SimBuffer, n = GRID_SIZE): void {
  const data = imageData.data
  const { U } = buf
  const len = n * n
  const scale = 255 / (1 - U_BLACK)
  for (let i = 0; i < len; i++) {
    const idx = Math.max(0, Math.min(255, ((U[i] - U_BLACK) * scale) | 0))
    const p = i * 4
    data[p]     = LUT_NEBULA[idx * 3]
    data[p + 1] = LUT_NEBULA[idx * 3 + 1]
    data[p + 2] = LUT_NEBULA[idx * 3 + 2]
    data[p + 3] = 255
  }
}

export function renderVSupernova(imageData: ImageData, buf: SimBuffer, n = GRID_SIZE): void {
  const data = imageData.data
  const { V } = buf
  const len = n * n
  for (let i = 0; i < len; i++) {
    const idx = Math.min(255, (V[i] * 3.0 * 255) | 0)
    const p = i * 4
    data[p]     = LUT_SUPERNOVA[idx * 3]
    data[p + 1] = LUT_SUPERNOVA[idx * 3 + 1]
    data[p + 2] = LUT_SUPERNOVA[idx * 3 + 2]
    data[p + 3] = 255
  }
}

// Render to plain Uint8ClampedArrays (used by workers that lack ImageData).

export function renderVToPixels(pixels: Uint8ClampedArray, buf: SimBuffer, n = GRID_SIZE): void {
  const { V } = buf
  const len = n * n
  for (let i = 0; i < len; i++) {
    const idx = Math.min(255, (V[i] * 3.0 * 255) | 0)
    const p = i * 4
    pixels[p]     = LUT_NEBULA[idx * 3]
    pixels[p + 1] = LUT_NEBULA[idx * 3 + 1]
    pixels[p + 2] = LUT_NEBULA[idx * 3 + 2]
    pixels[p + 3] = 255
  }
}
