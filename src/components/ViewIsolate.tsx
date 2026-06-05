import { useEffect, useRef } from 'react'
import { ViewHeader } from '@kern/molecules/ViewHeader'
import { CalloutCard } from '@kern/molecules/CalloutCard'
import { ToggleChip } from '@kern/atoms/ToggleChip'
import { useState } from 'react'
import { PRESETS } from '@/simulation/presets'
import { GRID_SIZE, DEFAULT_PARAMS } from '@/simulation/gray-scott'
import type { SimParams } from '@/simulation/types'

export function ViewIsolate() {
  const canvasURef = useRef<HTMLCanvasElement>(null)
  const canvasVRef = useRef<HTMLCanvasElement>(null)
  const workerRef  = useRef<Worker | null>(null)
  const rafRef     = useRef<number>(0)
  const ctxURef    = useRef<CanvasRenderingContext2D | null>(null)
  const ctxVRef    = useRef<CanvasRenderingContext2D | null>(null)

  const [activePreset, setActivePreset] = useState(PRESETS[0].id)

  useEffect(() => {
    const cu = canvasURef.current
    const cv = canvasVRef.current
    if (!cu || !cv) return

    cu.width = cv.width = GRID_SIZE
    cu.height = cv.height = GRID_SIZE
    ctxURef.current = cu.getContext('2d')
    ctxVRef.current = cv.getContext('2d')

    const worker = new Worker(
      new URL('../simulation/isolate.worker.ts', import.meta.url),
      { type: 'module' },
    )
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent) => {
      const { type, uBuffer, vBuffer } = e.data
      if (type !== 'frame') return

      const uPixels = new Uint8ClampedArray(uBuffer)
      const vPixels = new Uint8ClampedArray(vBuffer)
      ctxURef.current?.putImageData(new ImageData(uPixels, GRID_SIZE, GRID_SIZE), 0, 0)
      ctxVRef.current?.putImageData(new ImageData(vPixels, GRID_SIZE, GRID_SIZE), 0, 0)

      rafRef.current = requestAnimationFrame(() => worker.postMessage({ type: 'tick' }))
    }

    rafRef.current = requestAnimationFrame(() => worker.postMessage({ type: 'tick' }))

    return () => {
      cancelAnimationFrame(rafRef.current)
      worker.terminate()
    }
  }, [])

  function handlePreset(id: string) {
    const preset = PRESETS.find(p => p.id === id)
    if (!preset) return
    setActivePreset(id)
    const params: SimParams = { ...DEFAULT_PARAMS, f: preset.f, k: preset.k }
    workerRef.current?.postMessage({ type: 'setParams', params })
    workerRef.current?.postMessage({ type: 'seed' })
  }

  return (
    <div className="flex flex-col gap-8 max-w-3xl mx-auto w-full">
      <ViewHeader
        title="Isolate channels"
        description="The same simulation shown twice — left channel U (the substrate), right channel V (the activator). They are coupled but move in opposite directions."
      />

      <div className="flex flex-col gap-2">
        <span className="type-annotation-sc text-void-60">Pattern preset</span>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <ToggleChip
              key={p.id}
              active={activePreset === p.id}
              onClick={() => handlePreset(p.id)}
            >
              {p.name}
            </ToggleChip>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <span className="type-annotation-sc text-void-60">U — substrate</span>
          <div className="rounded-xl overflow-hidden border border-void-20 bg-void-0 aspect-square">
            <canvas
              ref={canvasURef}
              className="w-full h-full"
              style={{ imageRendering: 'pixelated', display: 'block' }}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="type-annotation-sc text-void-60">V — activator</span>
          <div className="rounded-xl overflow-hidden border border-void-20 bg-void-0 aspect-square">
            <canvas
              ref={canvasVRef}
              className="w-full h-full"
              style={{ imageRendering: 'pixelated', display: 'block' }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <CalloutCard colour="pulsar" label="U is the substrate">
          U starts at 1 everywhere (full concentration). Where V is present, U is consumed.
          High U = dark areas where activator hasn't reached.
        </CalloutCard>
        <CalloutCard colour="corona" label="V is the activator">
          V begins near zero and is produced where U is present. The pattern you see in Simulate
          is entirely the V concentration — U is its inverse.
        </CalloutCard>
      </div>
    </div>
  )
}
