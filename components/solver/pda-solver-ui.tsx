'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Layers,
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  CheckCircle2,
  XCircle,
  Copy,
  GitBranch,
  FileCode,
  Table,
  ArrowRight,
  Info,
  Split,
  Binary,
  Cpu,
  ArrowDown,
  Sparkles,
} from 'lucide-react'
import {
  type FormalPda,
  type PdaSimulationResult,
  simulatePda,
  parsePdaFromText,
  formatPdaToText,
  formatPdaFormalTuple,
} from '@/lib/pda'
import {
  getStandardPda,
  solvePdaProblem,
  formatPdaTableMarkdown,
} from '@/lib/pda-solver'
import {
  convertCfgToPda,
  convertPdaToCfg,
  type CfgToPdaResult,
  type PdaToCfgResult,
} from '@/lib/pda-transformations'
import { parseCfgFromText, formatCfgToText, GRAMMARS } from '@/lib/cfg'
import { PdaGraph } from './pda-graph'
import { cn } from '@/lib/utils'

const PRESET_PDAS = [
  { id: 'an_bn', name: '0ⁿ1ⁿ (n ≥ 0)', pattern: 'an_bn' },
  { id: 'balanced', name: 'Balanced Parentheses', pattern: 'balanced_parentheses' },
  { id: 'palindromes', name: 'Palindromes (w = wᴿ)', pattern: 'palindromes' },
  { id: 'equal', name: 'Equal 0s and 1s', pattern: 'equal_zeros_ones' },
]

export function PdaSolverUI({ initialPdaText }: { initialPdaText?: string }) {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('an_bn')
  const [pdaText, setPdaText] = useState<string>(
    initialPdaText || formatPdaToText(getStandardPda('an_bn')),
  )
  const [activeTab, setActiveTab] = useState<'simulation' | 'editor' | 'transformations' | 'table'>(
    'simulation',
  )

  // Parse live PDA
  const parsedPdaResult = useMemo(() => {
    return parsePdaFromText(pdaText)
  }, [pdaText])

  const currentPda: FormalPda = useMemo(() => {
    if (parsedPdaResult.pda) return parsedPdaResult.pda
    return getStandardPda('an_bn')
  }, [parsedPdaResult])

  // Simulation state
  const [simInput, setSimInput] = useState<string>('0011')
  const [simStep, setSimStep] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [copiedText, setCopiedText] = useState<string | null>(null)

  // Run simulation
  const simResult: PdaSimulationResult = useMemo(() => {
    return simulatePda(currentPda, simInput)
  }, [currentPda, simInput])

  const maxStep = simResult.path.length - 1
  const currentConfig = simResult.path[Math.min(simStep, maxStep)]

  // Reset step on input or PDA change
  useEffect(() => {
    setSimStep(0)
    setIsPlaying(false)
  }, [currentPda, simInput])

  // Autoplay effect
  useEffect(() => {
    if (!isPlaying) return
    if (simStep >= maxStep) {
      setIsPlaying(false)
      return
    }
    timerRef.current = setTimeout(() => {
      setSimStep((s) => s + 1)
    }, 750)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isPlaying, simStep, maxStep])

  // CFG to PDA conversion workspace state
  const [cfgInputText, setCfgInputText] = useState<string>(formatCfgToText(GRAMMARS[0]))
  const cfgParse = useMemo(() => parseCfgFromText(cfgInputText), [cfgInputText])
  const cfgToPdaResult: CfgToPdaResult | null = useMemo(() => {
    if (cfgParse.success && cfgParse.grammar) {
      return convertCfgToPda(cfgParse.grammar)
    }
    return null
  }, [cfgParse])

  // PDA to CFG conversion workspace state
  const pdaToCfgResult: PdaToCfgResult = useMemo(() => {
    return convertPdaToCfg(currentPda)
  }, [currentPda])

  function handleSelectPreset(preset: (typeof PRESET_PDAS)[number]) {
    setSelectedPresetId(preset.id)
    const p = getStandardPda(preset.pattern)
    setPdaText(formatPdaToText(p))
    const firstEg = p.examples?.[0] || '01'
    setSimInput(firstEg)
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
              <Layers className="size-4" />
            </span>
            <h2 className="font-mono text-base font-bold text-foreground">
              Pushdown Automata (PDA) Engine
            </h2>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              M = (Q, Σ, Γ, δ, q₀, Z₀, F)
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Finite control with unbounded LIFO stack memory. Simulates push/pop transitions, CFG $\leftrightarrow$ PDA conversions, and state diagrams.
          </p>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">Presets:</span>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_PDAS.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelectPreset(p)}
                className={cn(
                  'rounded-lg border px-2.5 py-1 font-mono text-xs transition-colors',
                  selectedPresetId === p.id
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {[
          { id: 'simulation', label: 'Interactive Simulation & Stack', icon: Layers },
          { id: 'editor', label: 'PDA Specification & Formal 7-Tuple', icon: FileCode },
          { id: 'transformations', label: 'CFG ↔ PDA Conversion Studio', icon: Split },
          { id: 'table', label: 'Transition Table (δ)', icon: Table },
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

      {/* TAB 1: SIMULATION & STACK VISUALIZER */}
      {activeTab === 'simulation' && (
        <div className="space-y-6">
          {/* Top Controls: String Input & Stepper */}
          <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card/60 p-4 shadow-sm md:grid-cols-12 md:items-center">
            {/* Input String */}
            <div className="space-y-1.5 md:col-span-5">
              <label className="block font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Input String (w ∈ Σ*)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={simInput}
                  onChange={(e) => setSimInput(e.target.value)}
                  placeholder="Enter input string (e.g. 0011)"
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none"
                />
                <button
                  onClick={() => setSimInput('')}
                  className="rounded-xl border border-border bg-secondary/50 px-3 py-2 font-mono text-xs font-medium text-foreground hover:bg-secondary"
                  title="Empty string ε"
                >
                  ε
                </button>
              </div>
              {/* Examples */}
              {currentPda.examples && currentPda.examples.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  <span className="font-mono text-[10px] text-muted-foreground">Samples:</span>
                  {currentPda.examples.map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => setSimInput(ex)}
                      className="rounded border border-border/70 bg-secondary/40 px-1.5 py-0.5 font-mono text-[10px] text-foreground hover:bg-secondary"
                    >
                      {ex === '' ? 'ε' : ex}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Stepper Controls */}
            <div className="space-y-1.5 md:col-span-4">
              <label className="block font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Step Controller ({simStep + 1} / {simResult.path.length})
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setSimStep(0)}
                  disabled={simStep === 0}
                  className="rounded-lg border border-border bg-card p-2 text-foreground disabled:opacity-40 hover:bg-secondary"
                  title="Reset to beginning"
                >
                  <SkipBack className="size-3.5" />
                </button>
                <button
                  onClick={() => setSimStep((s) => Math.max(0, s - 1))}
                  disabled={simStep === 0}
                  className="rounded-lg border border-border bg-card px-2.5 py-1.5 font-mono text-xs font-semibold text-foreground disabled:opacity-40 hover:bg-secondary"
                >
                  Back
                </button>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="inline-flex items-center gap-1 rounded-lg border border-primary bg-primary/10 px-3 py-1.5 font-mono text-xs font-semibold text-primary hover:bg-primary/20"
                >
                  {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                  <span>{isPlaying ? 'Pause' : 'Play'}</span>
                </button>
                <button
                  onClick={() => setSimStep((s) => Math.min(maxStep, s + 1))}
                  disabled={simStep >= maxStep}
                  className="rounded-lg border border-border bg-card px-2.5 py-1.5 font-mono text-xs font-semibold text-foreground disabled:opacity-40 hover:bg-secondary"
                >
                  Step
                </button>
                <button
                  onClick={() => setSimStep(maxStep)}
                  disabled={simStep >= maxStep}
                  className="rounded-lg border border-border bg-card p-2 text-foreground disabled:opacity-40 hover:bg-secondary"
                  title="Jump to final step"
                >
                  <SkipForward className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Acceptance Status Badge */}
            <div className="flex items-center justify-end md:col-span-3">
              {simResult.accepted ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-right font-mono">
                  <div className="flex items-center justify-end gap-1 font-bold text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-4" /> ACCEPTED
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {simResult.path.length - 1} transition steps
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-right font-mono">
                  <div className="flex items-center justify-end gap-1 font-bold text-xs text-rose-600 dark:text-rose-400">
                    <XCircle className="size-4" /> REJECTED
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Halted at step {simStep + 1}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Execution Visualization Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left: Animated LIFO Stack Simulator */}
            <div className="space-y-4 lg:col-span-4">
              <div className="rounded-2xl border border-border bg-card/60 p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Layers className="size-4 text-primary" /> LIFO Stack Memory
                  </span>
                  <span className="font-mono text-xs font-semibold text-primary">
                    Depth: {currentConfig?.stack.length || 0}
                  </span>
                </div>

                {/* Stack Container */}
                <div className="flex flex-col items-center justify-end min-h-[260px] max-h-[340px] rounded-xl border-x-2 border-b-2 border-border bg-secondary/20 p-3 overflow-y-auto space-y-1.5">
                  {currentConfig?.stack.length === 0 ? (
                    <div className="text-center font-mono text-xs text-muted-foreground italic my-auto">
                      [Empty Stack (ε)]
                    </div>
                  ) : (
                    currentConfig?.stack.map((item, idx) => {
                      const isTop = idx === 0
                      return (
                        <div
                          key={idx}
                          className={cn(
                            'w-full max-w-[200px] rounded-lg py-1.5 text-center font-mono text-xs font-bold transition-all shadow-sm',
                            isTop
                              ? 'border-2 border-primary bg-primary/20 text-primary scale-105'
                              : 'border border-border bg-card text-foreground',
                          )}
                        >
                          <div className="flex items-center justify-between px-3">
                            <span className="text-[10px] text-muted-foreground">
                              {isTop ? 'TOP' : `[${idx}]`}
                            </span>
                            <span>{item}</span>
                            <span className="text-[10px] opacity-0">.</span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Stack Action Note */}
                <div className="rounded-xl border border-border bg-background/60 p-2.5 font-mono text-xs text-foreground">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold mb-0.5">
                    Last Transition Action:
                  </span>
                  <span>{currentConfig?.actionNote || 'Initial state'}</span>
                </div>
              </div>

              {/* Remaining Input String Tracker */}
              <div className="rounded-2xl border border-border bg-card/60 p-4 shadow-sm space-y-2">
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                  Input Stream Progress
                </span>

                <div className="flex items-center gap-1 font-mono text-sm overflow-x-auto py-2">
                  {simInput.length === 0 ? (
                    <span className="text-amber-500 italic text-xs">ε (empty string)</span>
                  ) : (
                    simInput.split('').map((char, cIdx) => {
                      const isConsumed = cIdx < (currentConfig?.consumedCount || 0)
                      const isCurrent = cIdx === (currentConfig?.consumedCount || 0)

                      return (
                        <div key={cIdx} className="flex flex-col items-center min-w-6">
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 font-bold',
                              isConsumed
                                ? 'bg-secondary text-muted-foreground line-through opacity-60'
                                : isCurrent
                                ? 'bg-primary/20 text-primary border border-primary'
                                : 'text-foreground',
                            )}
                          >
                            {char}
                          </span>
                          {isCurrent && <ArrowDown className="size-3 text-primary mt-1 animate-bounce" />}
                        </div>
                      )
                    })
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground pt-1 border-t border-border">
                  <span>Consumed: {currentConfig?.consumedCount || 0} / {simInput.length}</span>
                  <span>
                    Remaining: &quot;{currentConfig?.remainingInput || 'ε'}&quot;
                  </span>
                </div>
              </div>
            </div>

            {/* Right: State Diagram with Active State Indicator */}
            <div className="space-y-4 lg:col-span-8">
              <PdaGraph
                pda={currentPda}
                activeState={currentConfig?.state}
                title={`State Diagram (Active: ${currentConfig?.state || currentPda.startState})`}
              />

              {/* Active Step Details Bar */}
              <div className="rounded-2xl border border-border bg-card/60 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
                <div>
                  <span className="text-muted-foreground">Current State: </span>
                  <span className="font-bold text-primary text-sm">{currentConfig?.state}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Stack Top: </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {currentConfig?.stack[0] || 'EMPTY'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Acceptance Check: </span>
                  <span className="font-bold text-foreground">
                    {currentPda.acceptStates.includes(currentConfig?.state || '') ? 'In F' : 'Not in F'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PDA SPECIFICATION & FORMAL 7-TUPLE */}
      {activeTab === 'editor' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Rules Editor */}
          <div className="space-y-4 lg:col-span-6">
            <div className="rounded-2xl border border-border bg-card/60 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  PDA Transition Rules (q, a, X → p, α)
                </label>
                <button
                  onClick={() => handleCopy(pdaText, 'rules')}
                  className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                >
                  <Copy className="size-3" />
                  {copiedText === 'rules' ? 'Copied' : 'Copy'}
                </button>
              </div>

              <textarea
                rows={11}
                value={pdaText}
                onChange={(e) => setPdaText(e.target.value)}
                placeholder="q0, 0, Z0 -> q1, 0Z0"
                className="w-full rounded-xl border border-border bg-background p-3 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
              />

              {/* Validation Status */}
              {parsedPdaResult.pda ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400 font-mono">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <CheckCircle2 className="size-4" /> PDA Validated Successfully
                  </div>
                  <div>
                    States Q: &#123; {currentPda.states.join(', ')} &#125; | Stack Γ: &#123;{' '}
                    {currentPda.stackAlphabet.join(', ')} &#125;
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400 font-mono">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <XCircle className="size-4" /> Syntax / Validation Error
                  </div>
                  <div>{parsedPdaResult.error}</div>
                </div>
              )}
            </div>
          </div>

          {/* Formal 7-Tuple Display */}
          <div className="space-y-4 lg:col-span-6">
            <div className="rounded-2xl border border-border bg-card/60 p-4 shadow-sm space-y-3">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Mathematical 7-Tuple M = (Q, Σ, Γ, δ, q₀, Z₀, F)
              </span>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-2.5">
                  <span className="text-muted-foreground">States (Q):</span>
                  <span className="font-bold text-primary">&#123; {currentPda.states.join(', ')} &#125;</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-2.5">
                  <span className="text-muted-foreground">Input Alphabet (Σ):</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    &#123; {currentPda.alphabet.join(', ') || '∅'} &#125;
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-2.5">
                  <span className="text-muted-foreground">Stack Alphabet (Γ):</span>
                  <span className="font-bold text-amber-500">
                    &#123; {currentPda.stackAlphabet.join(', ')} &#125;
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-2.5">
                  <span className="text-muted-foreground">Initial State (q₀):</span>
                  <span className="font-bold text-foreground">{currentPda.startState}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-2.5">
                  <span className="text-muted-foreground">Initial Stack Symbol (Z₀):</span>
                  <span className="font-bold text-foreground">{currentPda.startStackSymbol}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-2.5">
                  <span className="text-muted-foreground">Final Accepting States (F):</span>
                  <span className="font-bold text-foreground">
                    &#123; {currentPda.acceptStates.join(', ') || '∅'} &#125;
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CFG <-> PDA CONVERSIONS */}
      {activeTab === 'transformations' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* CFG to PDA Section */}
          <div className="space-y-4 lg:col-span-6">
            <div className="rounded-2xl border border-border bg-card/60 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-mono text-sm font-bold text-foreground">
                    CFG to PDA Conversion
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Top-down simulation construction (A → α becomes ε, A → α).
                  </p>
                </div>
                {cfgToPdaResult && (
                  <button
                    onClick={() => {
                      setPdaText(formatPdaToText(cfgToPdaResult.pda))
                      setActiveTab('simulation')
                    }}
                    className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 font-mono text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    <Sparkles className="size-3.5" /> Load in Simulator
                  </button>
                )}
              </div>

              <textarea
                rows={5}
                value={cfgInputText}
                onChange={(e) => setCfgInputText(e.target.value)}
                placeholder="S -> 0 S 1 | ε"
                className="w-full rounded-xl border border-border bg-background p-3 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
              />

              {cfgToPdaResult && (
                <div className="space-y-3 font-mono text-xs">
                  <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-1">
                    <span className="font-bold text-muted-foreground block text-[11px] uppercase">
                      Construction Steps:
                    </span>
                    <ul className="list-disc pl-5 space-y-0.5 text-foreground text-[11px]">
                      {cfgToPdaResult.stepExplanations.map((step, sIdx) => (
                        <li key={sIdx}>{step}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-border bg-background/50 p-3 space-y-1">
                    <span className="font-bold text-primary block text-[11px]">
                      Generated PDA Transitions ({cfgToPdaResult.pda.rules.length} rules):
                    </span>
                    <pre className="text-[11px] text-foreground max-h-40 overflow-y-auto">
                      {formatPdaToText(cfgToPdaResult.pda)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* PDA to CFG Section */}
          <div className="space-y-4 lg:col-span-6">
            <div className="rounded-2xl border border-border bg-card/60 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-mono text-sm font-bold text-foreground">
                    PDA to CFG Conversion
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    State-pair triple construction [q, X, p] pruned of useless symbols.
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(formatCfgToText(pdaToCfgResult.grammar), 'cfg_res')}
                  className="inline-flex items-center gap-1 rounded-xl border border-border bg-secondary/50 px-3 py-1.5 font-mono text-xs font-medium text-foreground hover:bg-secondary"
                >
                  <Copy className="size-3.5" /> {copiedText === 'cfg_res' ? 'Copied' : 'Copy CFG'}
                </button>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-1">
                  <span className="font-bold text-muted-foreground block text-[11px] uppercase">
                    Conversion Steps:
                  </span>
                  <ul className="list-disc pl-5 space-y-0.5 text-foreground text-[11px]">
                    {pdaToCfgResult.stepExplanations.map((step, sIdx) => (
                      <li key={sIdx}>{step}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-border bg-background/50 p-3 space-y-1">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 block text-[11px]">
                    Resulting Context-Free Grammar ({pdaToCfgResult.grammar.variables.length} active variables):
                  </span>
                  <pre className="text-[11px] text-foreground max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {formatCfgToText(pdaToCfgResult.grammar)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TRANSITION TABLE */}
      {activeTab === 'table' && (
        <div className="rounded-2xl border border-border bg-card/60 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="font-mono text-sm font-bold text-foreground">
                PDA Transition Table δ: Q × (Σ ∪ &#123;ε&#125;) × Γ → P(Q × Γ*)
              </h3>
              <p className="text-xs text-muted-foreground">
                Formal lookup table specifying the next state and stack replacement string for each configuration.
              </p>
            </div>
            <button
              onClick={() => handleCopy(formatPdaTableMarkdown(currentPda), 'table_md')}
              className="inline-flex items-center gap-1 rounded-xl border border-border bg-secondary/50 px-3 py-1.5 font-mono text-xs font-medium text-foreground hover:bg-secondary"
            >
              <Copy className="size-3.5" /> {copiedText === 'table_md' ? 'Copied' : 'Copy Markdown'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-border bg-secondary/30 text-muted-foreground">
                  <th className="p-3">From State (q)</th>
                  <th className="p-3">Input Symbol (a)</th>
                  <th className="p-3">Stack Top Pop (X)</th>
                  <th className="p-3">Next State (p)</th>
                  <th className="p-3">Stack Replacement (α)</th>
                  <th className="p-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {currentPda.rules.map((r, rIdx) => (
                  <tr key={rIdx} className="hover:bg-secondary/20 transition-colors">
                    <td className="p-3 font-bold text-primary">{r.from}</td>
                    <td className="p-3">
                      {r.input === '' || r.input === 'ε' ? (
                        <span className="text-amber-500 italic">ε</span>
                      ) : (
                        <span className="font-bold">{r.input}</span>
                      )}
                    </td>
                    <td className="p-3">
                      {r.pop === '' || r.pop === 'ε' ? (
                        <span className="text-amber-500 italic">ε</span>
                      ) : (
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{r.pop}</span>
                      )}
                    </td>
                    <td className="p-3 font-bold text-primary">{r.to}</td>
                    <td className="p-3">
                      {r.push.length === 0 || (r.push.length === 1 && (r.push[0] === '' || r.push[0] === 'ε')) ? (
                        <span className="text-rose-500 italic">ε (pop)</span>
                      ) : (
                        <span className="font-bold text-foreground">{r.push.join('')}</span>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground text-[11px]">{r.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

