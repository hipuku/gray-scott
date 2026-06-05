import { useEffect, useRef, useState, useCallback } from 'react'
import { ViewHeader } from '@kern/molecules/ViewHeader'
import { StatusChip } from '@kern/atoms/StatusChip'
import { ToolLink }   from '@kern/molecules/ToolLink'
import { cn } from '@/lib/utils'
import { F_MIN, F_MAX, K_MIN, K_MAX, PEARSON_REGIONS, classifyRegion } from '@/simulation/pearson'

// ─── Grid configuration ───────────────────────────────────────────────────────

const COLS = 5
const ROWS = 5
const CELL_N = 128    // simulation grid size per cell
const CELL_PX = 120   // rendered canvas size (CSS px)

// Sample (f, k) uniformly across the parameter space
function buildGrid(): Array<{ id: string; f: number; k: number; col: number; row: number }> {
  const cells = []
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      // row 0 = high f (top), row ROWS-1 = low f (bottom)
      const f = F_MAX - (row / (ROWS - 1)) * (F_MAX - F_MIN)
      const k = K_MIN + (col / (COLS - 1)) * (K_MAX - K_MIN)
      cells.push({ id: `${row}-${col}`, f, k, col, row })
    }
  }
  return cells
}

const GRID = buildGrid()

// ─── ViewSweep ────────────────────────────────────────────────────────────────

interface ViewSweepProps {
  /** Called when the user clicks a cell — jumps Simulate to those params */
  onJumpToParams: (f: number, k: number) => void
}

export function ViewSweep({ onJumpToParams }: ViewSweepProps) {
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map())
  const ctxMap     = useRef<Map<string, CanvasRenderingContext2D>>(new Map())
  const workerRef  = useRef<Worker | null>(null)
  const rafRef     = useRef<number>(0)

  const [hovered, setHovered]   = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const registerCanvas = useCallback((id: string, el: HTMLCanvasElement | null) => {
    if (!el) { canvasRefs.current.delete(id); ctxMap.current.delete(id); return }
    canvasRefs.current.set(id, el)
    el.width  = CELL_N
    el.height = CELL_N
    const ctx = el.getContext('2d')
    if (ctx) ctxMap.current.set(id, ctx)
  }, [])

  useEffect(() => {
    const worker = new Worker(
      new URL('../simulation/sweep.worker.ts', import.meta.url),
      { type: 'module' },
    )
    workerRef.current = worker

    // Initialize all cells
    worker.postMessage({
      type: 'init',
      cells: GRID.map(({ id, f, k }) => ({ id, f, k })),
      n: CELL_N,
    })

    worker.onmessage = (e: MessageEvent) => {
      const { type, cells } = e.data
      if (type !== 'frames') return

      for (const { id, buffer } of cells as Array<{ id: string; buffer: ArrayBuffer }>) {
        const ctx = ctxMap.current.get(id)
        if (!ctx) continue
        const pixels    = new Uint8ClampedArray(buffer)
        const imageData = new ImageData(pixels, CELL_N, CELL_N)
        ctx.putImageData(imageData, 0, 0)
      }

      rafRef.current = requestAnimationFrame(() => worker.postMessage({ type: 'tick' }))
    }

    // Kick off
    rafRef.current = requestAnimationFrame(() => worker.postMessage({ type: 'tick' }))

    return () => {
      cancelAnimationFrame(rafRef.current)
      worker.terminate()
    }
  }, [])

  function handleClick(cell: typeof GRID[number]) {
    setSelected(cell.id)
    onJumpToParams(cell.f, cell.k)
  }

  const selectedCell = selected ? GRID.find(c => c.id === selected) ?? null : null
  const selectedRegion = selectedCell ? classifyRegion(selectedCell.f, selectedCell.k) : null

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full">
      <ViewHeader
        title="Phase sweep"
        description="All 25 combinations across the (f, k) plane running simultaneously. Click any cell to jump Simulate to those parameters."
      />

      <div className="flex gap-6 items-start">

        {/* ── Grid ── */}
        <div className="flex flex-col gap-1 flex-1 min-w-0">

          {/* k-axis label */}
          <div className="flex items-center gap-1 pl-5 mb-0.5">
            <span className="type-annotation text-void-40">k →</span>
            <div className="flex justify-between flex-1 px-1">
              <span className="type-annotation text-void-40">{K_MIN.toFixed(3)}</span>
              <span className="type-annotation text-void-40">{K_MAX.toFixed(3)}</span>
            </div>
          </div>

          <div className="flex gap-1">
            {/* f-axis label */}
            <div className="flex items-center justify-center w-4 shrink-0">
              <span
                className="type-annotation text-void-40 whitespace-nowrap"
                style={{ transform: 'rotate(-90deg)' }}
              >
                f →
              </span>
            </div>

            {/* Cell grid */}
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: `repeat(${COLS}, ${CELL_PX}px)` }}
            >
              {GRID.map(cell => {
                const region  = classifyRegion(cell.f, cell.k)
                const isHover = hovered === cell.id
                const isSel   = selected === cell.id

                return (
                  <div
                    key={cell.id}
                    className="relative group"
                    style={{ width: CELL_PX, height: CELL_PX }}
                  >
                    <canvas
                      ref={el => registerCanvas(cell.id, el)}
                      onClick={() => handleClick(cell)}
                      onMouseEnter={() => setHovered(cell.id)}
                      onMouseLeave={() => setHovered(null)}
                      className={cn(
                        'w-full h-full rounded-lg overflow-hidden cursor-pointer',
                        'transition-all duration-150',
                        'outline outline-1',
                        isSel
                          ? 'outline-(--color-pulsar) scale-[1.04]'
                          : isHover
                          ? 'outline-void-40 scale-[1.02]'
                          : region
                          ? 'outline-void-20'
                          : 'outline-void-10',
                      )}
                      style={{
                        imageRendering: 'pixelated',
                        display: 'block',
                        outlineColor: region && isHover && !isSel
                          ? region.hex + 'CC'
                          : undefined,
                      }}
                    />

                    {/* Region colour dot */}
                    {region && (
                      <span
                        className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rounded-full opacity-70"
                        style={{ backgroundColor: region.hex }}
                      />
                    )}

                    {/* Hover tooltip */}
                    {isHover && (
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 pointer-events-none z-10
                                      bg-void-20 border border-void-30 rounded-lg px-2 py-1 whitespace-nowrap">
                        <span className="type-annotation font-mono text-void-70">
                          f={cell.f.toFixed(3)} k={cell.k.toFixed(3)}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Info panel ── */}
        <div className="flex flex-col gap-4 w-44 shrink-0 bg-void-20 border border-void-30 rounded-xl p-4">
          <span className="type-annotation-sc text-void-60">Selected</span>

          {selectedCell ? (
            <>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="type-annotation text-void-40">f</span>
                  <span className="type-annotation font-mono text-void-80">{selectedCell.f.toFixed(3)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="type-annotation text-void-40">k</span>
                  <span className="type-annotation font-mono text-void-80">{selectedCell.k.toFixed(3)}</span>
                </div>
              </div>

              <StatusChip colour={selectedRegion?.chipColour ?? 'neutral'}>
                {selectedRegion ? selectedRegion.label : 'Boundary zone'}
              </StatusChip>

              <ToolLink onClick={() => onJumpToParams(selectedCell.f, selectedCell.k)}>
                Jump to Simulate →
              </ToolLink>
            </>
          ) : (
            <p className="type-annotation text-void-40">
              Click any cell to select its (f, k) pair and jump to it in Simulate.
            </p>
          )}

          {/* Pearson region legend */}
          <div className="flex flex-col gap-2 mt-2">
            <span className="type-annotation-sc text-void-60">Regions</span>
            {PEARSON_REGIONS.map(r => (
              <div key={r.id} className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: r.hex }}
                />
                <span className="type-annotation text-void-60">{r.label}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      <p className="type-annotation text-void-40 max-w-2xl">
        Each cell is an independent 128 × 128 Gray-Scott simulation running in a shared Web Worker.
        Dot colour marks the Pearson (1993) pattern region. Boundary zones between regions often produce the most complex transitional patterns.
      </p>
    </div>
  )
}
