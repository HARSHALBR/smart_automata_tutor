'use client'

import React, { useState, useMemo } from 'react'
import {
  Layers,
  Search,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  BookOpen,
  ArrowRight,
  GitBranch,
} from 'lucide-react'
import {
  type DistinguishingSuffixResult,
  type MyhillNerodeAnalysis,
  findDistinguishingSuffix,
  getStandardMyhillNerodeAnalysis,
} from '@/lib/myhill-nerode'
import { NON_REGULAR_MEMBERSHIP_PREDICATES } from '@/lib/pumping-lemma'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function MyhillNerodeStudio() {
  const [selectedLanguage, setSelectedLanguage] = useState<'ends_with_01' | 'an_bn' | 'palindromes'>('ends_with_01')
  const [stringX, setStringX] = useState<string>('0')
  const [stringY, setStringY] = useState<string>('01')
  const [searchResult, setSearchResult] = useState<DistinguishingSuffixResult | null>(null)

  const analysis: MyhillNerodeAnalysis = useMemo(() => {
    return getStandardMyhillNerodeAnalysis(selectedLanguage)
  }, [selectedLanguage])

  // Language predicate
  const isMember = useMemo(() => {
    if (selectedLanguage === 'ends_with_01') {
      return (str: string) => str.endsWith('01')
    }
    return NON_REGULAR_MEMBERSHIP_PREDICATES[selectedLanguage] || ((str: string) => false)
  }, [selectedLanguage])

  function handleFindSuffix() {
    const res = findDistinguishingSuffix(stringX, stringY, ['0', '1'], isMember, 7)
    setSearchResult(res)
  }

  return (
    <div className="space-y-6">
      {/* Language Selector Header */}
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Layers className="size-5 text-primary" />
            <h3 className="font-serif text-lg font-bold text-foreground">
              Myhill–Nerode Theorem & Equivalence Class Engine
            </h3>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs">
            <span>Index:</span>
            <span
              className={cn(
                'rounded px-2 py-0.5 font-bold uppercase',
                analysis.isRegular
                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/20 text-rose-600 dark:text-rose-400',
              )}
            >
              {analysis.indexType} ({analysis.numberOfClasses} classes)
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40">
          <button
            onClick={() => {
              setSelectedLanguage('ends_with_01')
              setStringX('0')
              setStringY('01')
              setSearchResult(null)
            }}
            className={cn(
              'rounded-lg px-2.5 py-1 font-mono text-xs transition-all',
              selectedLanguage === 'ends_with_01'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-card text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
            )}
          >
            Regular: Ends with 01
          </button>
          <button
            onClick={() => {
              setSelectedLanguage('an_bn')
              setStringX('00')
              setStringY('000')
              setSearchResult(null)
            }}
            className={cn(
              'rounded-lg px-2.5 py-1 font-mono text-xs transition-all',
              selectedLanguage === 'an_bn'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-card text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
            )}
          >
            Non-Regular: 0ⁿ1ⁿ (Infinite Index)
          </button>
          <button
            onClick={() => {
              setSelectedLanguage('palindromes')
              setStringX('01')
              setStringY('001')
              setSearchResult(null)
            }}
            className={cn(
              'rounded-lg px-2.5 py-1 font-mono text-xs transition-all',
              selectedLanguage === 'palindromes'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-card text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
            )}
          >
            Non-Regular: Palindromes
          </button>
        </div>
      </div>

      {/* Interactive Distinguishing Suffix Generator */}
      <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-serif text-sm font-semibold text-foreground">
            Distinguishing Suffix Discovery Tool ($x \\not\\sim_L y$)
          </h4>
          <span className="font-mono text-xs text-muted-foreground">
            Find $z$ such that $(xz \in L) \neq (yz \in L)$
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border/60 bg-background/50 p-4">
          <div className="flex items-center gap-2">
            <label className="font-mono text-xs font-bold text-foreground">String x:</label>
            <input
              type="text"
              value={stringX}
              onChange={(e) => setStringX(e.target.value)}
              placeholder="ε"
              className="h-8 w-28 rounded-lg border border-border bg-card px-2.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="font-mono text-xs font-bold text-foreground">String y:</label>
            <input
              type="text"
              value={stringY}
              onChange={(e) => setStringY(e.target.value)}
              placeholder="ε"
              className="h-8 w-28 rounded-lg border border-border bg-card px-2.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <Button
            size="sm"
            onClick={handleFindSuffix}
            className="h-8 gap-1.5 rounded-lg text-xs"
          >
            <Search className="size-3.5" /> Find Distinguishing Suffix
          </Button>
        </div>

        {/* Search Result Display */}
        {searchResult && (
          <div
            className={cn(
              'rounded-xl border p-4 space-y-2',
              searchResult.isDistinguishable
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-amber-500/30 bg-amber-500/5',
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-foreground">
                Distinguishing Suffix:
              </span>
              <span
                className={cn(
                  'rounded px-2 py-0.5 font-mono text-xs font-bold',
                  searchResult.isDistinguishable
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
                )}
              >
                {searchResult.isDistinguishable ? `z = "${searchResult.distinguishingSuffix}"` : 'Indistinguishable in search bound'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 font-mono text-xs">
              <div className="rounded-lg bg-card p-2.5 border border-border/60">
                <div className="text-muted-foreground mb-1">x · z = &quot;{searchResult.xConcatenated}&quot;</div>
                <div className="font-bold flex items-center gap-1.5">
                  {searchResult.xInLanguage ? (
                    <span className="text-emerald-500 flex items-center gap-1">
                      <CheckCircle2 className="size-3.5" /> Belongs to Language (∈ L)
                    </span>
                  ) : (
                    <span className="text-rose-500 flex items-center gap-1">
                      <XCircle className="size-3.5" /> Not in Language (∉ L)
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-lg bg-card p-2.5 border border-border/60">
                <div className="text-muted-foreground mb-1">y · z = &quot;{searchResult.yConcatenated}&quot;</div>
                <div className="font-bold flex items-center gap-1.5">
                  {searchResult.yInLanguage ? (
                    <span className="text-emerald-500 flex items-center gap-1">
                      <CheckCircle2 className="size-3.5" /> Belongs to Language (∈ L)
                    </span>
                  ) : (
                    <span className="text-rose-500 flex items-center gap-1">
                      <XCircle className="size-3.5" /> Not in Language (∉ L)
                    </span>
                  )}
                </div>
              </div>
            </div>

            <p className="font-mono text-xs text-muted-foreground pt-1">{searchResult.explanation}</p>
          </div>
        )}
      </div>

      {/* Equivalence Classes View (Finite or Infinite) */}
      <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-serif text-sm font-semibold text-foreground">
            {analysis.isRegular
              ? `Finite Equivalence Classes (${analysis.numberOfClasses} Classes = ${analysis.minimumDfaStateCount} Minimal DFA States)`
              : `Infinite Pairwise Distinguishable Family`}
          </h4>
        </div>

        {analysis.isRegular && analysis.equivalenceClasses && (
          <div className="overflow-x-auto rounded-xl border border-border/60 scrollbar-thin">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-muted/40 text-muted-foreground border-b border-border/60">
                <tr>
                  <th className="p-3">Equivalence Class [x]</th>
                  <th className="p-3">Representative String</th>
                  <th className="p-3">Sample Strings</th>
                  <th className="p-3">Transitions (on 0, 1)</th>
                  <th className="p-3">Accepting</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {analysis.equivalenceClasses.map((c) => (
                  <tr key={c.id} className="hover:bg-secondary/20">
                    <td className="p-3 font-bold text-primary">[{c.representative}]</td>
                    <td className="p-3 font-semibold text-foreground">&quot;{c.representative}&quot;</td>
                    <td className="p-3 text-muted-foreground">{c.sampleStrings.join(', ')}</td>
                    <td className="p-3 text-muted-foreground">
                      0 → [{analysis.equivalenceClasses?.find((k) => k.id === c.transitionsOnSymbol['0'])?.representative || '-'}],
                      1 → [{analysis.equivalenceClasses?.find((k) => k.id === c.transitionsOnSymbol['1'])?.representative || '-'}]
                    </td>
                    <td className="p-3">
                      {c.isAccepting ? (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-500">
                          YES (Accept)
                        </span>
                      ) : (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          NO (Reject)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!analysis.isRegular && analysis.infiniteFamily && (
          <div className="space-y-3 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
            <div className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
              Infinite Distinguishable Family: {analysis.infiniteFamily.familyFormula}
            </div>
            <div className="font-mono text-xs text-muted-foreground">
              Sample elements: {analysis.infiniteFamily.sampleStrings.join(', ')}
            </div>
            <div className="font-mono text-xs text-foreground bg-card p-3 rounded-lg border border-border/60">
              {analysis.infiniteFamily.distinguishingSuffixRule}
            </div>
            <p className="font-mono text-xs text-muted-foreground">
              By the Myhill–Nerode Theorem, because an infinite set of pairwise distinguishable strings exists, $\sim_L$ has infinitely many equivalence classes, proving non-regularity.
            </p>
          </div>
        )}

        {/* Bridge to DFA Minimization */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-1 font-mono text-xs text-muted-foreground leading-relaxed">
          <div className="font-bold text-primary flex items-center gap-1.5">
            <GitBranch className="size-3.5" /> Connection to DFA State Minimization:
          </div>
          <p>{analysis.connectionToDfaMinimization}</p>
        </div>
      </div>

      {/* Formal Proof Card */}
      <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="size-5 text-primary" />
          <h4 className="font-serif text-lg font-bold text-foreground">
            Complete Mathematical Proof via Myhill–Nerode Theorem
          </h4>
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/20 p-5 font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap">
          {analysis.formalProofMarkdown}
        </div>
      </div>
    </div>
  )
}

