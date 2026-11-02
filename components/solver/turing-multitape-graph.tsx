'use client'

import React from 'react'
import { Layers, Navigation } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MultiTapeTMTransition } from '@/lib/turing-multitape'

interface TuringMultiTapeGraphProps {
  tapes: string[][]
  heads: number[]
  state: string
  blankSymbol: string
  lastTransition?: MultiTapeTMTransition
  isAccepted?: boolean
  isRejected?: boolean
  isInconclusive?: boolean
  className?: string
}

export function TuringMultiTapeGraph({
  tapes,
  heads,
  state,
  blankSymbol = '_',
  lastTransition,
  isAccepted,
  isRejected,
  isInconclusive,
  className,
}: TuringMultiTapeGraphProps) {
  const windowRadius = 5

  return (
    <div
      className={cn(
        'relative rounded-2xl border border-border/80 bg-gradient-to-b from-card/90 to-muted/20 p-5 shadow-inner backdrop-blur-sm',
        className,
      )}
    >
      {/* Top Banner */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex items-center gap-2 rounded-xl px-3 py-1.5 font-mono text-xs font-semibold shadow-sm',
              isAccepted
                ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : isRejected
                ? 'border border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                : isInconclusive
                ? 'border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'border border-primary/40 bg-primary/10 text-primary',
            )}
          >
            <Layers className="size-3.5" />
            <span>Multi-Tape State: {state}</span>
          </div>

          {lastTransition && (
            <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/80 px-2.5 py-1 font-mono text-xs text-muted-foreground shadow-xs">
              <Navigation className="size-3 text-primary" />
              <span>
                Applied: ({lastTransition.fromState}, [{lastTransition.readSymbols.join(', ')}]) → (
                {lastTransition.toState}, [{lastTransition.writeSymbols.join(', ')}], [
                {lastTransition.moves.join(', ')}])
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Synchronized Parallel Tapes */}
      <div className="space-y-6">
        {tapes.map((tape, tapeIdx) => {
          const head = heads[tapeIdx] ?? 0
          const minIdx = Math.min(0, head - 1)
          const maxIdx = Math.max(tape.length - 1, head + 1)
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

          return (
            <div
              key={tapeIdx}
              className="rounded-xl border border-border/50 bg-background/50 p-3 shadow-xs"
            >
              <div className="mb-2 flex items-center justify-between font-mono text-xs text-muted-foreground">
                <span className="font-semibold text-primary">Tape #{tapeIdx + 1}</span>
                <span>Head Position: {head}</span>
              </div>

              <div className="overflow-x-auto py-2 scrollbar-thin">
                <div className="flex min-w-max items-center justify-center gap-2 px-4">
                  {cells.map((cell) => (
                    <div key={cell.index} className="flex flex-col items-center">
                      <div className="h-4">
                        {cell.isHead && (
                          <div className="h-0 w-0 border-x-4 border-t-4 border-x-transparent border-t-primary" />
                        )}
                      </div>

                      <div
                        className={cn(
                          'flex h-11 w-10 items-center justify-center rounded-lg border font-mono text-base font-bold transition-all',
                          cell.isHead
                            ? 'border-primary bg-primary/20 text-primary shadow-xs ring-2 ring-primary/40'
                            : 'border-border/60 bg-card text-foreground',
                        )}
                      >
                        {cell.symbol}
                      </div>

                      <span className="mt-0.5 font-mono text-[9px] text-muted-foreground/60">
                        {cell.index}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

