'use client'

import { useMemo, useRef } from 'react'
import { Download } from 'lucide-react'
import type { Automaton } from '@/lib/automata'
import {
  layoutAutomaton,
  distanceToSegment,
  type PositionedState,
} from '@/lib/graph-layout'
import { PinchZoom } from '@/components/ui/pinch-zoom'
import { Button } from '@/components/ui/button'

interface Props {
  automaton: Automaton
  active: string[]
  width?: number
  height?: number
  showLegend?: boolean
  showControls?: boolean
}

interface RenderedEdge {
  from: string
  to: string
  label: string
}

function mergeEdges(automaton: Automaton): RenderedEdge[] {
  const map = new Map<string, RenderedEdge>()
  for (const e of automaton.edges) {
    const key = `${e.from}\u0000${e.to}`
    const existing = map.get(key)
    if (existing) {
      const symbols = new Set([
        ...existing.label.split(',').map((s) => s.trim()),
        ...e.label.split(',').map((s) => s.trim()),
      ])
      existing.label = Array.from(symbols).filter(Boolean).sort().join(',')
    } else {
      map.set(key, { ...e })
    }
  }
  return Array.from(map.values())
}

export function AutomatonGraph({
  automaton,
  active,
  width: customWidth,
  height: customHeight,
  showLegend = true,
  showControls = true,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  // Compute layout and dynamic viewBox
  const { states: positionedStates, viewBox } = useMemo(
    () =>
      layoutAutomaton(automaton, {
        width: customWidth,
        height: customHeight,
      }),
    [automaton, customWidth, customHeight],
  )

  const edges = useMemo(() => mergeEdges(automaton), [automaton])

  const pos = useMemo(() => {
    const m: Record<string, PositionedState> = {}
    for (const s of positionedStates) m[s.id] = s
    return m
  }, [positionedStates])

  const activeSet = new Set(active)

  function downloadSvg() {
    if (!svgRef.current) return
    const svgElement = svgRef.current
    const clone = svgElement.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('version', '1.1')

    // Add inline CSS styling rules for standalone SVG viewers
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    style.textContent = `
      text { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
      .fill-foreground { fill: #f8fafc; }
      .fill-muted-foreground { fill: #94a3b8; }
      .fill-primary { fill: #3b82f6; }
      .fill-primary-foreground { fill: #ffffff; }
      .fill-card { fill: #0f172a; }
      .fill-secondary\\/80 { fill: #1e293b; }
      .fill-primary\\/20 { fill: rgba(59, 130, 246, 0.2); }
      .stroke-foreground { stroke: #f8fafc; }
      .stroke-muted-foreground { stroke: #64748b; }
      .stroke-primary { stroke: #3b82f6; }
      .stroke-primary-foreground { stroke: #ffffff; }
      .stroke-border\\/40, .stroke-border\\/50 { stroke: #334155; }
    `
    clone.insertBefore(style, clone.firstChild)

    const svgString = new XMLSerializer().serializeToString(clone)
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${automaton.id || 'automaton'}-diagram.svg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="relative flex min-h-full flex-1 flex-col justify-center">
      {/* Optional Top action toolbar */}
      {showControls && (
        <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 bg-background/80 px-2 font-mono text-[11px] backdrop-blur"
            onClick={downloadSvg}
            title="Export state transition diagram as SVG"
          >
            <Download className="size-3" /> SVG
          </Button>
        </div>
      )}

      <PinchZoom className="flex min-h-full flex-1 flex-col justify-center">
        <svg
          ref={svgRef}
          viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
          className="h-auto w-full max-w-full select-none"
          role="img"
          aria-label={`State transition diagram for ${automaton.name}`}
        >
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" className="fill-muted-foreground" />
            </marker>
            <marker
              id="arrow-active"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" className="fill-primary" />
            </marker>
          </defs>

          {/* Transition Edges */}
          {edges.map((edge) => {
            const a = pos[edge.from]
            const b = pos[edge.to]
            if (!a || !b) return null

            const edgeActive = activeSet.has(edge.from) && activeSet.has(edge.to)
            const badgeW = Math.max(24, edge.label.length * 9.5 + 10)

            if (edge.from === edge.to) {
              // Self-loop arc above the state
              const cx = a.x
              const cy = a.y - a.ry
              const path = `M ${cx - 14} ${cy - 2} C ${cx - 36} ${cy - 48}, ${
                cx + 36
              } ${cy - 48}, ${cx + 14} ${cy - 2}`
              const labelX = cx
              const labelY = cy - 54

              return (
                <g key={`${edge.from}-self`}>
                  <path
                    d={path}
                    fill="none"
                    className={
                      edgeActive ? 'stroke-primary' : 'stroke-muted-foreground'
                    }
                    strokeWidth={edgeActive ? 2.5 : 1.5}
                    markerEnd={`url(#${edgeActive ? 'arrow-active' : 'arrow'})`}
                  />
                  {/* Badge shielding to prevent overlap */}
                  <rect
                    x={labelX - badgeW / 2}
                    y={labelY - 9}
                    width={badgeW}
                    height={18}
                    rx={4}
                    ry={4}
                    className="fill-card stroke-border/40"
                    strokeWidth={1}
                  />
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="fill-foreground font-mono text-[13px] font-semibold"
                  >
                    {edge.label}
                  </text>
                </g>
              )
            }

            // Directed Edge between two distinct states
            const dx = b.x - a.x
            const dy = b.y - a.y
            const dist = Math.hypot(dx, dy) || 1
            const ux = dx / dist
            const uy = dy / dist
            const nx = -uy
            const ny = ux

            const isBackward = dx < -10
            const skipsIntermediate = positionedStates.some(
              (s) =>
                s.id !== edge.from &&
                s.id !== edge.to &&
                distanceToSegment(s.x, s.y, a.x, a.y, b.x, b.y) < s.rx + 24,
            )
            const hasReverse = edges.some(
              (e) => e.from === edge.to && e.to === edge.from,
            )

            let curveOffset = 0
            if (isBackward) {
              // Backward edge curves downward below the states
              const curveDir = ny < 0 ? -1 : 1
              const extraDepth = skipsIntermediate ? 55 + Math.max(0, (dist - 280) / 140) * 30 : 0
              curveOffset = (46 + extraDepth) * curveDir
            } else if (dx > 10 && skipsIntermediate) {
              // Forward edge skipping states curves upward above states
              const curveDir = ny > 0 ? -1 : 1
              const extraDepth = 55 + Math.max(0, (dist - 280) / 140) * 30
              curveOffset = (46 + extraDepth) * curveDir
            } else if (hasReverse) {
              // Forward edge curves upward; backward edge curves downward
              curveOffset = dx >= 0 ? -28 : 32
            }

            const startX = a.x + ux * a.rx
            const startY = a.y + uy * a.ry
            const endX = b.x - ux * (b.rx + 4)
            const endY = b.y - uy * (b.ry + 4)

            let d: string
            let labelX: number
            let labelY: number

            if (curveOffset !== 0) {
              const midX = (startX + endX) / 2 + nx * curveOffset
              const midY = (startY + endY) / 2 + ny * curveOffset
              d = `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`

              const apexX = 0.25 * startX + 0.5 * midX + 0.25 * endX
              const apexY = 0.25 * startY + 0.5 * midY + 0.25 * endY
              const dirX = nx * (curveOffset >= 0 ? 1 : -1)
              const dirY = ny * (curveOffset >= 0 ? 1 : -1)

              // Label sits outside the curve with safe clearance from states
              labelX = apexX + dirX * 15
              labelY = apexY + dirY * 15
            } else {
              d = `M ${startX} ${startY} L ${endX} ${endY}`
              labelX = (startX + endX) / 2 + nx * -12
              labelY = (startY + endY) / 2 + ny * -12
            }

            return (
              <g key={`${edge.from}-${edge.to}`}>
                <path
                  d={d}
                  fill="none"
                  className={
                    edgeActive ? 'stroke-primary' : 'stroke-muted-foreground'
                  }
                  strokeWidth={edgeActive ? 2.5 : 1.5}
                  markerEnd={`url(#${edgeActive ? 'arrow-active' : 'arrow'})`}
                />
                {/* Background badge for label to prevent overlap with lines or states */}
                <rect
                  x={labelX - badgeW / 2}
                  y={labelY - 9}
                  width={badgeW}
                  height={18}
                  rx={4}
                  ry={4}
                  className="fill-card stroke-border/40"
                  strokeWidth={1}
                />
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-foreground font-mono text-[13px] font-semibold"
                >
                  {edge.label}
                </text>
              </g>
            )
          })}

          {/* Initial State Arrow & "start" label */}
          {(() => {
            const s = pos[automaton.start]
            if (!s) return null
            const startArrowLen = 38
            const arrowStartX = s.x - s.rx - startArrowLen
            const badgeW = 42
            const badgeH = 20
            const badgeX = arrowStartX - 8 - badgeW / 2

            return (
              <g key="start-pointer">
                <line
                  x1={arrowStartX}
                  y1={s.y}
                  x2={s.x - s.rx - 4}
                  y2={s.y}
                  className="stroke-foreground"
                  strokeWidth={2}
                  markerEnd="url(#arrow)"
                />
                <rect
                  x={badgeX - badgeW / 2}
                  y={s.y - badgeH / 2}
                  width={badgeW}
                  height={badgeH}
                  rx={4}
                  ry={4}
                  className="fill-secondary/80 stroke-border/50"
                  strokeWidth={1}
                />
                <text
                  x={badgeX}
                  y={s.y}
                  dominantBaseline="central"
                  textAnchor="middle"
                  className="fill-muted-foreground font-mono text-xs font-semibold"
                >
                  start
                </text>
              </g>
            )
          })()}

          {/* Automaton States */}
          {positionedStates.map((s) => {
            const isActive = activeSet.has(s.id)

            return (
              <g key={s.id} className="transition-transform duration-150">
                {/* Active halo */}
                {isActive && (
                  <rect
                    x={s.x - s.rx - 7}
                    y={s.y - s.ry - 7}
                    width={(s.rx + 7) * 2}
                    height={(s.ry + 7) * 2}
                    rx={s.ry + 7}
                    ry={s.ry + 7}
                    className="fill-primary/20"
                  />
                )}

                {/* Main state capsule / circle */}
                <rect
                  x={s.x - s.rx}
                  y={s.y - s.ry}
                  width={s.rx * 2}
                  height={s.ry * 2}
                  rx={s.ry}
                  ry={s.ry}
                  className={
                    isActive
                      ? 'fill-primary stroke-primary'
                      : 'fill-card stroke-muted-foreground'
                  }
                  strokeWidth={2}
                />

                {/* Double boundary for accepting state */}
                {s.accept && (
                  <rect
                    x={s.x - s.rx + 5}
                    y={s.y - s.ry + 5}
                    width={(s.rx - 5) * 2}
                    height={(s.ry - 5) * 2}
                    rx={Math.max(12, s.ry - 5)}
                    ry={Math.max(12, s.ry - 5)}
                    fill="none"
                    className={
                      isActive
                        ? 'stroke-primary-foreground'
                        : 'stroke-muted-foreground'
                    }
                    strokeWidth={1.6}
                  />
                )}

                {/* State Label */}
                <text
                  x={s.x}
                  y={s.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className={
                    isActive
                      ? 'fill-primary-foreground font-mono text-[14px] font-semibold'
                      : 'fill-foreground font-mono text-[14px] font-medium'
                  }
                >
                  {s.id}
                </text>
              </g>
            )
          })}
        </svg>
      </PinchZoom>

      {/* Visual Legend */}
      {showLegend && (
        <div className="flex flex-wrap items-center gap-4 border-t border-border/50 bg-secondary/20 px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-muted-foreground" />
            <span>→ Start state</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-full border border-double border-muted-foreground stroke-2" />
            <span>Double circle = Accept (F)</span>
          </div>
          {automaton.nondeterministic && (
            <div className="flex items-center gap-1.5 text-accent">
              <span>ε = Empty move</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
