'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  Sparkles,
  GitBranch,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Copy,
  AlertTriangle,
  ArrowRight,
  Layers,
  Table,
  Cpu,
  FileCode,
  BookOpen,
  Info,
  ChevronRight,
  Split,
  Binary,
} from 'lucide-react'
import {
  type Grammar,
  type ParseNode,
  type DerivationStep,
  parseCfgFromText,
  formatCfgToText,
  formatCfgFormalTuple,
  deriveLeftmost,
  deriveRightmost,
  GRAMMARS,
} from '@/lib/cfg'
import {
  simplifyCfg,
  convertToCnf,
  type CfgSimplificationResult,
  type CnfConversionResult,
} from '@/lib/cfg-transformations'
import { runCykDetailed, type CykDetailedResult } from '@/lib/cyk'
import { analyzeAmbiguity, type AmbiguityAnalysisResult } from '@/lib/cfg-ambiguity'
import { ParseTreeVisualizer } from './parse-tree-visualizer'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function CfgSolverUI({ initialGrammarText }: { initialGrammarText?: string }) {
  // Preset or live grammar
  const [selectedPresetId, setSelectedPresetId] = useState<string>(GRAMMARS[0].id || 'anbn')
  const [grammarText, setGrammarText] = useState<string>(
    initialGrammarText || formatCfgToText(GRAMMARS[0]),
  )
  const [activeTab, setActiveTab] = useState<'editor' | 'derivation' | 'cnf' | 'cyk' | 'ambiguity'>(
    'derivation',
  )

  // Parse live grammar
  const parseResult = useMemo(() => parseCfgFromText(grammarText), [grammarText])
  const currentGrammar: Grammar = useMemo(() => {
    if (parseResult.success && parseResult.grammar) {
      return parseResult.grammar
    }
    return GRAMMARS[0]
  }, [parseResult])

  // Derivation state
  const [targetString, setTargetString] = useState<string>('0011')
  const [derivationMode, setDerivationMode] = useState<'leftmost' | 'rightmost'>('leftmost')
  const [derivationStepIdx, setDerivationStepIdx] = useState<number>(0)
  const [copiedText, setCopiedText] = useState<string | null>(null)

  // Compute derivations
  const leftmostResult = useMemo(
    () => (currentGrammar ? deriveLeftmost(currentGrammar, targetString) : null),
    [currentGrammar, targetString],
  )
  const rightmostResult = useMemo(
    () => (currentGrammar ? deriveRightmost(currentGrammar, targetString) : null),
    [currentGrammar, targetString],
  )

  const activeDerivation = derivationMode === 'leftmost' ? leftmostResult : rightmostResult
  const activeSteps = activeDerivation?.steps || []

  // Clamp step index
  useEffect(() => {
    if (activeSteps.length > 0) {
      setDerivationStepIdx(activeSteps.length - 1)
    } else {
      setDerivationStepIdx(0)
    }
  }, [activeSteps.length, derivationMode, targetString])

  // CNF Pipeline state
  const [cnfStageIndex, setCnfStageIndex] = useState<number>(0)
  const cnfResult: CnfConversionResult = useMemo(
    () => convertToCnf(currentGrammar),
    [currentGrammar],
  )

  // Simplification result
  const simplificationResult: CfgSimplificationResult = useMemo(
    () => simplifyCfg(currentGrammar),
    [currentGrammar],
  )

  // CYK state
  const [cykInput, setCykInput] = useState<string>('0011')
  const [selectedCellCoords, setSelectedCellCoords] = useState<{ span: number; i: number } | null>(
    null,
  )
  const cykResult: CykDetailedResult = useMemo(
    () => runCykDetailed(currentGrammar, cykInput),
    [currentGrammar, cykInput],
  )

  // Ambiguity state
  const [ambiguityInput, setAmbiguityInput] = useState<string>('')
  const [ambiguityResult, setAmbiguityResult] = useState<AmbiguityAnalysisResult | null>(null)

  function runAmbiguityCheck(customStr?: string) {
    const res = analyzeAmbiguity(currentGrammar, customStr !== undefined ? customStr : ambiguityInput || undefined)
    setAmbiguityResult(res)
  }

  function handleSelectPreset(id: string) {
    setSelectedPresetId(id)
    const preset = GRAMMARS.find((g) => g.id === id)
    if (preset) {
      const text = formatCfgToText(preset)
      setGrammarText(text)
      const firstEg = preset.examples[0] || '01'
      setTargetString(firstEg)
      setCykInput(firstEg)
      setAmbiguityInput('')
      setAmbiguityResult(null)
    }
  }

  function handleCopy(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopiedText(label)
    setTimeout(() => setCopiedText(null), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Preset Selector */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card/70 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
              <GitBranch className="size-4" />
            </span>
            <h2 className="font-mono text-base font-bold text-foreground">
              Context-Free Grammar (CFG) Engine
            </h2>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              G = (V, Σ, P, S)
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Formal grammar editor, step-by-step LM/RM derivations, interactive parse trees, CYK parsing, and CNF normalization.
          </p>
        </div>

        {/* Preset Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">Presets:</span>
          <div className="flex flex-wrap gap-1.5">
            {GRAMMARS.map((g) => (
              <button
                key={g.id}
                onClick={() => handleSelectPreset(g.id || '')}
                className={cn(
                  'rounded-lg border px-2.5 py-1 font-mono text-xs transition-colors',
                  selectedPresetId === g.id
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {[
          { id: 'derivation', label: 'Derivations & Parse Tree', icon: GitBranch },
          { id: 'editor', label: 'Grammar Editor & Spec', icon: FileCode },
          { id: 'cnf', label: 'Simplification & CNF', icon: Split },
          { id: 'cyk', label: 'CYK Triangular Parsing', icon: Table },
          { id: 'ambiguity', label: 'Ambiguity Analysis', icon: Binary },
        ].map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 font-mono text-xs font-semibold transition-all',
                isActive
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              <Icon className="size-4" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* TAB 1: DERIVATION & PARSE TREE */}
      {activeTab === 'derivation' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Derivation Controls & Step-by-Step Viewer */}
          <div className="space-y-4 lg:col-span-5">
            <div className="rounded-2xl border border-border bg-card/60 p-4 shadow-sm space-y-4">
              {/* String Input */}
              <div>
                <label className="block font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Target String (w ∈ Σ*)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={targetString}
                    onChange={(e) => setTargetString(e.target.value)}
                    placeholder="e.g. 0011 or ε"
                    className="flex-1 rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none"
                  />
                  <button
                    onClick={() => setTargetString('')}
                    className="rounded-xl border border-border bg-secondary/50 px-3 py-2 font-mono text-xs font-medium text-foreground hover:bg-secondary"
                  >
                    ε
                  </button>
                </div>
                {/* Quick Examples */}
                {currentGrammar.examples.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[11px] text-muted-foreground">Examples:</span>
                    {currentGrammar.examples.map((ex, i) => (
                      <button
                        key={i}
                        onClick={() => setTargetString(ex)}
                        className="rounded-md border border-border/70 bg-secondary/40 px-2 py-0.5 font-mono text-[11px] text-foreground hover:bg-secondary"
                      >
                        {ex === '' ? 'ε' : ex}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Derivation Direction Toggle */}
              <div>
                <label className="block font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Derivation Strategy
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setDerivationMode('leftmost')}
                    className={cn(
                      'rounded-xl border py-2 text-center font-mono text-xs font-semibold transition-all',
                      derivationMode === 'leftmost'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:bg-secondary',
                    )}
                  >
                    Leftmost (⇒_lm)
                  </button>
                  <button
                    onClick={() => setDerivationMode('rightmost')}
                    className={cn(
                      'rounded-xl border py-2 text-center font-mono text-xs font-semibold transition-all',
                      derivationMode === 'rightmost'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:bg-secondary',
                    )}
                  >
                    Rightmost (⇒_rm)
                  </button>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="font-mono text-xs text-muted-foreground">Status:</span>
                {activeDerivation ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-3.5" /> Derived in {activeSteps.length - 1} steps
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                    <XCircle className="size-3.5" /> String Cannot Be Derived
                  </span>
                )}
              </div>
            </div>

            {/* Step-by-Step Derivation Progress */}
            {activeDerivation && activeSteps.length > 0 && (
              <div className="rounded-2xl border border-border bg-card/60 p-4 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Step {derivationStepIdx + 1} of {activeSteps.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={derivationStepIdx === 0}
                      onClick={() => setDerivationStepIdx((s) => Math.max(0, s - 1))}
                      className="rounded-lg border border-border bg-card px-2.5 py-1 font-mono text-xs font-semibold text-foreground disabled:opacity-40 hover:bg-secondary"
                    >
                      Prev
                    </button>
                    <button
                      disabled={derivationStepIdx >= activeSteps.length - 1}
                      onClick={() => setDerivationStepIdx((s) => Math.min(activeSteps.length - 1, s + 1))}
                      className="rounded-lg border border-border bg-card px-2.5 py-1 font-mono text-xs font-semibold text-foreground disabled:opacity-40 hover:bg-secondary"
                    >
                      Next
                    </button>
                  </div>
                </div>

                {/* Slider */}
                <input
                  type="range"
                  min={0}
                  max={activeSteps.length - 1}
                  value={derivationStepIdx}
                  onChange={(e) => setDerivationStepIdx(parseInt(e.target.value, 10))}
                  className="w-full accent-primary"
                />

                {/* Current Sentential Form */}
                <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                    <span>Sentential Form:</span>
                    <span className="font-bold text-primary">
                      {activeSteps[derivationStepIdx]?.production}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-base font-bold text-foreground">
                    {activeSteps[derivationStepIdx]?.form.length === 0 ? (
                      <span className="text-amber-500 italic">ε</span>
                    ) : (
                      activeSteps[derivationStepIdx]?.form.map((sym, sIdx) => {
                        const isVar = currentGrammar.variables.includes(sym)
                        return (
                          <span
                            key={sIdx}
                            className={cn(
                              'rounded-lg px-2 py-0.5',
                              isVar
                                ? 'bg-primary/15 text-primary border border-primary/30'
                                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30',
                            )}
                          >
                            {sym}
                          </span>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Full Derivation Sequence Box */}
                <div className="rounded-xl border border-border bg-background/50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs text-muted-foreground font-semibold">
                      Full Derivation Chain:
                    </span>
                    <button
                      onClick={() =>
                        handleCopy(
                          activeSteps
                            .map((s) => (s.form.length === 0 ? 'ε' : s.form.join(' ')))
                            .join(' ⇒ '),
                          'chain',
                        )
                      }
                      className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="size-3" />
                      {copiedText === 'chain' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="overflow-x-auto font-mono text-xs text-foreground py-1">
                    {activeSteps.map((s, i) => (
                      <span key={i}>
                        <span className={cn(i === derivationStepIdx ? 'font-bold text-primary underline' : '')}>
                          {s.form.length === 0 ? 'ε' : s.form.join(' ')}
                        </span>
                        {i < activeSteps.length - 1 && (
                          <span className="text-muted-foreground mx-1.5">
                            {derivationMode === 'leftmost' ? '⇒_lm' : '⇒_rm'}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Interactive Parse Tree Visualizer */}
          <div className="lg:col-span-7">
            {activeDerivation?.tree ? (
              <ParseTreeVisualizer
                tree={activeDerivation.tree}
                title={`Parse Tree for "${targetString === '' ? 'ε' : targetString}"`}
              />
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
                <AlertTriangle className="size-8 text-amber-500 mb-2" />
                <h3 className="font-mono text-sm font-semibold text-foreground">
                  No Parse Tree Available
                </h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                  The target string &quot;{targetString}&quot; is not accepted by the current grammar, or the grammar is incomplete.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: GRAMMAR EDITOR & FORMAL SPEC */}
      {activeTab === 'editor' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Editor Input Area */}
          <div className="space-y-4 lg:col-span-6">
            <div className="rounded-2xl border border-border bg-card/60 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Production Rules (BNF)
                </label>
                <button
                  onClick={() => handleCopy(grammarText, 'rules')}
                  className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                >
                  <Copy className="size-3" />
                  {copiedText === 'rules' ? 'Copied' : 'Copy'}
                </button>
              </div>

              <textarea
                rows={9}
                value={grammarText}
                onChange={(e) => setGrammarText(e.target.value)}
                placeholder="S -> a S b | ε"
                className="w-full rounded-xl border border-border bg-background p-3 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
              />

              {/* Validation Status */}
              {parseResult.success ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <CheckCircle2 className="size-4" /> Grammar Formally Valid
                  </div>
                  <p className="font-mono text-[11px]">
                    Variables V: {currentGrammar.variables.join(', ')} | Terminals Σ:{' '}
                    {currentGrammar.terminals.join(', ') || '∅'} | Start: {currentGrammar.start}
                  </p>
                  {parseResult.warnings.length > 0 && (
                    <ul className="mt-2 list-disc pl-4 space-y-0.5 text-amber-600 dark:text-amber-400 font-mono text-[11px]">
                      {parseResult.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <XCircle className="size-4" /> Syntax / Validation Error
                  </div>
                  <p className="font-mono text-[11px]">{parseResult.error}</p>
                </div>
              )}
            </div>
          </div>

          {/* Formal 4-Tuple Display */}
          <div className="space-y-4 lg:col-span-6">
            <div className="rounded-2xl border border-border bg-card/60 p-4 shadow-sm space-y-3">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Mathematical 4-Tuple G = (V, Σ, P, S)
              </span>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-2.5">
                  <span className="text-muted-foreground">Variables (V):</span>
                  <span className="font-bold text-primary">
                    &#123; {currentGrammar.variables.join(', ')} &#125;
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-2.5">
                  <span className="text-muted-foreground">Terminals (Σ):</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    &#123; {currentGrammar.terminals.join(', ') || '∅'} &#125;
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-2.5">
                  <span className="text-muted-foreground">Start Symbol (S):</span>
                  <span className="font-bold text-foreground">{currentGrammar.start}</span>
                </div>
              </div>

              {/* Rules Table */}
              <div className="rounded-xl border border-border bg-background/50 p-3">
                <span className="block font-mono text-xs font-semibold text-muted-foreground mb-2">
                  Production Set (P):
                </span>
                <div className="space-y-1 font-mono text-xs">
                  {Object.entries(currentGrammar.rules).map(([lhs, rhss]) => (
                    <div key={lhs} className="flex items-start gap-2">
                      <span className="font-bold text-primary min-w-8">{lhs}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-foreground">
                        {rhss.map((rhs) => (rhs.length === 0 ? 'ε' : rhs.join(' '))).join(' | ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SIMPLIFICATION & CNF CONVERSION */}
      {activeTab === 'cnf' && (
        <div className="space-y-6">
          {/* Header Overview */}
          <div className="rounded-2xl border border-border bg-card/60 p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-mono text-sm font-bold text-foreground">
                Chomsky Normal Form (CNF) 7-Stage Normalization Pipeline
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Every rule is converted to A → B C, A → a, or S0 → ε (if ε ∈ L(G)).
              </p>
            </div>
            <button
              onClick={() => handleCopy(formatCfgToText(cnfResult.finalCnfGrammar), 'cnf')}
              className="inline-flex items-center gap-1 rounded-xl border border-border bg-secondary/50 px-3 py-1.5 font-mono text-xs font-medium text-foreground hover:bg-secondary"
            >
              <Copy className="size-3.5" />
              <span>{copiedText === 'cnf' ? 'Copied CNF' : 'Copy Final CNF'}</span>
            </button>
          </div>

          {/* Stepper Buttons */}
          <div className="flex flex-wrap gap-2">
            {cnfResult.steps.map((st, i) => (
              <button
                key={i}
                onClick={() => setCnfStageIndex(i)}
                className={cn(
                  'rounded-xl border px-3 py-1.5 font-mono text-xs font-semibold transition-all',
                  cnfStageIndex === i
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                {st.title.split(':')[0]}
              </button>
            ))}
          </div>

          {/* Selected Stage Detail Card */}
          {cnfResult.steps[cnfStageIndex] && (
            <div className="rounded-2xl border border-border bg-card/60 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="font-mono text-sm font-bold text-foreground">
                  {cnfResult.steps[cnfStageIndex].title}
                </span>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-primary">
                  Stage {cnfStageIndex + 1} of {cnfResult.steps.length}
                </span>
              </div>

              <p className="text-xs text-foreground font-mono leading-relaxed">
                {cnfResult.steps[cnfStageIndex].description}
              </p>

              {/* Key Details List */}
              {cnfResult.steps[cnfStageIndex].details.length > 0 && (
                <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-1">
                  <span className="block font-mono text-[11px] font-bold text-muted-foreground uppercase">
                    Stage Observations & Actions:
                  </span>
                  <ul className="list-disc pl-5 font-mono text-xs text-muted-foreground space-y-0.5">
                    {cnfResult.steps[cnfStageIndex].details.map((d, dIdx) => (
                      <li key={dIdx}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Side-by-Side Before and After */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
                <div className="rounded-xl border border-border bg-background/50 p-3 space-y-2">
                  <span className="block font-mono text-xs font-bold text-muted-foreground">
                    Grammar Before:
                  </span>
                  <pre className="font-mono text-xs text-foreground whitespace-pre-wrap">
                    {formatCfgToText(cnfResult.steps[cnfStageIndex].grammarBefore)}
                  </pre>
                </div>
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
                  <span className="block font-mono text-xs font-bold text-primary">
                    Grammar After:
                  </span>
                  <pre className="font-mono text-xs text-foreground whitespace-pre-wrap font-semibold">
                    {formatCfgToText(cnfResult.steps[cnfStageIndex].grammarAfter)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CYK TRIANGULAR PARSING */}
      {activeTab === 'cyk' && (
        <div className="space-y-6">
          {/* Top CYK Controls */}
          <div className="rounded-2xl border border-border bg-card/60 p-4 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-mono text-sm font-bold text-foreground">
                  Cocke–Younger–Kasami (CYK) Dynamic Programming Table
                </h3>
                <p className="text-xs text-muted-foreground">
                  O(n³ · |P|) membership verification. Click any cell to inspect its derivation witnesses.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {cykResult.accepted ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-4" /> String ACCEPTED
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-3 py-1 font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                    <XCircle className="size-4" /> String REJECTED
                  </span>
                )}
              </div>
            </div>

            {/* CYK Input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={cykInput}
                onChange={(e) => setCykInput(e.target.value)}
                placeholder="Enter string to parse (e.g. 0011)"
                className="flex-1 rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none"
              />
              <button
                onClick={() => setCykInput('')}
                className="rounded-xl border border-border bg-secondary/50 px-3 py-2 font-mono text-xs font-medium text-foreground hover:bg-secondary"
              >
                ε
              </button>
            </div>
          </div>

          {/* Triangular CYK Matrix Table */}
          {cykResult.matrix.length > 0 ? (
            <div className="rounded-2xl border border-border bg-card/60 p-5 shadow-sm space-y-4 overflow-x-auto">
              <div className="min-w-[400px] flex flex-col items-center gap-2">
                {/* Render rows from span = n down to span = 1 */}
                {Array.from({ length: cykResult.tokens.length }, (_, rIdx) => {
                  const span = cykResult.tokens.length - rIdx
                  const cellsInRow = cykResult.matrix[span - 1]

                  return (
                    <div key={span} className="flex items-center gap-2">
                      <span className="w-16 font-mono text-xs text-right text-muted-foreground font-semibold">
                        span {span}:
                      </span>
                      <div className="flex items-center gap-2">
                        {cellsInRow.map((cell) => {
                          const isSelected =
                            selectedCellCoords?.span === cell.span &&
                            selectedCellCoords?.i === cell.i
                          const isTop = cell.span === cykResult.tokens.length
                          const hasVars = cell.variables.length > 0

                          return (
                            <button
                              key={`${cell.span}_${cell.i}`}
                              onClick={() => setSelectedCellCoords({ span: cell.span, i: cell.i })}
                              className={cn(
                                'min-w-20 min-h-12 rounded-xl border p-2 text-center font-mono text-xs transition-all flex flex-col items-center justify-center',
                                isSelected
                                  ? 'border-primary bg-primary/20 shadow-md ring-2 ring-primary'
                                  : isTop
                                  ? hasVars && cell.variables.includes(cykResult.cnfGrammar.start)
                                    ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                    : 'border-border bg-card/80 text-foreground'
                                  : hasVars
                                  ? 'border-border bg-card/90 text-foreground hover:border-primary/50'
                                  : 'border-border/60 bg-background/40 text-muted-foreground/60',
                              )}
                            >
                              <span className="font-bold">
                                {hasVars ? cell.variables.join(', ') : '∅'}
                              </span>
                              <span className="text-[10px] text-muted-foreground mt-0.5">
                                &quot;{cell.substring}&quot;
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Selected Cell Inspector */}
              {selectedCellCoords && (
                <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-2 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-foreground">
                      Cell Inspector: span {selectedCellCoords.span}, pos {selectedCellCoords.i} (
                      substring &quot;{cykResult.matrix[selectedCellCoords.span - 1]?.[selectedCellCoords.i]?.substring}&quot;
                      )
                    </span>
                    <span className="font-mono text-xs text-primary font-bold">
                      Derives: &#123;{' '}
                      {cykResult.matrix[selectedCellCoords.span - 1]?.[selectedCellCoords.i]?.variables.join(', ') || '∅'}{' '}
                      &#125;
                    </span>
                  </div>

                  {/* Terminal Rules */}
                  {cykResult.matrix[selectedCellCoords.span - 1]?.[selectedCellCoords.i]?.terminalRules.length > 0 && (
                    <div className="font-mono text-xs text-emerald-600 dark:text-emerald-400">
                      Terminal Rules Applied:{' '}
                      {cykResult.matrix[selectedCellCoords.span - 1]?.[selectedCellCoords.i]?.terminalRules.join(', ')}
                    </div>
                  )}

                  {/* Binary Witnesses */}
                  {cykResult.matrix[selectedCellCoords.span - 1]?.[selectedCellCoords.i]?.witnesses.length > 0 && (
                    <div className="space-y-1 font-mono text-xs text-foreground">
                      <span className="text-muted-foreground">Binary Productions Fired:</span>
                      <ul className="list-disc pl-5 space-y-0.5">
                        {cykResult.matrix[selectedCellCoords.span - 1]?.[selectedCellCoords.i]?.witnesses.map((w, wIdx) => (
                          <li key={wIdx}>
                            <span className="font-bold text-primary">{w.rule}</span> (split k = {w.splitK}: left &quot;
                            {cykResult.tokens.slice(selectedCellCoords.i, selectedCellCoords.i + w.splitK).join('')}
                            &quot; [{w.leftVar}], right &quot;
                            {cykResult.tokens.slice(selectedCellCoords.i + w.splitK, selectedCellCoords.i + selectedCellCoords.span).join('')}
                            &quot; [{w.rightVar}])
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card/60 p-6 text-center text-xs font-mono text-muted-foreground">
              {cykResult.stepExplanations[0]}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: AMBIGUITY ANALYSIS */}
      {activeTab === 'ambiguity' && (
        <div className="space-y-6">
          {/* Top Ambiguity Controls */}
          <div className="rounded-2xl border border-border bg-card/60 p-5 shadow-sm space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded bg-amber-500/10 text-amber-500">
                  <AlertTriangle className="size-3.5" />
                </span>
                <h3 className="font-mono text-sm font-bold text-foreground">
                  Grammar Ambiguity Analysis & Dual Parse Tree Finder
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Searches for strings that admit two or more distinct parse trees (or distinct leftmost derivations).
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <input
                type="text"
                value={ambiguityInput}
                onChange={(e) => setAmbiguityInput(e.target.value)}
                placeholder="Optional: Enter specific string to test, or leave blank for auto-search"
                className="flex-1 rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none"
              />
              <button
                onClick={() => runAmbiguityCheck()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 font-mono text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Sparkles className="size-3.5" />
                <span>Verify Ambiguity</span>
              </button>
            </div>

            {/* Theoretical Disclaimer Alert */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400 font-mono">
              <div className="flex items-center gap-1.5 font-bold mb-0.5">
                <Info className="size-4" /> Undecidability Theorem (Hopcroft & Ullman)
              </div>
              Testing whether an arbitrary CFG is ambiguous is undecidable in general (reducible from Post’s
              Correspondence Problem). Discovering a string with 2 distinct parse trees mathematically proves
              ambiguity; however, bounded search cannot guarantee a grammar is unambiguous.
            </div>
          </div>

          {/* Ambiguity Search Result */}
          {ambiguityResult && (
            <div className="rounded-2xl border border-border bg-card/60 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-foreground">
                  Analysis Outcome
                </span>
                {ambiguityResult.isAmbiguous ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-3 py-1 font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                    <AlertTriangle className="size-4" /> AMBIGUOUS GRAMMAR
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-3 py-1 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                    <Info className="size-4" /> No Ambiguity in Tested Bound
                  </span>
                )}
              </div>

              <p className="font-mono text-xs text-foreground leading-relaxed">
                {ambiguityResult.explanation}
              </p>

              {/* If Ambiguous: Side-by-Side Dual Parse Trees */}
              {ambiguityResult.witness && (
                <div className="space-y-4 pt-2">
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-xs font-mono text-foreground">
                    <span className="font-bold text-rose-600 dark:text-rose-400">
                      Ambiguity Witness:
                    </span>{' '}
                    String &quot;{ambiguityResult.witness.string}&quot; yields two structurally distinct parse trees.
                    Leftmost derivations diverge at step {ambiguityResult.witness.divergenceStepIndex + 1}.
                  </div>

                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Tree 1 */}
                    <div className="space-y-2">
                      <ParseTreeVisualizer
                        tree={ambiguityResult.witness.tree1}
                        title={`Tree 1 (String: "${ambiguityResult.witness.string}")`}
                      />
                      <div className="rounded-xl border border-border bg-secondary/30 p-2.5 font-mono text-[11px]">
                        <span className="font-bold text-muted-foreground block mb-1">
                          Leftmost Derivation 1:
                        </span>
                        <div className="text-foreground">
                          {ambiguityResult.witness.derivation1
                            .map((s) => (s.form.length === 0 ? 'ε' : s.form.join(' ')))
                            .join(' ⇒ ')}
                        </div>
                      </div>
                    </div>

                    {/* Tree 2 */}
                    <div className="space-y-2">
                      <ParseTreeVisualizer
                        tree={ambiguityResult.witness.tree2}
                        title={`Tree 2 (String: "${ambiguityResult.witness.string}")`}
                      />
                      <div className="rounded-xl border border-border bg-secondary/30 p-2.5 font-mono text-[11px]">
                        <span className="font-bold text-muted-foreground block mb-1">
                          Leftmost Derivation 2:
                        </span>
                        <div className="text-foreground">
                          {ambiguityResult.witness.derivation2
                            .map((s) => (s.form.length === 0 ? 'ε' : s.form.join(' ')))
                            .join(' ⇒ ')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

