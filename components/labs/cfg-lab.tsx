'use client'

import { useMemo, useState } from 'react'
import { Check, X, CornerDownRight } from 'lucide-react'
import { GRAMMARS, deriveLeftmost, type Grammar, type ParseNode } from '@/lib/cfg'
import { PinchZoom } from '@/components/ui/pinch-zoom'
import { cn } from '@/lib/utils'

/* ---------------------------- parse-tree layout ---------------------------- */

interface Laid {
  symbol: string
  x: number
  y: number
  children: Laid[]
}

function layout(tree: ParseNode): { root: Laid; width: number; depth: number } {
  let leaf = 0
  let maxDepth = 0
  const GAP_X = 46
  const GAP_Y = 64

  function place(node: ParseNode, depth: number): Laid {
    maxDepth = Math.max(maxDepth, depth)
    if (!node.children || node.children.length === 0) {
      const x = leaf * GAP_X + GAP_X / 2
      leaf += 1
      return { symbol: node.symbol, x, y: depth * GAP_Y + 30, children: [] }
    }
    const kids = node.children.map((c) => place(c, depth + 1))
    const x = (kids[0].x + kids[kids.length - 1].x) / 2
    return { symbol: node.symbol, x, y: depth * GAP_Y + 30, children: kids }
  }

  const root = place(tree, 0)
  return { root, width: leaf * GAP_X, depth: maxDepth }
}

function TreeSvg({ tree }: { tree: ParseNode }) {
  const { root, width, depth } = useMemo(() => layout(tree), [tree])
  const height = (depth + 1) * 64 + 30
  const w = Math.max(width, 180)
  const minX = width < 180 ? -(180 - width) / 2 : 0

  const edges: { x1: number; y1: number; x2: number; y2: number }[] = []
  const nodes: Laid[] = []
  function walk(n: Laid) {
    nodes.push(n)
    for (const c of n.children) {
      edges.push({ x1: n.x, y1: n.y, x2: c.x, y2: c.y })
      walk(c)
    }
  }
  walk(root)

  return (
    <PinchZoom className="h-full max-h-[300px] w-full">
    <svg
      viewBox={`${minX} 0 ${w} ${height}`}
      className="h-full max-h-[300px] w-full"
      preserveAspectRatio="xMidYMin meet"
    >
      {edges.map((e, i) => (
        <line
          key={i}
          x1={e.x1}
          y1={e.y1}
          x2={e.x2}
          y2={e.y2}
          stroke="#64748b"
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.8}
        />
      ))}
      {nodes.map((n, i) => {
        const isLeaf = n.children.length === 0
        const isEps = n.symbol === '' || n.symbol === 'ε'
        return (
          <g key={i}>
            <circle
              cx={n.x}
              cy={n.y}
              r={15}
              className={cn(
                isEps
                  ? 'fill-amber-500/15 stroke-amber-500 stroke-dashed'
                  : isLeaf
                  ? 'fill-accent/15 stroke-accent'
                  : 'fill-primary/15 stroke-primary',
              )}
              strokeWidth={1.5}
            />
            <text
              x={n.x}
              y={n.y + 4}
              textAnchor="middle"
              className={cn(
                'font-mono text-xs',
                isEps ? 'fill-amber-500 italic' : isLeaf ? 'fill-accent' : 'fill-primary',
              )}
            >
              {isEps ? 'ε' : n.symbol}
            </text>
          </g>
        )
      })}
    </svg>
    </PinchZoom>
  )
}

/* -------------------------------- main lab --------------------------------- */

export function CfgLab() {
  const [grammarId, setGrammarId] = useState(GRAMMARS[0].id)
  const grammar = useMemo<Grammar>(
    () => GRAMMARS.find((g) => g.id === grammarId) ?? GRAMMARS[0],
    [grammarId],
  )
  const [input, setInput] = useState(grammar.examples[0])

  const result = useMemo(
    () => deriveLeftmost(grammar, input),
    [grammar, input],
  )

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary/40 px-4 py-3">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Grammar
        </span>
        <div className="flex flex-wrap gap-1.5">
          {GRAMMARS.map((g) => (
            <button
              key={g.id}
              onClick={() => {
                setGrammarId(g.id)
                setInput(g.examples[0])
              }}
              className={cn(
                'rounded-lg px-2.5 py-1 font-mono text-xs transition-colors',
                g.id === grammarId
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1fr_1fr]">
        {/* left: rules + input + derivation */}
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:border-b-0 lg:border-r">
          <p className="text-pretty text-sm text-muted-foreground">
            {grammar.description}
          </p>

          {/* rules */}
          <div className="rounded-lg border border-border bg-background/60 p-3">
            {Object.entries(grammar.rules).map(([v, rhss]) => (
              <div key={v} className="font-mono text-sm">
                <span className="text-primary">{v}</span>
                <span className="text-muted-foreground"> → </span>
                <span className="text-foreground">
                  {rhss
                    .map((r) => (r.length ? r.join(' ') : 'ε'))
                    .join('  |  ')}
                </span>
              </div>
            ))}
          </div>

          {/* input */}
          <div>
            <label className="mb-1.5 block font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Test string · examples:{' '}
              {grammar.examples.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setInput(ex)}
                  className="mr-1 rounded bg-muted px-1.5 py-0.5 text-foreground hover:text-primary"
                >
                  {ex}
                </button>
              ))}
            </label>
            <input
              value={input}
              onChange={(e) =>
                setInput(
                  [...e.target.value]
                    .filter((c) => grammar.terminals.includes(c))
                    .join(''),
                )
              }
              placeholder="type a string…"
              spellCheck={false}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-lg tracking-[0.2em] outline-none focus:border-primary"
            />
          </div>

          {/* verdict */}
          <div
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium',
              result
                ? 'border-success/40 bg-success/15 text-success'
                : 'border-destructive/40 bg-destructive/15 text-destructive',
            )}
          >
            {result ? (
              <>
                <Check className="size-4" /> Derivable — {result.steps.length - 1}{' '}
                derivation steps
              </>
            ) : (
              <>
                <X className="size-4" /> Not in the language of this grammar
              </>
            )}
          </div>

          {/* derivation steps */}
          {result && (
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border bg-background/40 p-3">
              {result.steps.map((s, i) => (
                <div
                  key={i}
                  className="flex items-baseline gap-2 font-mono text-xs"
                >
                  <CornerDownRight className="size-3 shrink-0 text-muted-foreground" />
                  <span className="text-foreground">
                    {s.form.length ? s.form.join('') : 'ε'}
                  </span>
                  <span className="text-muted-foreground">· {s.production}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* right: parse tree */}
        <div className="bg-grid flex flex-col p-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Parse tree
          </p>
          {result ? (
            <TreeSvg tree={result.tree} />
          ) : (
            <div className="grid flex-1 place-items-center px-6 text-center">
              <p className="text-sm text-muted-foreground">
                No parse tree — this string cannot be generated by the grammar.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
