'use client'

import { useMemo, useRef, useState } from 'react'
import { Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { type ParseNode } from '@/lib/cfg'
import { cn } from '@/lib/utils'

interface LayoutNode {
  id: string
  symbol: string
  x: number
  y: number
  r: number
  isLeaf: boolean
  isEpsilon: boolean
  children: LayoutNode[]
}

interface TreeLayoutData {
  root: LayoutNode
  nodes: LayoutNode[]
  edges: { x1: number; y1: number; x2: number; y2: number }[]
  viewBox: { minX: number; minY: number; width: number; height: number }
}

function getNodeRadius(symbol: string): number {
  if (symbol.length <= 1) return 20
  if (symbol.length === 2) return 22
  return Math.min(36, 16 + symbol.length * 4)
}

/**
 * Computes a non-overlapping hierarchical layout for arbitrary ParseNode trees.
 */
function computeTreeLayout(tree: ParseNode): TreeLayoutData {
  if (!tree || !tree.symbol) {
    const fallbackNode: LayoutNode = {
      id: 'node_fallback',
      symbol: '∅',
      x: 140,
      y: 90,
      r: 20,
      isLeaf: true,
      isEpsilon: false,
      children: [],
    }
    return {
      root: fallbackNode,
      nodes: [fallbackNode],
      edges: [],
      viewBox: { minX: 0, minY: 0, width: 280, height: 180 },
    }
  }

  let leafCounter = 0
  let maxDepth = 0
  let idGen = 0

  const X_GAP = 68
  const Y_GAP = 80
  const MARGIN_X = 60
  const MARGIN_Y = 50

  function layoutRecursive(node: ParseNode, depth: number): LayoutNode {
    maxDepth = Math.max(maxDepth, depth)
    const currentId = `node_${idGen++}`
    const isEpsilon = node.symbol === 'ε' || node.symbol === ''
    const hasKids = Boolean(node.children && node.children.length > 0)
    const nodeSymbol = isEpsilon ? 'ε' : node.symbol
    const r = getNodeRadius(nodeSymbol)

    if (!hasKids) {
      const x = leafCounter * X_GAP
      leafCounter += 1
      return {
        id: currentId,
        symbol: nodeSymbol,
        x,
        y: depth * Y_GAP,
        r,
        isLeaf: true,
        isEpsilon,
        children: [],
      }
    }

    const childrenLayout = node.children!.map((child) => layoutRecursive(child, depth + 1))
    // Center parent symmetrically over its first and last immediate children
    const firstX = childrenLayout[0].x
    const lastX = childrenLayout[childrenLayout.length - 1].x
    const x = (firstX + lastX) / 2

    return {
      id: currentId,
      symbol: nodeSymbol,
      x,
      y: depth * Y_GAP,
      r,
      isLeaf: false,
      isEpsilon: false,
      children: childrenLayout,
    }
  }

  const root = layoutRecursive(tree, 0)

  // Collect all nodes and compute edge lines trimmed precisely at node perimeters
  const nodes: LayoutNode[] = []
  const edges: { x1: number; y1: number; x2: number; y2: number }[] = []

  function traverse(n: LayoutNode) {
    nodes.push(n)
    for (const c of n.children) {
      const dx = c.x - n.x
      const dy = c.y - n.y
      const dist = Math.hypot(dx, dy)
      if (dist > n.r + c.r) {
        const uX = dx / dist
        const uY = dy / dist
        edges.push({
          x1: n.x + uX * n.r,
          y1: n.y + uY * n.r,
          x2: c.x - uX * c.r,
          y2: c.y - uY * c.r,
        })
      } else {
        edges.push({ x1: n.x, y1: n.y, x2: c.x, y2: c.y })
      }
      traverse(c)
    }
  }
  traverse(root)

  // Compute bounding box
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const n of nodes) {
    minX = Math.min(minX, n.x - n.r)
    maxX = Math.max(maxX, n.x + n.r)
    minY = Math.min(minY, n.y - n.r)
    maxY = Math.max(maxY, n.y + n.r)
  }

  minX -= MARGIN_X
  maxX += MARGIN_X
  minY -= MARGIN_Y
  maxY += MARGIN_Y

  let width = maxX - minX
  if (width < 320) {
    const pad = (320 - width) / 2
    minX -= pad
    width = 320
  }

  let height = maxY - minY
  if (height < 200) {
    const pad = (200 - height) / 2
    minY -= pad
    height = 200
  }

  return {
    root,
    nodes,
    edges,
    viewBox: { minX, minY, width, height },
  }
}

export function ParseTreeVisualizer({
  tree,
  title = 'Context-Free Parse Tree',
  className,
}: {
  tree: ParseNode
  title?: string
  className?: string
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [zoom, setZoom] = useState(1)

  const layout = useMemo(() => computeTreeLayout(tree), [tree])
  const { nodes, edges, viewBox } = layout

  function handleExportSvg() {
    if (!svgRef.current) return
    const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

    const svgData = new XMLSerializer().serializeToString(svgClone)
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `parse-tree-${Date.now()}.svg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className={cn('relative flex flex-col rounded-2xl border border-border bg-card/60 backdrop-blur overflow-hidden shadow-lg', className)}>
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          <span className="rounded-full bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 font-mono text-[11px] font-bold text-sky-400">
            Root: {tree.symbol}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}
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

      {/* SVG Canvas Area */}
      <div className="flex-1 w-full min-h-[320px] max-h-[500px] overflow-auto p-4 flex items-center justify-center bg-[#090d16]">
        <svg
          ref={svgRef}
          viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
          className="h-full w-full max-h-[460px] transition-transform duration-150 select-none"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Subtle engineering dot grid pattern */}
            <pattern
              id="parse-tree-grid"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="12" cy="12" r="1" fill="#334155" opacity="0.35" />
            </pattern>
          </defs>

          {/* Background Canvas */}
          <rect
            x={viewBox.minX}
            y={viewBox.minY}
            width={viewBox.width}
            height={viewBox.height}
            fill="#090d16"
          />
          <rect
            x={viewBox.minX}
            y={viewBox.minY}
            width={viewBox.width}
            height={viewBox.height}
            fill="url(#parse-tree-grid)"
          />

          {/* Tree Edges (Branches) */}
          <g className="tree-edges">
            {edges.map((e, idx) => (
              <line
                key={`edge_${idx}`}
                x1={e.x1}
                y1={e.y1}
                x2={e.x2}
                y2={e.y2}
                stroke="#64748b"
                strokeWidth={2}
                strokeLinecap="round"
                opacity={0.85}
              />
            ))}
          </g>

          {/* Tree Nodes */}
          <g className="tree-nodes">
            {nodes.map((n) => {
              const fontSize = n.symbol.length > 3 ? 10 : n.symbol.length > 1 ? 12 : 13

              // Distinct high-contrast palette
              const fillColor = n.isEpsilon
                ? '#241606'
                : n.isLeaf
                ? '#04241b'
                : '#0b1c30'

              const strokeColor = n.isEpsilon
                ? '#f59e0b'
                : n.isLeaf
                ? '#10b981'
                : '#38bdf8'

              const textColor = n.isEpsilon
                ? '#fbbf24'
                : n.isLeaf
                ? '#34d399'
                : '#e0f2fe'

              const strokeWidth = n.isEpsilon ? 2 : 2.5
              const strokeDasharray = n.isEpsilon ? '4 3' : undefined

              const tooltipText = n.isEpsilon
                ? 'Empty string (ε)'
                : n.isLeaf
                ? `Terminal: "${n.symbol}"`
                : `Non-Terminal Variable: ${n.symbol}`

              return (
                <g
                  key={n.id}
                  className="cursor-pointer transition-transform duration-150 hover:scale-110"
                  style={{ transformOrigin: `${n.x}px ${n.y}px` }}
                >
                  <title>{tooltipText}</title>
                  {/* Base Circle */}
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={n.r}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDasharray}
                  />
                  {/* Centered Node Label */}
                  <text
                    x={n.x}
                    y={n.y}
                    fill={textColor}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                    fontWeight="700"
                    style={{ fontSize: `${fontSize}px` }}
                    className="select-none pointer-events-none"
                  >
                    {n.symbol}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>
      </div>

      {/* Legend Footer */}
      <div className="flex flex-wrap items-center justify-center gap-6 border-t border-border bg-secondary/30 px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="size-3.5 rounded-full border-2 border-sky-400 bg-[#0b1c30] shadow-[0_0_8px_rgba(56,189,248,0.35)]" />
          <span className="text-foreground font-medium">Non-Terminal (Variable)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-3.5 rounded-full border-2 border-emerald-500 bg-[#04241b] shadow-[0_0_8px_rgba(16,185,129,0.35)]" />
          <span className="text-foreground font-medium">Terminal Leaf</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-3.5 rounded-full border-2 border-dashed border-amber-500 bg-[#241606] shadow-[0_0_8px_rgba(245,158,11,0.35)]" />
          <span className="text-foreground font-medium">Empty String (ε)</span>
        </div>
      </div>
    </div>
  )
}
