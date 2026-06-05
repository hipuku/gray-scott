// Preview worker: a single parameterisable Gray-Scott simulation.
// Used by ViewSpace for the click-to-preview panel so the main thread
// stays free during interaction.
//
// Message protocol (main → worker):
//   { type: 'init'; n: number; f: number; k: number }
//   { type: 'tick' }
// Message protocol (worker → main):
//   { type: 'frame'; buffer: ArrayBuffer; n: number }

import { createBuffers, seed, step, renderVToPixels, DEFAULT_PARAMS } from './gray-scott'
import type { SimParams } from './types'

declare const self: DedicatedWorkerGlobalScope

let buffers = createBuffers()
let front: 0 | 1 = 0
let params: SimParams = { ...DEFAULT_PARAMS }
let n = 128

function doInit(gridN: number, f: number, k: number) {
  n = gridN
  buffers = createBuffers(n)
  params = { ...DEFAULT_PARAMS, f, k }
  seed(buffers[0], n)
  front = 0
}

function doTick() {
  for (let i = 0; i < 4; i++) {
    const src = buffers[front]
    const dst = buffers[(front ^ 1) as 0 | 1]
    step(src, dst, params, n)
    front = (front ^ 1) as 0 | 1
  }
  const pixels = new Uint8ClampedArray(n * n * 4)
  renderVToPixels(pixels, buffers[front], n)
  self.postMessage({ type: 'frame', buffer: pixels.buffer, n }, [pixels.buffer])
}

self.onmessage = (e: MessageEvent) => {
  const msg = e.data as
    | { type: 'init'; n: number; f: number; k: number }
    | { type: 'tick' }

  switch (msg.type) {
    case 'init': doInit(msg.n, msg.f, msg.k); break
    case 'tick':  doTick();                    break
  }
}
