// Sweep worker: runs N independent Gray-Scott simulations simultaneously,
// one per (f, k) sample point in the parameter space grid.
//
// All simulations share the same Du, Dv, dt. Each cell has its own f, k
// and its own ping-pong buffer pair.
//
// Message protocol (main → worker):
//   { type: 'init';   cells: Array<{ id: string; f: number; k: number }>; n: number }
//   { type: 'tick' }         -- advance all cells by `stepsPerTick` steps and render
//   { type: 'setBase'; Du: number; Dv: number }
//
// Message protocol (worker → main):
//   { type: 'frames'; cells: Array<{ id: string; buffer: ArrayBuffer }> }

import { createBuffers, seed, step, renderVToPixels, DEFAULT_PARAMS } from './gray-scott'
import type { SimBuffer, SimParams } from './types'

declare const self: DedicatedWorkerGlobalScope

const STEPS_PER_TICK = 4

interface Cell {
  id: string
  buffers: [SimBuffer, SimBuffer]
  front: 0 | 1
  params: SimParams
  pixels: Uint8ClampedArray
}

let cells: Cell[] = []
let n = 128

function initCells(defs: Array<{ id: string; f: number; k: number }>, gridN: number) {
  n = gridN
  cells = defs.map(({ id, f, k }) => {
    const bufs = createBuffers(n)
    seed(bufs[0], n)
    const params: SimParams = { ...DEFAULT_PARAMS, f, k }
    return {
      id,
      buffers: bufs,
      front: 0 as 0 | 1,
      params,
      pixels: new Uint8ClampedArray(n * n * 4),
    }
  })
}

function tickAll() {
  const frames: Array<{ id: string; buffer: ArrayBufferLike }> = []

  for (const cell of cells) {
    for (let i = 0; i < STEPS_PER_TICK; i++) {
      const src = cell.buffers[cell.front]
      const dst = cell.buffers[(cell.front ^ 1) as 0 | 1]
      step(src, dst, cell.params, n)
      cell.front = (cell.front ^ 1) as 0 | 1
    }

    renderVToPixels(cell.pixels, cell.buffers[cell.front], n)
    frames.push({ id: cell.id, buffer: cell.pixels.buffer })
  }

  // No transfer list: buffers are structured-cloned (~1.6 MB/tick) rather than
  // transferred. This avoids 25 heap allocations per tick and the associated GC
  // pressure, at the cost of a single memcpy that V8 handles cheaply.
  self.postMessage({ type: 'frames', cells: frames })
}

self.onmessage = (e: MessageEvent) => {
  const msg = e.data as
    | { type: 'init'; cells: Array<{ id: string; f: number; k: number }>; n: number }
    | { type: 'tick' }
    | { type: 'setBase'; Du: number; Dv: number }

  switch (msg.type) {
    case 'init':
      initCells(msg.cells, msg.n)
      break
    case 'tick':
      tickAll()
      break
    case 'setBase':
      for (const cell of cells) {
        cell.params = { ...cell.params, Du: msg.Du, Dv: msg.Dv }
      }
      break
  }
}
