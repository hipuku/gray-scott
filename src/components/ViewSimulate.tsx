import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, ChevronDown } from 'lucide-react'
import { ViewHeader } from '@kern/molecules/ViewHeader'
import { StatusChip } from '@kern/atoms/StatusChip'
import { ParamSlider } from '@kern/molecules/ParamSlider'
import { ToggleChip } from '@kern/atoms/ToggleChip'
import { IconButton } from '@kern/atoms/IconButton'
import { PatternGlyph } from '@/components/PatternGlyph'
import { cn } from '@/lib/utils'
import { GRID_SIZE, DEFAULT_PARAMS } from '@/simulation/gray-scott'
import { PRESETS } from '@/simulation/presets'
import { classifyRegion } from '@/simulation/pearson'
import type { SimParams } from '@/simulation/types'

const SPEED_OPTIONS = [1, 2, 4, 8] as const
type Speed = typeof SPEED_OPTIONS[number]

// Rolling FPS average over the last N frames
const FPS_WINDOW = 20

interface ViewSimulateProps {
  initialF?: number
  initialK?: number
}

export function ViewSimulate({ initialF, initialK }: ViewSimulateProps = {}) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const workerRef   = useRef<Worker | null>(null)
  const ctxRef      = useRef<CanvasRenderingContext2D | null>(null)
  const rafRef      = useRef<number>(0)
  const paramsReady = useRef(false)   // skip reseed on initial mount

  // FPS tracking
  const frameTimes  = useRef<number[]>([])
  const [fps, setFps] = useState<number | null>(null)

  const [running, setRunning]           = useState(true)
  const [speed, setSpeed]               = useState<Speed>(1)
  const [activePreset, setActivePreset] = useState(
    initialF !== undefined ? '' : PRESETS[0].id,
  )
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [f,  setF]  = useState(initialF ?? DEFAULT_PARAMS.f)
  const [k,  setK]  = useState(initialK ?? DEFAULT_PARAMS.k)
  const [du, setDu] = useState(DEFAULT_PARAMS.Du)
  const [dv, setDv] = useState(DEFAULT_PARAMS.Dv)

  // ── Worker setup ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width  = GRID_SIZE
    canvas.height = GRID_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctxRef.current = ctx

    const worker = new Worker(
      new URL('../simulation/simulation.worker.ts', import.meta.url),
      { type: 'module' },
    )
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent) => {
      const { type, buffer, width, height } = e.data
      if (type !== 'frame') return

      // Paint the received frame
      const pixels    = new Uint8ClampedArray(buffer)
      const imageData = new ImageData(pixels, width, height)
      ctx.putImageData(imageData, 0, 0)

      // FPS
      const now = performance.now()
      frameTimes.current.push(now)
      if (frameTimes.current.length > FPS_WINDOW) frameTimes.current.shift()
      if (frameTimes.current.length >= 2) {
        const elapsed = now - frameTimes.current[0]
        setFps(Math.round(((frameTimes.current.length - 1) / elapsed) * 1000))
      }

      // Schedule next tick via RAF so we stay locked to the display refresh
      rafRef.current = requestAnimationFrame(() => worker.postMessage({ type: 'tick' }))
    }

    // Kick off the loop
    rafRef.current = requestAnimationFrame(() => worker.postMessage({ type: 'tick' }))

    return () => {
      cancelAnimationFrame(rafRef.current)
      worker.terminate()
    }
  }, [])

  // ── Sync param/control changes to worker ─────────────────────────────────────

  useEffect(() => {
    workerRef.current?.postMessage({ type: 'setRunning', running })
  }, [running])

  useEffect(() => {
    workerRef.current?.postMessage({ type: 'setSpeed', speed })
  }, [speed])

  useEffect(() => {
    const params: SimParams = { f, k, Du: du, Dv: dv }
    workerRef.current?.postMessage({ type: 'setParams', params })
    // Reseed on every param change so sliders give immediate visual feedback.
    // Skip the first render — the worker seeds itself on init.
    if (paramsReady.current) {
      workerRef.current?.postMessage({ type: 'seed' })
    } else {
      paramsReady.current = true
    }
  }, [f, k, du, dv])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handlePreset(id: string) {
    const preset = PRESETS.find(p => p.id === id)
    if (!preset) return
    setActivePreset(id)
    setF(preset.f)
    setK(preset.k)
    // No explicit seed — the params useEffect reseeds automatically on f/k change.
  }

  function handleReset() {
    workerRef.current?.postMessage({ type: 'seed' })
  }

  const region = classifyRegion(f, k)

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full gap-6 max-w-3xl mx-auto w-full">
      <ViewHeader
        title="Simulate"
        description="Reaction-diffusion growing from three seeded perturbations. Adjust f and k to shift between pattern classes."
      />

      <div className="flex flex-1 gap-6 min-h-0">

        {/* ── Canvas — square, sized to fit the column height ── */}
        <div className="flex-1 min-w-0 min-h-0 flex justify-center">
          <div className="relative h-full aspect-square max-w-full rounded-xl overflow-hidden bg-void-0 border border-void-20">
            <canvas
              ref={canvasRef}
              className="w-full h-full"
              style={{ imageRendering: 'pixelated' }}
            />
            <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-void-0/70 backdrop-blur-sm px-2 py-1">
              <StatusChip colour={running ? 'nebula' : 'neutral'}>
                {running ? 'Running' : 'Paused'}
              </StatusChip>
              {fps !== null && (
                <span className="type-annotation font-mono text-void-50">{fps} fps</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Controls sidebar ── */}
        <div className="w-52 shrink-0 flex flex-col gap-5 overflow-y-auto">

          {/* Presets */}
          <div className="flex flex-col gap-2">
            <span className="type-annotation-sc text-void-60">Pattern</span>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(p => (
                <ToggleChip
                  key={p.id}
                  active={activePreset === p.id}
                  onClick={() => handlePreset(p.id)}
                >
                  <span className="flex items-center gap-1.5">
                    <PatternGlyph id={p.id} />
                    {p.name}
                  </span>
                </ToggleChip>
              ))}
            </div>
          </div>

          {/* f / k sliders + region */}
          <div className="flex flex-col gap-4">
            <ParamSlider
              label="f — feed rate"
              value={f}
              min={0.01}
              max={0.08}
              step={0.001}
              onChange={v => { setF(v); setActivePreset('') }}
            />
            <ParamSlider
              label="k — kill rate"
              value={k}
              min={0.04}
              max={0.075}
              step={0.001}
              onChange={v => { setK(v); setActivePreset('') }}
            />
            <StatusChip colour={region ? 'nebula' : 'neutral'}>
              <span className="flex items-center gap-1.5">
                {region && <PatternGlyph id={region.id} />}
                {region?.label ?? 'Boundary zone'}
              </span>
            </StatusChip>
          </div>

          {/* Advanced — Du / Dv */}
          <div className="flex flex-col">
            <div className="h-px bg-void-20" />
            <button
              type="button"
              onClick={() => setShowAdvanced(s => !s)}
              aria-expanded={showAdvanced}
              className={cn(
                'flex items-center justify-between type-annotation text-void-60 py-3',
                'hover:text-void-90 transition-colors duration-150',
              )}
            >
              <span>Advanced</span>
              <ChevronDown
                className={cn(
                  'w-3 h-3 transition-transform duration-300 ease-out',
                  showAdvanced && 'rotate-180',
                )}
              />
            </button>

            <div
              className={cn(
                'grid transition-[grid-template-rows] duration-300 ease-out',
                showAdvanced ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
              )}
            >
              <div className="overflow-hidden">
                <div className="flex flex-col gap-4 pb-3">
                  <ParamSlider
                    label="Du — substrate"
                    value={du}
                    min={0.05}
                    max={0.50}
                    step={0.001}
                    onChange={setDu}
                  />
                  <ParamSlider
                    label="Dv — activator"
                    value={dv}
                    min={0.025}
                    max={0.25}
                    step={0.0005}
                    onChange={setDv}
                    format={v => v.toFixed(4)}
                  />
                  <p className="type-annotation text-void-40">
                    Turing instability requires Du &gt; Dv. Set Dv ≥ Du to watch patterns dissolve.
                  </p>
                  {(du !== DEFAULT_PARAMS.Du || dv !== DEFAULT_PARAMS.Dv) && (
                    <button
                      type="button"
                      onClick={() => { setDu(DEFAULT_PARAMS.Du); setDv(DEFAULT_PARAMS.Dv) }}
                      className="type-annotation text-void-50 hover:text-void-70 transition-colors duration-150 text-left"
                    >
                      Reset to defaults
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="h-px bg-void-20" />
          </div>

          {/* Speed */}
          <div className="flex flex-col gap-2">
            <span className="type-annotation-sc text-void-60">Speed</span>
            <div className="flex gap-2">
              {SPEED_OPTIONS.map(s => (
                <ToggleChip key={s} active={speed === s} onClick={() => setSpeed(s)} mono>
                  ×{s}
                </ToggleChip>
              ))}
            </div>
          </div>

          {/* Transport */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRunning(r => !r)}
              aria-label={running ? 'Pause' : 'Play'}
              className={cn(
                'flex items-center gap-2 flex-1 justify-center py-2 rounded-xl border',
                'transition-colors duration-150 type-annotation',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)',
                'bg-void-20 border-void-30 text-void-60 hover:text-void-90 hover:border-void-40',
              )}
            >
              {running
                ? <><Pause className="w-3.5 h-3.5" /> Pause</>
                : <><Play  className="w-3.5 h-3.5" /> Play</>}
            </button>
            <IconButton onClick={handleReset} aria-label="Reset simulation">
              <RotateCcw className="w-3.5 h-3.5" />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  )
}
