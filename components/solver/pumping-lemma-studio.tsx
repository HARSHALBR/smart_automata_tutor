'use client'

import React, { useState, useMemo } from 'react'
import {
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronRight,
  BookOpen,
  ArrowRight,
} from 'lucide-react'
import {
  type NonRegularPattern,
  type StringDecomposition,
  generateNonRegularityProof,
  getAllDecompositions,
  testDecompositionPumping,
  pumpString,
} from '@/lib/pumping-lemma'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PumpingLemmaStudioProps {
  initialPattern?: NonRegularPattern
}

const PRESET_LANGUAGES: { id: NonRegularPattern; name: string; notation: string }[] = [
  { id: 'an_bn', name: '0ⁿ1ⁿ (n ≥ 0)', notation: '{0ⁿ1ⁿ | n ≥ 0}' },
  { id: 'an_bn_cn', name: 'aⁿbⁿcⁿ (n ≥ 0)', notation: '{aⁿbⁿcⁿ | n ≥ 0}' },
  { id: 'palindromes', name: 'Palindromes', notation: '{w | w = wᴿ}' },
  { id: 'ww', name: 'Duplicate Strings (ww)', notation: '{ww | w ∈ {0,1}*}' },
  { id: 'square_length', name: 'Square Length (0ⁿ²)', notation: '{0ⁿ² | n ≥ 0}' },
  { id: 'prime_length', name: 'Prime Length (0ᵖ)', notation: '{0ᵖ | p is prime}' },
  { id: 'an_bm_n_gt_m', name: 'More 0s than 1s', notation: '{0ⁿ1ᵐ | n > m}' },
  { id: 'an_b2n', name: 'aⁿb²ⁿ (n ≥ 0)', notation: '{aⁿb²ⁿ | n ≥ 0}' },
  { id: 'equal_zeros_ones', name: 'Equal 0s and 1s', notation: '{w | N₀(w) = N₁(w)}' },
]

export function PumpingLemmaStudio({ initialPattern = 'an_bn' }: PumpingLemmaStudioProps) {
  const [pattern, setPattern] = useState<NonRegularPattern>(initialPattern)
  const [pumpingLength, setPumpingLength] = useState<number>(4)
  const [selectedDecompIndex, setSelectedDecompIndex] = useState<number>(0)
  const [customI, setCustomI] = useState<number>(0)

  const proof = useMemo(() => {
    return generateNonRegularityProof(pattern)
  }, [pattern])

  // Candidate string based on p
  const candidateString = useMemo(() => {
    const p = pumpingLength
    switch (pattern) {
      case 'an_bn':
        return '0'.repeat(p) + '1'.repeat(p)
      case 'an_bn_cn':
        return 'a'.repeat(p) + 'b'.repeat(p) + 'c'.repeat(p)
      case 'palindromes':
        return '0'.repeat(p) + '1' + '0'.repeat(p)
      case 'ww':
        return '0'.repeat(p) + '1' + '0'.repeat(p) + '1'
      case 'square_length':
        return '0'.repeat(p * p)
      case 'an_bm_n_gt_m':
        return '0'.repeat(p + 1) + '1'.repeat(p)
      case 'an_b2n':
        return 'a'.repeat(p) + 'b'.repeat(2 * p)
      default:
        return '0'.repeat(p) + '1'.repeat(p)
    }
  }, [pattern, pumpingLength])

  // All valid decompositions s = xyz with |xy| <= p and |y| >= 1
  const decompositions = useMemo(() => {
    return getAllDecompositions(candidateString, pumpingLength)
  }, [candidateString, pumpingLength])

  const activeDecomp: StringDecomposition = useMemo(() => {
    return decompositions[selectedDecompIndex] ?? decompositions[0]
  }, [decompositions, selectedDecompIndex])

  // Pump test results for active decomposition
  const pumpTests = useMemo(() => {
    if (!activeDecomp) return []
    return testDecompositionPumping(activeDecomp, proof.isMember, [0, 1, 2, 3, 4])
  }, [activeDecomp, proof])

  const customPumpedString = useMemo(() => {
    if (!activeDecomp) return ''
    return pumpString(activeDecomp, customI)
  }, [activeDecomp, customI])

  const isCustomInLanguage = useMemo(() => {
    return proof.isMember(customPumpedString)
  }, [proof, customPumpedString])

  return (
    <div className="space-y-6">
      {/* Pattern Selector */}
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-primary" />
            <h3 className="font-serif text-lg font-bold text-foreground">
              Non-Regularity Proof Assistant & String Decomposer
            </h3>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            Target Language: <strong>{proof.languageName}</strong>
          </span>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40">
          {PRESET_LANGUAGES.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setPattern(item.id)
                setSelectedDecompIndex(0)
              }}
              className={cn(
                'rounded-lg px-2.5 py-1 font-mono text-xs transition-all',
                pattern === item.id
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-card text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
              )}
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>

      {/* Adversarial Game Breakdown */}
      <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="font-serif text-base font-semibold text-foreground">
            Pumping Lemma Adversarial Game (4 Steps)
          </h4>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
            Game-Theoretic Formulation
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {proof.adversarialGameSteps.map((step) => (
            <div
              key={step.stepNumber}
              className={cn(
                'rounded-xl border p-4 transition-all',
                step.party === 'Opponent'
                  ? 'border-rose-500/30 bg-rose-500/5'
                  : 'border-emerald-500/30 bg-emerald-500/5',
              )}
            >
              <div className="flex items-center justify-between font-mono text-xs mb-2">
                <span className="font-bold text-muted-foreground">Step #{step.stepNumber}</span>
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase',
                    step.party === 'Opponent'
                      ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                      : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
                  )}
                >
                  {step.party}
                </span>
              </div>
              <p className="text-xs font-semibold text-foreground mb-1">{step.action}</p>
              <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
                {step.mathematicalDetails}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive String Pumper & Universal Decompositions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Decompositions List */}
        <div className="space-y-3 rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <h4 className="font-serif text-sm font-semibold text-foreground">
              Candidate Splits ($s = xyz$)
            </h4>
            <div className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
              <span>$p$:</span>
              <input
                type="number"
                min="2"
                max="8"
                value={pumpingLength}
                onChange={(e) => setPumpingLength(Math.max(2, Number(e.target.value)))}
                className="h-6 w-12 rounded border border-border bg-background text-center text-xs text-foreground"
              />
            </div>
          </div>

          <p className="font-mono text-xs text-muted-foreground">
            String $s = {candidateString}$ (|s| = {candidateString.length})
          </p>

          <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
            {decompositions.map((d, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedDecompIndex(idx)}
                className={cn(
                  'w-full flex items-center justify-between rounded-lg px-3 py-2 font-mono text-xs transition-all text-left',
                  selectedDecompIndex === idx
                    ? 'border border-primary/40 bg-primary/10 text-primary font-bold shadow-xs'
                    : 'border border-transparent bg-background/50 hover:bg-secondary/40 text-muted-foreground',
                )}
              >
                <span>
                  x=&quot;{d.x || 'ε'}&quot;, y=&quot;{d.y}&quot;, z=&quot;
                  {d.z.length > 8 ? d.z.slice(0, 6) + '…' : d.z}&quot;
                </span>
                <span className="text-[10px] text-muted-foreground">|xy|={d.x.length + d.y.length}</span>
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5 font-mono text-[11px] text-muted-foreground leading-relaxed">
            Universal constraint: $|xy| \le p$ ({activeDecomp?.x.length + activeDecomp?.y.length} ≤ {pumpingLength}) and $|y| \ge 1$ ({activeDecomp?.y.length} ≥ 1).
          </div>
        </div>

        {/* Live Pump Tester */}
        <div className="space-y-4 rounded-2xl border border-border/80 bg-card p-5 shadow-xs lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="font-serif text-sm font-semibold text-foreground">
              Pump Tester for Decomposition #{selectedDecompIndex + 1}
            </h4>

            {/* Selected Decomposition Visual Badges */}
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <span className="rounded bg-muted/60 px-2 py-0.5">
                x: &quot;<strong>{activeDecomp?.x || 'ε'}</strong>&quot;
              </span>
              <span className="rounded bg-primary/20 px-2 py-0.5 text-primary font-bold">
                y: &quot;<strong>{activeDecomp?.y}</strong>&quot;
              </span>
              <span className="rounded bg-muted/60 px-2 py-0.5">
                z: &quot;<strong>{activeDecomp?.z || 'ε'}</strong>&quot;
              </span>
            </div>
          </div>

          {/* Interactive exponent slider */}
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border/60 bg-background/70 p-3">
            <span className="font-mono text-xs font-semibold text-foreground">
              Choose Exponent $i$:
            </span>
            <div className="flex items-center gap-1.5">
              {[0, 1, 2, 3, 4, 5].map((val) => (
                <button
                  key={val}
                  onClick={() => setCustomI(val)}
                  className={cn(
                    'h-7 w-8 rounded-lg font-mono text-xs font-bold transition-all',
                    customI === val
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted/40 text-muted-foreground hover:bg-secondary/60',
                  )}
                >
                  {val}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2 font-mono text-xs">
              <span>Pumped $xy^{customI}z$:</span>
              <span className="rounded-lg bg-card px-2.5 py-1 font-bold text-foreground border border-border">
                &quot;{customPumpedString === '' ? 'ε' : customPumpedString}&quot;
              </span>
              {isCustomInLanguage ? (
                <span className="flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-500">
                  <CheckCircle2 className="size-3" /> ∈ L
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded bg-rose-500/20 px-2 py-0.5 font-bold text-rose-500">
                  <XCircle className="size-3" /> ∉ L (VIOLATION)
                </span>
              )}
            </div>
          </div>

          {/* Test battery results table */}
          <div className="space-y-2">
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Standard Evaluation Across Exponents ($i = 0, 1, 2, 3$)
            </span>
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-muted/40 text-muted-foreground border-b border-border/60">
                  <tr>
                    <th className="p-2.5">Exponent ($i$)</th>
                    <th className="p-2.5">Pumped String ($x y^i z$)</th>
                    <th className="p-2.5">Length</th>
                    <th className="p-2.5">Membership</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {pumpTests.map((t) => (
                    <tr key={t.i} className="hover:bg-secondary/20">
                      <td className="p-2.5 font-bold text-foreground">i = {t.i}</td>
                      <td className="p-2.5 font-semibold text-primary truncate max-w-xs">
                        &quot;{t.pumpedString}&quot;
                      </td>
                      <td className="p-2.5 text-muted-foreground">
                        {t.pumpedString === 'ε' ? 0 : t.pumpedString.length}
                      </td>
                      <td className="p-2.5">
                        {t.inLanguage ? (
                          <span className="text-emerald-500 font-bold">∈ L</span>
                        ) : (
                          <span className="text-rose-500 font-bold">∉ L (Contradiction)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Complete Formal Proof Card */}
      <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="size-5 text-primary" />
          <h4 className="font-serif text-lg font-bold text-foreground">
            Formal Mathematical Contradiction Proof
          </h4>
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/20 p-5 font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap">
          {proof.fullFormalProofMarkdown}
        </div>
      </div>
    </div>
  )
}

