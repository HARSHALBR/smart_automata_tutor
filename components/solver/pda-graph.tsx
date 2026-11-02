'use client'

import { useMemo, useRef, useState } from 'react'
import { Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { type FormalPda, type PdaRule } from '@/lib/pda'
import { cn } from '@/lib/utils'

interface PdaNodeLayout {
  id: string
  x: number
  y: number
  isStart: boolean
  isAccept: boolean
}

interface EdgeGroup {
  from: string
  to: string
  labels: string[]
  isSelfLoop: boolean
  isForward: boolean
  span: number
}

export function PdaGraph({
  pda,
  activeState,
  title = 'PDA State Diagram',
  className,
}: {
  pda: FormalPda
  activeState?: string
  title?: string
  className?: string
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [zoom, setZoom] = useState(1)

  // Layout states in a clear horizontal flow or arc
  const { nodes, nodeMap, edges, viewBox } = useMemo(() => {
    const states = pda.states
    const n = states.length
    const nodeMap = new Map<string, PdaNodeLayout>()
    const nodes: PdaNodeLayout[] = []

    const R = 26
    const START_OFFSET_X = 90
    const SPACING_X = Math.max(170, Math.min(240, 800 / Math.max(n, 1)))
    const BASE_Y = 140

    states.forEach((st, idx) => {
      const x = START_OFFSET_X + idx * SPACING_X
      const y = BASE_Y
      const isStart = st === pda.startState
      const isAccept = pda.acceptStates.includes(st)
      const layout: PdaNodeLayout = { id: st, x, y, isStart, isAccept }
      nodeMap.set(st, layout)
      nodes.push(layout)
    })

    // Group transitions by (from, to)
    const edgeGroupMap = new Map<string, EdgeGroup>()

    for (const r of pda.rules) {
      const key = `${r.from}->${r.to}`
      const inp = r.input === '' || r.input === 'ε' ? 'ε' : r.input
      const pop = r.pop === '' || r.pop === 'ε' ? 'ε' : r.pop
      const push = r.push.length === 0 ? 'ε' : r.push.join('')
      const label = `${inp}, ${pop} → ${push}`

      if (!edgeGroupMap.has(key)) {
        const fromIdx = states.indexOf(r.from)
        const toIdx = states.indexOf(r.to)
        edgeGroupMap.set(key, {
          from: r.from,
          to: r.to,
          labels: [label],
          isSelfLoop: r.from === r.to,
          isForward: toIdx > fromIdx,
          span: Math.abs(toIdx - fromIdx),
        })
      } else {
        const eg = edgeGroupMap.get(key)!
        if (!eg.labels.includes(label)) {
          eg.labels.push(label)
        }
      }
    }

    const edges = Array.from(edgeGroupMap.values())

    // Compute bounding box
    let minX = 0
    let maxX = START_OFFSET_X + (n - 1) * SPACING_X + 90
    let minY = 20
    let maxY = BASE_Y + 140

    return {
      nodes,
      nodeMap,
      edges,
      viewBox: { minX, minY, width: maxX - minX + 40, height: maxY - minY },
    }
  }, [pda])

  function handleExportSvg() {
    if (!svgRef.current) return
    const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const svgData = new XMLSerializer().serializeToString(svgClone)
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `pda-diagram-${Date.now()}.svg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className={cn('relative flex flex-col rounded-2xl border border-border bg-card/60 backdrop-blur overflow-hidden', className)}>
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-bold text-primary">
            {pda.states.length} States | {pda.rules.length} Rules
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
            className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            title="Zoom out"
          >
            <ZoomOut className="size-3.5" />
          </button>
          <span className="min-w-10 text-center font-mono text-[11px] text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
            className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            title="Zoom in"
          >
            <ZoomIn className="size-3.5" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            title="Reset zoom"
          >
            <RotateCcw className="size-3.5" />
          </button>
          <button
            onClick={handleExportSvg}
            className="ml-1 inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 font-mono text-xs font-medium text-foreground transition-colors hover:bg-secondary"
            title="Export as SVG"
          >
            <Download className="size-3.5" />
            <span>Export SVG</span>
          </button>
        </div>
      </div>

      {/* Diagram Canvas */}
      <div className="flex-1 w-full min-h-[300px] max-h-[460px] overflow-auto p-4 flex items-center justify-center">
        <svg
          ref={svgRef}
          viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
          className="h-full w-full max-h-[400px] transition-transform duration-150 select-none"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <marker
              id="pda-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="hsl(var(--primary))" />
            </marker>
            <marker
              id="pda-arrow-muted"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="hsl(var(--muted-foreground))" />
            </marker>
          </defs>

          {/* Initial State Pointer */}
          {nodeMap.get(pda.startState) && (
            <g>
              <line
                x1={nodeMap.get(pda.startState)!.x - 55}
                y1={nodeMap.get(pda.startState)!.y}
                x2={nodeMap.get(pda.startState)!.x - 30}
                y2={nodeMap.get(pda.startState)!.y}
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                markerEnd="url(#pda-arrow)"
              />
              <text
                x={nodeMap.get(pda.startState)!.x - 62}
                y={nodeMap.get(pda.startState)!.y + 4}
                textAnchor="end"
                className="fill-primary font-mono text-xs font-bold"
              >
                start
              </text>
            </g>
          )}

          {/* Transition Edges */}
          {edges.map((eg, idx) => {
            const fromNode = nodeMap.get(eg.from)
            const toNode = nodeMap.get(eg.to)
            if (!fromNode || !toNode) return null

            const combinedLabel = eg.labels.join(' | ')

            if (eg.isSelfLoop) {
              // Self loop arc over the top of the node
              const cx = fromNode.x
              const cy = fromNode.y - 26
              const pathD = `M ${cx - 14} ${cy} C ${cx - 24} ${cy - 48}, ${cx + 24} ${cy - 48}, ${cx + 14} ${cy}`
              return (
                <g key={`loop_${idx}`}>
                  <path
                    d={pathD}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    markerEnd="url(#pda-arrow)"
                  />
                  <rect
                    x={cx - (combinedLabel.length * 3.8 + 8)}
                    y={cy - 64}
                    width={combinedLabel.length * 7.6 + 16}
                    height={18}
                    rx={6}
                    fill="hsl(var(--card))"
                    stroke="hsl(var(--border))"
                    strokeWidth={1}
                  />
                  <text
                    x={cx}
                    y={cy - 52}
                    textAnchor="middle"
                    className="fill-foreground font-mono text-[11px] font-bold"
                  >
                    {combinedLabel}
                  </text>
                </g>
              )
            }

            if (eg.isForward && eg.span === 1) {
              // Straight forward line
              const x1 = fromNode.x + 26
              const y1 = fromNode.y
              const x2 = toNode.x - 26
              const y2 = toNode.y
              const midX = (x1 + x2) / 2
              return (
                <g key={`edge_${idx}`}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    markerEnd="url(#pda-arrow)"
                  />
                  <rect
                    x={midX - (combinedLabel.length * 3.8 + 8)}
                    y={y1 - 22}
                    width={combinedLabel.length * 7.6 + 16}
                    height={18}
                    rx={6}
                    fill="hsl(var(--card))"
                    stroke="hsl(var(--border))"
                    strokeWidth={1}
                  />
                  <text
                    x={midX}
                    y={y1 - 10}
                    textAnchor="middle"
                    className="fill-foreground font-mono text-[11px] font-bold"
                  >
                    {combinedLabel}
                  </text>
                </g>
              )
            }

            // Curved edge (backward or multi-hop forward)
            const isBackward = !eg.isForward
            const curveDepth = isBackward ? 65 + eg.span * 20 : -(55 + eg.span * 15)
            const x1 = isBackward ? fromNode.x - 12 : fromNode.x + 12
            const y1 = isBackward ? fromNode.y + 24 : fromNode.y - 24
            const x2 = isBackward ? toNode.x + 12 : toNode.x - 12
            const y2 = isBackward ? toNode.y + 24 : toNode.y - 24
            const midX = (fromNode.x + toNode.x) / 2
            const midY = fromNode.y + curveDepth

            const pathD = `M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`
            const labelY = isBackward ? midY + 4 : midY - 14

            return (
              <g key={`curve_${idx}`}>
                <path
                  d={pathD}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  markerEnd="url(#pda-arrow)"
                />
                <rect
                  x={midX - (combinedLabel.length * 3.8 + 8)}
                  y={labelY - 10}
                  width={combinedLabel.length * 7.6 + 16}
                  height={18}
                  rx={6}
                  fill="hsl(var(--card))"
                  stroke="hsl(var(--border))"
                  strokeWidth={1}
                />
                <text
                  x={midX}
                  y={labelY + 2}
                  textAnchor="middle"
                  className="fill-foreground font-mono text-[11px] font-bold"
                >
                  {combinedLabel}
                </text>
              </g>
            )
          })}

          {/* State Nodes */}
          {nodes.map((n) => {
            const isActive = activeState === n.id

            return (
              <g key={n.id} className="cursor-pointer transition-transform hover:scale-105">
                {/* Active halo */}
                {isActive && (
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={32}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    strokeDasharray="4 4"
                    className="animate-spin-slow opacity-80"
                  />
                )}

                {/* Outer circle */}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={26}
                  className={cn(
                    'transition-colors',
                    isActive
                      ? 'fill-primary/20 stroke-primary stroke-[2.5px]'
                      : 'fill-card stroke-border stroke-2',
                  )}
                />

                {/* Double ring for accept state */}
                {n.isAccept && (
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={21}
                    fill="none"
                    stroke={isActive ? 'hsl(var(--primary))' : 'hsl(var(--foreground))'}
                    strokeWidth={1.5}
                  />
                )}

                {/* State Label */}
                <text
                  x={n.x}
                  y={n.y + 4}
                  textAnchor="middle"
                  className={cn(
                    'font-mono text-xs font-bold transition-colors',
                    isActive ? 'fill-primary' : 'fill-foreground',
                  )}
                >
                  {n.id}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Footer Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 border-t border-border bg-secondary/20 px-4 py-2 font-mono text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-full border-2 border-primary bg-card" />
          <span>Regular State</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-full border-2 border-foreground ring-2 ring-foreground/20 bg-card" />
          <span>Accepting State (Double Ring)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-primary">a, X → α</span>
          <span>Input, Pop → Push</span>
        </div>
      </div>
    </div>
  )
}

