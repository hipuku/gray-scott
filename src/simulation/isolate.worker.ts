// Isolate worker: runs one Gray-Scott simulation and posts back the raw U
// (substrate) and V (activator) concentration fields each frame. ViewIsolate
// renders both channels on the main thread so it can also read the concentration
// under the cursor for the inspector — the sim step still runs off-thread here.
//
// Message protocol (main → worker):
//   { type: 'seed' }                       reseed, then post a frame
//   { type: 'setParams'; params: SimParams }
//   { type: 'tick' }                        advance 4 steps, then post a frame
//   { type: 'render' }                      re-post the current frame, no advance
// Message protocol (worker → main):
//   { type: 'frame'; uBuffer: ArrayBuffer; vBuffer: ArrayBuffer }  Float32 fields

import { createBuffers, seed, step, DEFAULT_PARAMS } from './gray-scott'
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

function doStep() {
  for (let i = 0; i < 4; i++) {
    const src = buffers[front]
    const dst = buffers[(front ^ 1) as 0 | 1]
    step(src, dst, params)
    front = (front ^ 1) as 0 | 1
  }
}

function postFrame() {
  // Copy the live fields (slice) so the worker keeps its buffers to keep
  // simulating, then transfer the copies to skip a structured clone.
  const u = buffers[front].U.slice()
  const v = buffers[front].V.slice()
  self.postMessage(
    { type: 'frame', uBuffer: u.buffer, vBuffer: v.buffer },
    [u.buffer, v.buffer],
  )
}

doSeed()

self.onmessage = (e: MessageEvent) => {
  const msg = e.data as
    | { type: 'seed' }
    | { type: 'setParams'; params: SimParams }
    | { type: 'tick' }
    | { type: 'render' }

  switch (msg.type) {
    case 'seed':      doSeed(); postFrame(); break
    case 'setParams': params = msg.params;   break
    case 'tick':      doStep(); postFrame(); break
    case 'render':    postFrame();           break
  }
}
