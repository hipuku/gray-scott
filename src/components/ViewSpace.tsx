import { useEffect, useRef, useState } from 'react'
import { ViewHeader } from '@kern/molecules/ViewHeader'
import { PatternGlyph } from '@/components/PatternGlyph'
import { cn } from '@/lib/utils'
import {
  PEARSON_REGIONS,
  F_MIN, F_MAX, K_MIN, K_MAX,
} from '@/simulation/pearson'

// Named canvas colours — CSS variables don't resolve in a 2D canvas context.
// The map is on-palette: regions are uniform nebula, distinguished by their glyphs.
const CANVAS_BG     = '#1F1F20'    // --color-void-10
const CANVAS_TICK   = '#383839'    // --color-void-30
const REGION_FILL   = '#15AD7014'  // --color-nebula @ ~8%
const REGION_STROKE = '#15AD7052'  // --color-nebula @ ~32%

// Logical coordinate space. The backing store is drawn at a multiple of this
// (SCALE) so it stays crisp when scaled up to full width.
const MAP_W = 480
const MAP_H = 300

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

// Region box in percentage coordinates, for overlay elements.
function regionRect(r: (typeof PEARSON_REGIONS)[number]) {
  const tl = toCanvas(r.fMax, r.kMin)
  const br = toCanvas(r.fMin, r.kMax)
  return {
    left:   `${(tl.x / MAP_W) * 100}%`,
    top:    `${(tl.y / MAP_H) * 100}%`,
    width:  `${((br.x - tl.x) / MAP_W) * 100}%`,
    height: `${((br.y - tl.y) / MAP_H) * 100}%`,
  }
}

interface Hover { xPct: number; yPct: number; f: number; k: number; regionId: string | null }

export function ViewSpace() {
  const mapRef = useRef<HTMLCanvasElement>(null)

  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null)
  const [hover, setHover]                 = useState<Hover | null>(null)

  // Draw the static parameter space map once, supersampled for crispness.
  useEffect(() => {
    const canvas = mapRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const scale = Math.min(4, Math.max(2, Math.round((window.devicePixelRatio || 1) * 2)))
    canvas.width  = MAP_W * scale
    canvas.height = MAP_H * scale
    ctx.scale(scale, scale)

    ctx.fillStyle = CANVAS_BG
    ctx.fillRect(0, 0, MAP_W, MAP_H)

    for (const region of PEARSON_REGIONS) {
      const tl = toCanvas(region.fMax, region.kMin)
      const br = toCanvas(region.fMin, region.kMax)
      const w  = br.x - tl.x
      const h  = br.y - tl.y
      ctx.fillStyle   = REGION_FILL
      ctx.fillRect(tl.x, tl.y, w, h)
      ctx.strokeStyle = REGION_STROKE
      ctx.lineWidth   = 1
      ctx.strokeRect(tl.x + 0.5, tl.y + 0.5, w - 1, h - 1)
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

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width)  * MAP_W
    const py = ((e.clientY - rect.top)  / rect.height) * MAP_H
    const { f, k } = fromCanvas(px, py)
    const region = PEARSON_REGIONS.find(r =>
      f >= r.fMin && f <= r.fMax && k >= r.kMin && k <= r.kMax
    )
    setHoveredRegion(region?.id ?? null)
    setHover({ xPct: (px / MAP_W) * 100, yPct: (py / MAP_H) * 100, f, k, regionId: region?.id ?? null })
  }

  function handleLeave() {
    setHoveredRegion(null)
    setHover(null)
  }

  const hoverRegion = hover?.regionId
    ? PEARSON_REGIONS.find(r => r.id === hover.regionId) ?? null
    : null

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full">
      <ViewHeader
        title="Parameter space"
        description="The (f, k) plane mapped to Pearson's 1993 pattern classification. Each region is marked by its pattern glyph; hover to read the parameters at any point."
      />

      {/* ── Map — full width, glyphs + axes + inspector inside ── */}
      <div className="relative rounded-xl overflow-hidden border border-void-20 bg-void-10">
        <canvas
          ref={mapRef}
          className="w-full block cursor-crosshair"
          style={{ aspectRatio: `${MAP_W} / ${MAP_H}` }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleLeave}
        />

        {/* Hovered region highlight */}
        {hoverRegion && (
          <div
            className="absolute pointer-events-none rounded-[3px]"
            style={{ ...regionRect(hoverRegion), backgroundColor: '#15AD7024', border: '1.5px solid #15AD70' }}
          />
        )}

        {/* Region glyphs, at each region's centre */}
        {PEARSON_REGIONS.map(r => {
          const c = toCanvas((r.fMin + r.fMax) / 2, (r.kMin + r.kMax) / 2)
          return (
            <div
              key={r.id}
              className={cn(
                'absolute -translate-x-1/2 -translate-y-1/2 text-nebula pointer-events-none transition-opacity duration-150',
                hoveredRegion && hoveredRegion !== r.id ? 'opacity-30' : 'opacity-100',
              )}
              style={{ left: `${(c.x / MAP_W) * 100}%`, top: `${(c.y / MAP_H) * 100}%` }}
            >
              <PatternGlyph id={r.id} className="w-5 h-5" />
            </div>
          )
        })}

        {/* Axis labels */}
        <span
          className="absolute left-2 top-1/2 type-annotation text-void-40 whitespace-nowrap pointer-events-none"
          style={{ writingMode: 'vertical-rl', transform: 'translateY(-50%) rotate(180deg)' }}
        >
          f — feed rate →
        </span>
        <span className="absolute bottom-2 right-3 type-annotation text-void-40 whitespace-nowrap pointer-events-none">
          k — kill rate →
        </span>

        {/* Hover crosshair */}
        {hover && (
          <div
            className="absolute pointer-events-none w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-void-90"
            style={{ left: `${hover.xPct}%`, top: `${hover.yPct}%`, boxShadow: '0 0 0 1.5px var(--color-void-0)' }}
          />
        )}

        {/* Hover readout — top-left */}
        {hover && (
          <div className="absolute top-2 left-2 pointer-events-none flex items-center gap-2 rounded-md px-2 py-1 bg-void-0/80 backdrop-blur-sm type-annotation font-mono">
            <span className="text-void-60">f {hover.f.toFixed(3)}</span>
            <span className="text-void-30">·</span>
            <span className="text-void-60">k {hover.k.toFixed(3)}</span>
            {hoverRegion && (
              <>
                <span className="text-void-30">·</span>
                <span className="flex items-center gap-1 text-nebula">
                  <PatternGlyph id={hoverRegion.id} />
                  {hoverRegion.label}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
