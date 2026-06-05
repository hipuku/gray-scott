import { useEffect, useRef, useState } from 'react'
import { ViewHeader } from '@kern/molecules/ViewHeader'
import { StatusChip } from '@kern/atoms/StatusChip'
import { ToolLink } from '@kern/molecules/ToolLink'
import { cn } from '@/lib/utils'
import {
  PEARSON_REGIONS,
  F_MIN, F_MAX, K_MIN, K_MAX,
} from '@/simulation/pearson'
import { PRESETS } from '@/simulation/presets'

// Named canvas color constants — CSS variables don't resolve in a 2D canvas context.
// These must stay in sync with the design tokens they reference.
const CANVAS_BG         = '#1F1F20'  // --color-void-10
const CANVAS_PRESET_DOT = '#7193ED'  // --color-pulsar
const CANVAS_DOT_STROKE = '#121213'  // --color-void-0
const CANVAS_TICK       = '#383839'  // --color-void-30

// Canvas dimensions for the static parameter space map
const MAP_W = 480
const MAP_H = 400

// Grid size for the live preview simulation (worker renders at this resolution;
// the CSS container scales it up with pixelated rendering)
const PREVIEW_SIZE = 128

function toCanvas(f: number, k: number): { x: number; y: number } {
  const x = ((k - K_MIN) / (K_MAX - K_MIN)) * MAP_W
  const y = (1 - (f - F_MIN) / (F_MAX - F_MIN)) * MAP_H
  return { x, y }
}

function fromCanvas(px: number, py: number): { f: number; k: number } {
  const k = K_MIN + (px / MAP_W) * (K_MAX - K_MIN)
  const f = F_MIN + (1 - py / MAP_H) * (F_MAX - F_MIN)
  return { f, k }
}

interface ViewSpaceProps {
  onJumpToParams: (f: number, k: number) => void
}

export function ViewSpace({ onJumpToParams }: ViewSpaceProps) {
  const mapRef     = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const workerRef  = useRef<Worker | null>(null)
  const rafRef     = useRef<number>(0)

  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null)
  const [selected, setSelected]           = useState<{ f: number; k: number } | null>(null)

  // Draw the static parameter space map once
  useEffect(() => {
    const canvas = mapRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width  = MAP_W
    canvas.height = MAP_H

    ctx.fillStyle = CANVAS_BG
    ctx.fillRect(0, 0, MAP_W, MAP_H)

    for (const region of PEARSON_REGIONS) {
      const tl = toCanvas(region.fMax, region.kMin)
      const br = toCanvas(region.fMin, region.kMax)
      const w  = br.x - tl.x
      const h  = br.y - tl.y
      ctx.fillStyle   = region.hex + '33'
      ctx.fillRect(tl.x, tl.y, w, h)
      ctx.strokeStyle = region.hex + '88'
      ctx.lineWidth   = 1
      ctx.strokeRect(tl.x + 0.5, tl.y + 0.5, w - 1, h - 1)
    }

    for (const preset of PRESETS) {
      const { x, y } = toCanvas(preset.f, preset.k)
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fillStyle   = CANVAS_PRESET_DOT
      ctx.fill()
      ctx.strokeStyle = CANVAS_DOT_STROKE
      ctx.lineWidth   = 1.5
      ctx.stroke()
    }

    ctx.strokeStyle = CANVAS_TICK
    ctx.lineWidth   = 1
    for (let k = K_MIN; k <= K_MAX + 0.001; k += 0.005) {
      const { x } = toCanvas(F_MIN, k)
      ctx.beginPath(); ctx.moveTo(x, MAP_H - 6); ctx.lineTo(x, MAP_H); ctx.stroke()
    }
    for (let f = F_MIN; f <= F_MAX + 0.001; f += 0.01) {
      const { y } = toCanvas(f, K_MIN)
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(6, y); ctx.stroke()
    }
  }, [])

  // Live preview — runs in a worker, restarts whenever a new point is selected
  useEffect(() => {
    if (!selected) return

    cancelAnimationFrame(rafRef.current)
    workerRef.current?.terminate()

    const canvas = previewRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width  = PREVIEW_SIZE
    canvas.height = PREVIEW_SIZE

    const worker = new Worker(
      new URL('../simulation/preview.worker.ts', import.meta.url),
      { type: 'module' },
    )
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent) => {
      const { type, buffer, n } = e.data
      if (type !== 'frame') return
      const pixels    = new Uint8ClampedArray(buffer)
      const imageData = new ImageData(pixels, n, n)
      ctx.putImageData(imageData, 0, 0)
      rafRef.current = requestAnimationFrame(() => worker.postMessage({ type: 'tick' }))
    }

    worker.postMessage({ type: 'init', n: PREVIEW_SIZE, f: selected.f, k: selected.k })
    rafRef.current = requestAnimationFrame(() => worker.postMessage({ type: 'tick' }))

    return () => {
      cancelAnimationFrame(rafRef.current)
      worker.terminate()
      workerRef.current = null
    }
  }, [selected])

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current)
    workerRef.current?.terminate()
  }, [])

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect   = e.currentTarget.getBoundingClientRect()
    const scaleX = MAP_W / rect.width
    const scaleY = MAP_H / rect.height
    const px = (e.clientX - rect.left) * scaleX
    const py = (e.clientY - rect.top)  * scaleY
    const { f, k } = fromCanvas(px, py)
    const region = PEARSON_REGIONS.find(r =>
      f >= r.fMin && f <= r.fMax && k >= r.kMin && k <= r.kMax
    )
    setHoveredRegion(region?.id ?? null)
  }

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect   = e.currentTarget.getBoundingClientRect()
    const scaleX = MAP_W / rect.width
    const scaleY = MAP_H / rect.height
    const px = (e.clientX - rect.left) * scaleX
    const py = (e.clientY - rect.top)  * scaleY
    const { f, k } = fromCanvas(px, py)
    setSelected({
      f: Math.max(F_MIN, Math.min(F_MAX, f)),
      k: Math.max(K_MIN, Math.min(K_MAX, k)),
    })
  }

  const selectedRegion = selected
    ? PEARSON_REGIONS.find(r =>
        selected.f >= r.fMin && selected.f <= r.fMax &&
        selected.k >= r.kMin && selected.k <= r.kMax
      ) ?? null
    : null

  return (
    <div className="flex flex-col gap-8 max-w-3xl mx-auto w-full">
      <ViewHeader
        title="Parameter space"
        description="The (f, k) plane mapped to Pearson's 1993 pattern classification. Click any point to preview the pattern that emerges at those parameters."
      />

      <div className="flex gap-6 items-start">

        {/* ── Map column ── */}
        <div className="flex flex-col gap-3 flex-1 min-w-0">

          <div className="flex items-center justify-between px-1">
            <span className="type-annotation text-void-40">k (kill rate) →</span>
            <div className="flex gap-2 items-center">
              <span className="type-annotation text-void-40">{K_MIN.toFixed(3)}</span>
              <div className="h-px bg-void-30 w-10" />
              <span className="type-annotation text-void-40">{K_MAX.toFixed(3)}</span>
            </div>
          </div>

          <div className="flex gap-2 items-stretch">
            <div className="flex items-center justify-center w-4">
              <span
                className="type-annotation text-void-40 whitespace-nowrap"
                style={{ transform: 'rotate(-90deg)' }}
              >
                f (feed) →
              </span>
            </div>
            <div className="flex-1 rounded-xl overflow-hidden border border-void-20 bg-void-10">
              <canvas
                ref={mapRef}
                className="w-full cursor-crosshair"
                style={{ display: 'block', aspectRatio: `${MAP_W} / ${MAP_H}` }}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoveredRegion(null)}
                onClick={handleClick}
              />
            </div>
          </div>

          {/* Legend — dims non-hovered regions on hover */}
          <div className="flex flex-wrap gap-2">
            {PEARSON_REGIONS.map(r => (
              <StatusChip
                key={r.id}
                colour={r.chipColour}
                className={cn(
                  'transition-opacity duration-150',
                  hoveredRegion && hoveredRegion !== r.id ? 'opacity-40' : 'opacity-100',
                )}
              >
                {r.label}
              </StatusChip>
            ))}
          </div>
        </div>

        {/* ── Preview column ── */}
        <div className="flex flex-col gap-3 w-[200px] shrink-0">
          <span className="type-annotation-sc text-void-60">Preview</span>

          {selected ? (
            <>
              <div className="rounded-xl overflow-hidden border border-void-20 bg-void-0 aspect-square">
                <canvas
                  ref={previewRef}
                  className="w-full h-full"
                  style={{ imageRendering: 'pixelated', display: 'block' }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="type-annotation text-void-40">f</span>
                  <span className="type-annotation font-mono text-void-80">{selected.f.toFixed(3)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="type-annotation text-void-40">k</span>
                  <span className="type-annotation font-mono text-void-80">{selected.k.toFixed(3)}</span>
                </div>
              </div>

              <StatusChip colour={selectedRegion?.chipColour ?? 'neutral'}>
                {selectedRegion ? selectedRegion.label : 'Boundary zone'}
              </StatusChip>

              <ToolLink onClick={() => onJumpToParams(selected.f, selected.k)}>
                Simulate →
              </ToolLink>
            </>
          ) : (
            <div className="rounded-xl border border-void-20 bg-void-10 aspect-square flex items-center justify-center p-4">
              <p className="type-annotation text-void-40 text-center">
                Click the map to preview the pattern at those parameters
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
