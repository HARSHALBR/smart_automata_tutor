'use client'

import React, { useMemo, useRef } from 'react'
import { Download, Sparkles, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { FormalTMTransition } from '@/lib/turing'

interface TuringTapeGraphProps {
  tape: string[]
  head: number
  state: string
  blankSymbol: string
  lastTransition?: FormalTMTransition
  instantaneousDescription?: string
  isAccepted?: boolean
  isRejected?: boolean
  isInconclusive?: boolean
  className?: string
}

export function TuringTapeGraph({
  tape,
  head,
  state,
  blankSymbol = '_',
  lastTransition,
  instantaneousDescription,
  isAccepted,
  isRejected,
  isInconclusive,
  className,
}: TuringTapeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Ensure a generous viewing window around head
  const windowRadius = 7
  const displayTape = useMemo(() => {
    const minIdx = Math.min(0, head - 2)
    const maxIdx = Math.max(tape.length - 1, head + 2)
    const startIdx = Math.min(minIdx, head - windowRadius)
    const endIdx = Math.max(maxIdx, head + windowRadius)

    const cells: { index: number; symbol: string; isHead: boolean }[] = []
    for (let i = startIdx; i <= endIdx; i++) {
      const sym = i >= 0 && i < tape.length ? tape[i] : blankSymbol
      cells.push({
        index: i,
        symbol: sym === blankSymbol ? '␣' : sym,
        isHead: i === head,
      })
    }
    return cells
  }, [tape, head, blankSymbol])

  function exportTapeSvg() {
    if (!containerRef.current) return
    const cellWidth = 54
    const cellHeight = 60
    const totalWidth = displayTape.length * cellWidth + 40
    const totalHeight = 160

    const svgCells = displayTape
      .map((c, i) => {
        const x = 20 + i * cellWidth
        const y = 60
        const stroke = c.isHead ? '#3b82f6' : '#94a3b8'
        const fill = c.isHead ? '#eff6ff' : '#ffffff'
        return `
          <g>
            <rect x="${x}" y="${y}" width="${cellWidth - 4}" height="${cellHeight}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="${c.isHead ? 3 : 1.5}" />
            <text x="${x + (cellWidth - 4) / 2}" y="${y + 36}" font-family="monospace" font-size="20" font-weight="bold" fill="#0f172a" text-anchor="middle">${c.symbol}</text>
            <text x="${x + (cellWidth - 4) / 2}" y="${y - 8}" font-family="monospace" font-size="10" fill="#64748b" text-anchor="middle">${c.index}</text>
            ${
              c.isHead
                ? `<polygon points="${x + (cellWidth - 4) / 2},${y - 2} ${x + (cellWidth - 4) / 2 - 6},${y - 12} ${x + (cellWidth - 4) / 2 + 6},${y - 12}" fill="#3b82f6" />`
                : ''
            }
          </g>
        `
      })
      .join('')

    const svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">
        <rect width="100%" height="100%" fill="#f8fafc" rx="12" />
        <text x="20" y="30" font-family="sans-serif" font-size="14" font-weight="600" fill="#1e293b">Turing Machine Tape [State: ${state}]</text>
        ${svgCells}
      </svg>
    `

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `turing-tape-${state}.svg`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative rounded-2xl border border-border/80 bg-gradient-to-b from-card/80 to-muted/20 p-5 shadow-inner backdrop-blur-sm',
        className,
      )}
    >
      {/* Top Banner: State badge & ID */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex items-center gap-2 rounded-xl px-3 py-1.5 font-mono text-xs font-semibold shadow-sm transition-all',
              isAccepted
                ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : isRejected
                ? 'border border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                : isInconclusive
                ? 'border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'border border-primary/40 bg-primary/10 text-primary',
            )}
          >
            <span className="relative flex h-2 w-2">
              <span
                className={cn(
                  'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                  isAccepted
                    ? 'bg-emerald-400'
                    : isRejected
                    ? 'bg-rose-400'
                    : isInconclusive
                    ? 'bg-amber-400'
                    : 'bg-primary',
                )}
              />
              <span
                className={cn(
                  'relative inline-flex h-2 w-2 rounded-full',
                  isAccepted
                    ? 'bg-emerald-500'
                    : isRejected
                    ? 'bg-rose-500'
                    : isInconclusive
                    ? 'bg-amber-500'
                    : 'bg-primary',
                )}
              />
            </span>
            <span>Current State: {state}</span>
          </div>

          {lastTransition && (
            <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/80 px-2.5 py-1 font-mono text-xs text-muted-foreground shadow-xs">
              <Navigation className="size-3 text-primary" />
              <span>
                Applied: ({lastTransition.fromState}, {lastTransition.readSymbol}) → (
                {lastTransition.toState}, {lastTransition.writeSymbol}, {lastTransition.move})
              </span>
            </div>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={exportTapeSvg}
          className="h-8 gap-1.5 rounded-lg border-border/70 text-xs text-muted-foreground hover:text-foreground"
        >
          <Download className="size-3.5" /> Export Tape SVG
        </Button>
      </div>

      {/* Instantaneous Description (ID) */}
      {instantaneousDescription && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 font-mono text-xs">
          <Sparkles className="size-3.5 text-primary" />
          <span className="font-semibold text-primary">Instantaneous Description (ID):</span>
          <span className="font-bold tracking-wider text-foreground">{instantaneousDescription}</span>
        </div>
      )}

      {/* Infinite Tape Reel */}
      <div className="relative overflow-x-auto py-6 scrollbar-thin">
        <div className="flex min-w-max items-center justify-center gap-2 px-6">
          {displayTape.map((cell) => {
            return (
              <div key={cell.index} className="flex flex-col items-center">
                {/* Head Pointer Arrow */}
                <div className="h-6">
                  {cell.isHead && (
                    <div className="flex flex-col items-center animate-bounce">
                      <span className="rounded bg-primary px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary-foreground shadow-xs">
                        HEAD
                      </span>
                      <div className="h-0 w-0 border-x-4 border-t-4 border-x-transparent border-t-primary" />
                    </div>
                  )}
                </div>

                {/* Tape Cell */}
                <div
                  className={cn(
                    'relative flex h-14 w-12 items-center justify-center rounded-xl border-2 font-mono text-lg font-bold transition-all duration-200',
                    cell.isHead
                      ? 'scale-105 border-primary bg-primary/15 text-primary shadow-md shadow-primary/20 ring-2 ring-primary/40'
                      : 'border-border/70 bg-card text-foreground shadow-xs hover:border-primary/40',
                  )}
                >
                  {cell.symbol}
                </div>

                {/* Tape Cell Index */}
                <span className="mt-1 font-mono text-[10px] text-muted-foreground/70">
                  {cell.index}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

