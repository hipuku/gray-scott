// Simulation worker: owns all buffer state, runs step() + renderVToPixels(),
// posts rendered frames back as transferable ArrayBuffers.
//
// Message protocol (main → worker):
//   { type: 'seed' }
//   { type: 'setParams';   params: SimParams }
//   { type: 'setRunning';  running: boolean }
//   { type: 'setSpeed';    speed: number }
//   { type: 'tick' }           -- drive one animation frame
//
// Message protocol (worker → main):
//   { type: 'frame'; buffer: ArrayBuffer; width: number; height: number }

import { createBuffers, seed, step, renderVToPixels, GRID_SIZE, DEFAULT_PARAMS } from './gray-scott'
import type { SimParams } from './types'

declare const self: DedicatedWorkerGlobalScope

const buffers = createBuffers()
let front: 0 | 1 = 0
let params: SimParams = { ...DEFAULT_PARAMS }
let running = true
let speed = 1

function doSeed() {
  seed(buffers[0])
  buffers[1].U.fill(0)
  buffers[1].V.fill(0)
  front = 0
}

function doTick() {
  if (running) {
    for (let i = 0; i < speed; i++) {
      const src = buffers[front]
      const dst = buffers[front ^ 1 as 0 | 1]
      step(src, dst, params)
      front = (front ^ 1) as 0 | 1
    }
  }

  const pixels = new Uint8ClampedArray(GRID_SIZE * GRID_SIZE * 4)
  renderVToPixels(pixels, buffers[front])

  // Transfer the underlying buffer — zero-copy handoff to the main thread.
  // The worker creates a fresh Uint8ClampedArray next tick.
  self.postMessage(
    { type: 'frame', buffer: pixels.buffer, width: GRID_SIZE, height: GRID_SIZE },
    [pixels.buffer],
  )
}

// Seed once at startup so the main thread gets a first frame immediately.
doSeed()

self.onmessage = (e: MessageEvent) => {
  const msg = e.data as
    | { type: 'seed' }
    | { type: 'setParams';  params: SimParams }
    | { type: 'setRunning'; running: boolean }
    | { type: 'setSpeed';   speed: number }
    | { type: 'tick' }

  switch (msg.type) {
    case 'seed':
      doSeed()
      break
    case 'setParams':
      params = msg.params
      break
    case 'setRunning':
      running = msg.running
      break
    case 'setSpeed':
      speed = msg.speed
      break
    case 'tick':
      doTick()
      break
  }
}
