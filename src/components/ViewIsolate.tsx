import { useEffect, useRef, useState } from 'react'
import { ViewHeader } from '@kern/molecules/ViewHeader'
import { CalloutCard } from '@kern/molecules/CalloutCard'
import { ToggleChip } from '@kern/atoms/ToggleChip'
import { ViewContainer } from '@kern/templates/ViewContainer'
import { CanvasStage } from '@kern/molecules/CanvasStage'
import { TransportControls } from '@kern/molecules/TransportControls'
import { PatternGlyph } from '@/components/PatternGlyph'
import { PRESETS } from '@/simulation/presets'
import {
  GRID_SIZE, DEFAULT_PARAMS,
  renderU, renderVSupernova,
} from '@/simulation/gray-scott'
import type { SimParams, SimBuffer } from '@/simulation/types'

interface Cell { gx: number; gy: number }

// Small crosshair marker overlaid on a canvas at a grid cell. Drawn on both panels
// at the same cell so the eye can see U is dark exactly where V is bright.
function Crosshair({ cell }: { cell: Cell }) {
  return (
    <div
      className="absolute pointer-events-none w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-void-90"
      style={{
        left: `${((cell.gx + 0.5) / GRID_SIZE) * 100}%`,
        top:  `${((cell.gy + 0.5) / GRID_SIZE) * 100}%`,
        boxShadow: '0 0 0 1.5px var(--color-void-0)',
      }}
    />
  )
}

export function ViewIsolate() {
  const canvasURef = useRef<HTMLCanvasElement>(null)
  const canvasVRef = useRef<HTMLCanvasElement>(null)
  const workerRef  = useRef<Worker | null>(null)
  const rafRef     = useRef<number>(0)

  const ctxURef = useRef<CanvasRenderingContext2D | null>(null)
  const ctxVRef = useRef<CanvasRenderingContext2D | null>(null)
  const imgURef = useRef<ImageData | null>(null)
  const imgVRef = useRef<ImageData | null>(null)

  // Latest raw concentration fields, kept for the cursor inspector.
  const uFieldRef = useRef<Float32Array | null>(null)
  const vFieldRef = useRef<Float32Array | null>(null)

  const [activePreset, setActivePreset] = useState(PRESETS[0].id)
  const [running, setRunning] = useState(true)
  const runningRef = useRef(true)
  const pumpingRef = useRef(false)   // is a tick currently in flight?

  const [hover, setHover]     = useState<Cell | null>(null)
  const hoverRef              = useRef<Cell | null>(null)
  const [readout, setReadout] = useState<{ u: number; v: number } | null>(null)

  useEffect(() => { hoverRef.current = hover }, [hover])

  function sampleAt(gx: number, gy: number) {
    const u = uFieldRef.current, v = vFieldRef.current
    if (!u || !v) return
    const idx = gy * GRID_SIZE + gx
    setReadout({ u: u[idx], v: v[idx] })
  }

  // ── Worker + main-thread render loop ─────────────────────────────────────────
  useEffect(() => {
    const cu = canvasURef.current, cv = canvasVRef.current
    if (!cu || !cv) return

    cu.width = cv.width = GRID_SIZE
    cu.height = cv.height = GRID_SIZE
    const ctxU = cu.getContext('2d'), ctxV = cv.getContext('2d')
    if (!ctxU || !ctxV) return
    ctxURef.current = ctxU; ctxVRef.current = ctxV
    imgURef.current = ctxU.createImageData(GRID_SIZE, GRID_SIZE)
    imgVRef.current = ctxV.createImageData(GRID_SIZE, GRID_SIZE)

    const worker = new Worker(
      new URL('../simulation/isolate.worker.ts', import.meta.url),
      { type: 'module' },
    )
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent) => {
      const { type, uBuffer, vBuffer } = e.data
      if (type !== 'frame') return

      const uField = new Float32Array(uBuffer)
      const vField = new Float32Array(vBuffer)
      uFieldRef.current = uField
      vFieldRef.current = vField

      const buf: SimBuffer = { U: uField, V: vField }
      const imgU = imgURef.current!, imgV = imgVRef.current!
      renderU(imgU, buf)
      renderVSupernova(imgV, buf)
      ctxURef.current!.putImageData(imgU, 0, 0)
      ctxVRef.current!.putImageData(imgV, 0, 0)

      // Keep the inspector live while the sim runs.
      if (hoverRef.current) {
        const { gx, gy } = hoverRef.current
        const idx = gy * GRID_SIZE + gx
        setReadout({ u: uField[idx], v: vField[idx] })
      }

      // Self-throttling request loop: only ask for the next frame once this one
      // has painted, and only while running.
      if (runningRef.current) {
        rafRef.current = requestAnimationFrame(() => worker.postMessage({ type: 'tick' }))
      } else {
        pumpingRef.current = false
      }
    }

    return () => {
      cancelAnimationFrame(rafRef.current)
      worker.terminate()
      workerRef.current = null
      pumpingRef.current = false
    }
  }, [])

  // Start/restart the loop on mount and whenever we resume from a pause.
  useEffect(() => {
    runningRef.current = running
    if (running && workerRef.current && !pumpingRef.current) {
      pumpingRef.current = true
      rafRef.current = requestAnimationFrame(() => workerRef.current!.postMessage({ type: 'tick' }))
    }
  }, [running])

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function handlePreset(id: string) {
    const preset = PRESETS.find(p => p.id === id)
    if (!preset) return
    setActivePreset(id)
    const params: SimParams = { ...DEFAULT_PARAMS, f: preset.f, k: preset.k }
    workerRef.current?.postMessage({ type: 'setParams', params })
    workerRef.current?.postMessage({ type: 'seed' })   // worker posts a frame, so a paused view still updates
  }

  function handleReset() {
    workerRef.current?.postMessage({ type: 'seed' })
  }

  function handleHover(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const gx = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor((e.clientX - rect.left) / rect.width  * GRID_SIZE)))
    const gy = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor((e.clientY - rect.top)  / rect.height * GRID_SIZE)))
    setHover({ gx, gy })
    sampleAt(gx, gy)
  }

  function handleLeave() {
    setHover(null)
    setReadout(null)
  }

  const canvasClass = 'w-full h-full cursor-crosshair'
  const canvasStyle = { imageRendering: 'pixelated' as const, display: 'block' as const }

  return (
    <ViewContainer width="lg">
      <ViewHeader
        title="Isolate channels"
        description="The same simulation shown twice — left channel U (the substrate), right channel V (the activator). They are coupled but move in opposite directions. Pause and hover either canvas to read both concentrations at a point."
      />

      {/* ── Controls: preset + transport ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
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

        <TransportControls
          running={running}
          onToggle={() => setRunning(r => !r)}
          onReset={handleReset}
          resetLabel="Reset simulation"
        />
      </div>

      {/* ── Channels + explanation, grouped so the row gap matches the column gap ── */}
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <CanvasStage>
            <canvas ref={canvasURef} onMouseMove={handleHover} onMouseLeave={handleLeave} className={canvasClass} style={canvasStyle} />
            {hover && <Crosshair cell={hover} />}
            {hover && readout && (
              <div className="absolute bottom-2 left-2 pointer-events-none rounded-md px-1.5 py-0.5 bg-void-0/80 backdrop-blur-sm type-annotation font-mono text-nebula">
                U {readout.u.toFixed(3)}
              </div>
            )}
          </CanvasStage>
          <CanvasStage>
            <canvas ref={canvasVRef} onMouseMove={handleHover} onMouseLeave={handleLeave} className={canvasClass} style={canvasStyle} />
            {hover && <Crosshair cell={hover} />}
            {hover && readout && (
              <div className="absolute bottom-2 left-2 pointer-events-none rounded-md px-1.5 py-0.5 bg-void-0/80 backdrop-blur-sm type-annotation font-mono text-supernova">
                V {readout.v.toFixed(3)}
              </div>
            )}
          </CanvasStage>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <CalloutCard colour="nebula" label="U is the substrate">
            U starts at 1 everywhere (full concentration) — the bright field. Where V is present,
            U is consumed, carving out the dark holes.
          </CalloutCard>
          <CalloutCard colour="supernova" label="V is the activator">
            V begins near zero and is produced where U is present. The pattern you see in Simulate
            is entirely the V concentration — U is its inverse.
          </CalloutCard>
        </div>
      </div>
    </ViewContainer>
  )
}
