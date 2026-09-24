import { describe, it, expect } from 'vitest'
import {
  createBuffers, seed, step, renderVToPixels, renderU,
  DEFAULT_PARAMS,
} from './gray-scott'
import { PEARSON_REGIONS, classifyRegion } from './pearson'
import { PRESETS } from './presets'

// renderU reads `imageData.data`, so a bare buffer stands in for the DOM
// ImageData that isn't available in the node test environment.
function mockImage(n: number): ImageData {
  return { data: new Uint8ClampedArray(n * n * 4) } as unknown as ImageData
}

describe('seed', () => {
  it('lays down a U=1 / V=0 background and perturbs the centre', () => {
    const n = 64
    const [buf] = createBuffers(n)
    seed(buf, n)

    // A corner cell, far from the three seed squares, stays at the background.
    expect(buf.U[0]).toBeCloseTo(1, 5)
    expect(buf.V[0]).toBeCloseTo(0, 5)

    // The centre cell is perturbed into the reacting range.
    const c = (n / 2) * n + (n / 2)
    expect(buf.U[c]).toBeGreaterThan(0.4)
    expect(buf.U[c]).toBeLessThan(0.6)
    expect(buf.V[c]).toBeGreaterThan(0.2)
    expect(buf.V[c]).toBeLessThan(0.3)
  })
})

describe('step', () => {
  it('keeps both concentrations clamped to [0, 1]', () => {
    const n = 48
    const [a, b] = createBuffers(n)
    seed(a, n)
    let src = a, dst = b
    for (let i = 0; i < 60; i++) {
      step(src, dst, DEFAULT_PARAMS, n)
      ;[src, dst] = [dst, src]
    }
    for (let i = 0; i < n * n; i++) {
      expect(src.U[i]).toBeGreaterThanOrEqual(0)
      expect(src.U[i]).toBeLessThanOrEqual(1)
      expect(src.V[i]).toBeGreaterThanOrEqual(0)
      expect(src.V[i]).toBeLessThanOrEqual(1)
    }
  })

  it('drives U and V into anti-correlation (the coupling)', () => {
    const n = 96
    const [a, b] = createBuffers(n)
    seed(a, n)
    let src = a, dst = b
    for (let i = 0; i < 1500; i++) {
      step(src, dst, DEFAULT_PARAMS, n)
      ;[src, dst] = [dst, src]
    }
    const { U, V } = src
    const len = n * n
    let mu = 0, mv = 0
    for (let i = 0; i < len; i++) { mu += U[i]; mv += V[i] }
    mu /= len; mv /= len
    let cov = 0, su = 0, sv = 0
    for (let i = 0; i < len; i++) {
      const du = U[i] - mu, dv = V[i] - mv
      cov += du * dv; su += du * du; sv += dv * dv
    }
    const corr = cov / Math.sqrt(su * sv)
    expect(corr).toBeLessThan(-0.8)
  })
})

describe('OKLCH colour LUT (via renderers)', () => {
  it('maps a saturated V field to nebula green', () => {
    const n = 4
    const buf = { U: new Float32Array(n * n).fill(1), V: new Float32Array(n * n).fill(1) }
    const pixels = new Uint8ClampedArray(n * n * 4)
    renderVToPixels(pixels, buf, n)
    const [r, g, b] = [pixels[0], pixels[1], pixels[2]]
    // nebula = #15AD70 = (21, 173, 112)
    expect(r).toBeLessThan(60)
    expect(g).toBeGreaterThan(140)
    expect(g).toBeGreaterThan(r)
    expect(g).toBeGreaterThan(b)
  })

  it('renders a substrate at the black point (U = 0.5) as near-black', () => {
    const n = 4
    const buf = { U: new Float32Array(n * n).fill(0.5), V: new Float32Array(n * n) }
    const img = mockImage(n)
    renderU(img, buf, n)
    expect(img.data[0]).toBeLessThan(40)
    expect(img.data[1]).toBeLessThan(40)
    expect(img.data[2]).toBeLessThan(40)
  })
})

describe('classifyRegion', () => {
  it('classifies a known spots point and rejects a point outside the band', () => {
    expect(classifyRegion(0.04, 0.063)?.id).toBeTruthy()
    expect(classifyRegion(0.005, 0.04)).toBeNull()
  })

  // Pearson's regions overlap, so this is the case that matters: every preset
  // must be classified as the region whose button runs it. The test this
  // replaces only asked for some region or null, and passed while the Mitosis
  // preset was labelled Spots.
  it('classifies every preset as the region that runs it', () => {
    for (const region of PEARSON_REGIONS) {
      const preset = PRESETS.find(p => p.id === region.preset)
      expect(preset, `${region.id} names a preset that exists`).toBeDefined()
      expect(classifyRegion(preset!.f, preset!.k)?.id, preset!.id).toBe(region.id)
    }
  })

  it('gives a point inside two regions to the one whose centre is nearer', () => {
    // (0.028, 0.062) lies in both the Spots and Mitosis boxes.
    expect(classifyRegion(0.028, 0.062)?.id).toBe('mitosis')
  })
})
