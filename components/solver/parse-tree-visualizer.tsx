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

/**
 * Computes a non-overlapping hierarchical layout for arbitrary ParseNode trees.
 */
function computeTreeLayout(tree: ParseNode): TreeLayoutData {
  let leafCounter = 0
  let maxDepth = 0
  let idGen = 0

  const NODE_RADIUS = 18
  const X_GAP = 54
  const Y_GAP = 68
  const MARGIN_X = 50
  const MARGIN_Y = 40

  function layoutRecursive(node: ParseNode, depth: number): LayoutNode {
    maxDepth = Math.max(maxDepth, depth)
    const currentId = `node_${idGen++}`
    const isEpsilon = node.symbol === 'ε' || node.symbol === ''
    const hasKids = Boolean(node.children && node.children.length > 0)

    if (!hasKids) {
      const x = leafCounter * X_GAP
      leafCounter += 1
      return {
        id: currentId,
        symbol: isEpsilon ? 'ε' : node.symbol,
        x,
        y: depth * Y_GAP,
        isLeaf: true,
        isEpsilon,
        children: [],
      }
    }

    const childrenLayout = node.children!.map((child) => layoutRecursive(child, depth + 1))
    // Center parent over its children
    const firstX = childrenLayout[0].x
    const lastX = childrenLayout[childrenLayout.length - 1].x
    const x = (firstX + lastX) / 2

    return {
      id: currentId,
      symbol: node.symbol,
      x,
      y: depth * Y_GAP,
      isLeaf: false,
      isEpsilon: false,
      children: childrenLayout,
    }
  }

  const root = layoutRecursive(tree, 0)

  // Collect all nodes and edges
  const nodes: LayoutNode[] = []
  const edges: { x1: number; y1: number; x2: number; y2: number }[] = []

  function traverse(n: LayoutNode) {
    nodes.push(n)
    for (const c of n.children) {
      edges.push({ x1: n.x, y1: n.y, x2: c.x, y2: c.y })
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
    minX = Math.min(minX, n.x - NODE_RADIUS)
    maxX = Math.max(maxX, n.x + NODE_RADIUS)
    minY = Math.min(minY, n.y - NODE_RADIUS)
    maxY = Math.max(maxY, n.y + NODE_RADIUS)
  }

  minX -= MARGIN_X
  maxX += MARGIN_X
  minY -= MARGIN_Y
  maxY += MARGIN_Y

  const width = Math.max(maxX - minX, 240)
  const height = Math.max(maxY - minY, 160)

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
    <div className={cn('relative flex flex-col rounded-2xl border border-border bg-card/60 backdrop-blur overflow-hidden', className)}>
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-bold text-primary">
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
      <div className="flex-1 w-full min-h-[300px] max-h-[460px] overflow-auto p-4 flex items-center justify-center">
        <svg
          ref={svgRef}
          viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
          className="h-full w-full max-h-[420px] transition-transform duration-150 select-none"
          preserveAspectRatio="xMidYMid meet"
        >
          <style>{`
            .tree-edge { stroke: hsl(var(--border)); stroke-width: 2px; }
            .tree-node-var { fill: hsl(var(--card)); stroke: hsl(var(--primary)); stroke-width: 2px; }
            .tree-node-term { fill: hsl(var(--card)); stroke: #10b981; stroke-width: 2px; }
            .tree-node-eps { fill: hsl(var(--card)); stroke: #f59e0b; stroke-width: 2px; stroke-dasharray: 3 3; }
            .tree-text-var { fill: hsl(var(--foreground)); font-family: monospace; font-weight: bold; font-size: 13px; text-anchor: middle; dominant-baseline: central; }
            .tree-text-term { fill: #10b981; font-family: monospace; font-weight: bold; font-size: 13px; text-anchor: middle; dominant-baseline: central; }
            .tree-text-eps { fill: #f59e0b; font-family: monospace; font-style: italic; font-size: 13px; text-anchor: middle; dominant-baseline: central; }
          `}</style>

          {/* Edges */}
          {edges.map((e, idx) => (
            <line
              key={`edge_${idx}`}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              className="tree-edge"
            />
          ))}

          {/* Nodes */}
          {nodes.map((n) => {
            let circleClass = 'tree-node-var'
            let textClass = 'tree-text-var'

            if (n.isEpsilon) {
              circleClass = 'tree-node-eps'
              textClass = 'tree-text-eps'
            } else if (n.isLeaf) {
              circleClass = 'tree-node-term'
              textClass = 'tree-text-term'
            }

            return (
              <g key={n.id} className="cursor-pointer transition-transform hover:scale-110">
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={17}
                  className={circleClass}
                />
                <text
                  x={n.x}
                  y={n.y}
                  className={textClass}
                >
                  {n.symbol}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Legend Footer */}
      <div className="flex flex-wrap items-center justify-center gap-4 border-t border-border bg-secondary/20 px-4 py-2 font-mono text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-full border-2 border-primary bg-card" />
          <span>Non-Terminal (Variable)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-full border-2 border-emerald-500 bg-card" />
          <span>Terminal Leaf</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-full border-2 border-amber-500 border-dashed bg-card" />
          <span>Empty String (ε)</span>
        </div>
      </div>
    </div>
  )
}

