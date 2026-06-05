// Isolate worker: runs one Gray-Scott simulation and posts back both the U
// (substrate) and V (activator) channels as separate pixel arrays per frame.
// Used by ViewIsolate to drive the two side-by-side canvases off the main thread.
//
// Message protocol (main → worker):
//   { type: 'seed' }
//   { type: 'setParams'; params: SimParams }
//   { type: 'tick' }
// Message protocol (worker → main):
//   { type: 'frame'; uBuffer: ArrayBuffer; vBuffer: ArrayBuffer }

import {
  createBuffers, seed, step,
  renderUToPixels, renderVCoronaToPixels,
  GRID_SIZE, DEFAULT_PARAMS,
} from './gray-scott'
import type { SimParams } from './types'

declare const self: DedicatedWorkerGlobalScope

const buffers = createBuffers()
let front: 0 | 1 = 0
let params: SimParams = { ...DEFAULT_PARAMS }

function doSeed() {
  seed(buffers[0])
  buffers[1].U.fill(0)
  buffers[1].V.fill(0)
  front = 0
}

function doTick() {
  for (let i = 0; i < 4; i++) {
    const src = buffers[front]
    const dst = buffers[(front ^ 1) as 0 | 1]
    step(src, dst, params)
    front = (front ^ 1) as 0 | 1
  }
  const uPixels = new Uint8ClampedArray(GRID_SIZE * GRID_SIZE * 4)
  const vPixels = new Uint8ClampedArray(GRID_SIZE * GRID_SIZE * 4)
  renderUToPixels(uPixels, buffers[front])
  renderVCoronaToPixels(vPixels, buffers[front])
  self.postMessage(
    { type: 'frame', uBuffer: uPixels.buffer, vBuffer: vPixels.buffer },
    [uPixels.buffer, vPixels.buffer],
  )
}

doSeed()

self.onmessage = (e: MessageEvent) => {
  const msg = e.data as
    | { type: 'seed' }
    | { type: 'setParams'; params: SimParams }
    | { type: 'tick' }

  switch (msg.type) {
    case 'seed':      doSeed();           break
    case 'setParams': params = msg.params; break
    case 'tick':      doTick();            break
  }
}
