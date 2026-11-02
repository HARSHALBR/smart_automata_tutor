'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
  Cpu,
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Copy,
  Table,
  Sparkles,
  BookOpen,
  Layers,
  ArrowRight,
  Info,
  Binary,
} from 'lucide-react'
import {
  type FormalTuringMachine,
  type TMSimulationResult,
  simulateTuringMachine,
  parseTMFromText,
  formatTMToText,
  formatTMFormalTuple,
  BLANK,
} from '@/lib/turing'
import {
  getStandardTuringMachine,
  solveTuringProblem,
  formatTMTableMarkdown,
  type TMLanguagePattern,
} from '@/lib/turing-solver'
import {
  type MultiTapeTuringMachine,
  type MultiTapeSimulationResult,
  get2TapePalindromeTM,
  simulateMultiTapeTM,
} from '@/lib/turing-multitape'
import { TuringTapeGraph } from './turing-tape-graph'
import { TuringMultiTapeGraph } from './turing-multitape-graph'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PresetItem {
  id: string
  name: string
  pattern: TMLanguagePattern
  isMultiTape?: boolean
  defaultInput: string
}

const PRESET_TMS: PresetItem[] = [
  { id: 'an_bn_cn', name: 'aⁿbⁿcⁿ (n ≥ 0)', pattern: 'an_bn_cn', defaultInput: 'aabbcc' },
  { id: 'palindromes', name: 'Palindromes (w = wᴿ)', pattern: 'palindromes', defaultInput: '0110' },
  { id: 'equal', name: 'Equal 0s and 1s', pattern: 'equal_zeros_ones', defaultInput: '0011' },
  { id: 'an_bn', name: '0ⁿ1ⁿ (n ≥ 0)', pattern: 'an_bn', defaultInput: '0011' },
  { id: 'unary_add', name: 'Unary Addition (1ᵐ01ⁿ)', pattern: 'unary_addition', defaultInput: '110111' },
  { id: 'div3', name: 'Binary Divisibility by 3', pattern: 'binary_divisibility', defaultInput: '110' },
  { id: 'multi_pal', name: '2-Tape Palindromes O(n)', pattern: 'palindromes', isMultiTape: true, defaultInput: '0110' },
]

export function TuringSolverUI({ initialTmText }: { initialTmText?: string }) {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('an_bn_cn')
  const [activeTab, setActiveTab] = useState<'simulation' | 'editor' | 'table' | 'theory'>('simulation')
  const [isMultiTapeMode, setIsMultiTapeMode] = useState<boolean>(false)

  // TM Specification Text
  const [tmText, setTmText] = useState<string>(
    initialTmText || formatTMToText(getStandardTuringMachine('an_bn_cn')),
  )

  // Simulation inputs
  const [simInput, setSimInput] = useState<string>('aabbcc')
  const [simStep, setSimStep] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [playSpeed, setPlaySpeed] = useState<number>(400) // ms per step
  const [copied, setCopied] = useState<string | null>(null)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Parse live single-tape TM
  const parsedTmResult = useMemo(() => {
    return parseTMFromText(tmText)
  }, [tmText])

  const currentTm: FormalTuringMachine = useMemo(() => {
    if (parsedTmResult.tm) return parsedTmResult.tm
    return getStandardTuringMachine('an_bn_cn')
  }, [parsedTmResult])

  // Multi-tape TM instance
  const multiTapeTm: MultiTapeTuringMachine = useMemo(() => {
    return get2TapePalindromeTM()
  }, [])

  // Run single-tape simulation
  const singleSimulation: TMSimulationResult = useMemo(() => {
    return simulateTuringMachine(currentTm, simInput, 1000)
  }, [currentTm, simInput])

  // Run multi-tape simulation
  const multiSimulation: MultiTapeSimulationResult = useMemo(() => {
    return simulateMultiTapeTM(multiTapeTm, simInput, 1000)
  }, [multiTapeTm, simInput])

  const maxSteps = isMultiTapeMode
    ? multiSimulation.history.length - 1
    : singleSimulation.history.length - 1

  // Clamp step
  useEffect(() => {
    setSimStep(0)
    setIsPlaying(false)
  }, [simInput, tmText, isMultiTapeMode])

  // Animation player
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }

    if (simStep >= maxSteps) {
      setIsPlaying(false)
      return
    }

    timerRef.current = setTimeout(() => {
      setSimStep((prev) => Math.min(prev + 1, maxSteps))
    }, playSpeed)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isPlaying, simStep, maxSteps, playSpeed])

  // Active step data
  const currentSingleStep = singleSimulation.history[simStep] ?? singleSimulation.history[0]
  const currentMultiStep = multiSimulation.history[simStep] ?? multiSimulation.history[0]

  // Switch preset
  function handleSelectPreset(preset: PresetItem) {
    setSelectedPresetId(preset.id)
    setIsMultiTapeMode(!!preset.isMultiTape)
    setSimInput(preset.defaultInput)
    if (!preset.isMultiTape) {
      const machine = getStandardTuringMachine(preset.pattern)
      setTmText(formatTMToText(machine))
    }
  }

  function handleCopy(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  // Educational solution details
  const educationalSolution = useMemo(() => {
    const activePreset = PRESET_TMS.find((p) => p.id === selectedPresetId)
    return solveTuringProblem(`Construct a Turing Machine for ${activePreset?.name || 'language'}`, {
      type: isMultiTapeMode ? 'multi_tape_tm' : 'tm_from_language',
      languagePattern: activePreset?.pattern || 'an_bn_cn',
      givenTm: !isMultiTapeMode ? currentTm : undefined,
      targetString: simInput,
      isMultiTape: isMultiTapeMode,
    })
  }, [selectedPresetId, isMultiTapeMode, currentTm, simInput])

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-widest text-primary">
                Turing Machine Engine (Phase 17)
              </span>
              <span className="rounded-full bg-primary/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
                M = (Q, Σ, Γ, δ, q0, B, F)
              </span>
            </div>
            <h2 className="font-serif text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {isMultiTapeMode ? multiTapeTm.name : currentTm.name}
            </h2>
            <p className="max-w-3xl text-sm text-muted-foreground">
              {isMultiTapeMode ? multiTapeTm.description : currentTm.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMultiTapeMode(!isMultiTapeMode)}
              className={cn(
                'gap-2 rounded-xl border text-xs font-semibold transition-all',
                isMultiTapeMode
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border/70 text-muted-foreground hover:bg-secondary/40',
              )}
            >
              <Layers className="size-3.5" />
              {isMultiTapeMode ? 'Multi-Tape Active (k=2)' : 'Switch to Multi-Tape TM'}
            </Button>
          </div>
        </div>

        {/* Preset Selector Badges */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/30 pt-4">
          <span className="font-mono text-xs text-muted-foreground">Canonical Presets:</span>
          {PRESET_TMS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleSelectPreset(preset)}
              className={cn(
                'rounded-lg px-2.5 py-1 font-mono text-xs transition-all',
                selectedPresetId === preset.id
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-card text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
              )}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-2">
        <button
          onClick={() => setActiveTab('simulation')}
          className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-semibold transition-all',
            activeTab === 'simulation'
              ? 'border border-primary/40 bg-primary/10 text-primary shadow-xs'
              : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground',
          )}
        >
          <Cpu className="size-3.5" /> Interactive Tape Simulator
        </button>

        <button
          onClick={() => setActiveTab('editor')}
          className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-semibold transition-all',
            activeTab === 'editor'
              ? 'border border-primary/40 bg-primary/10 text-primary shadow-xs'
              : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground',
          )}
        >
          <Binary className="size-3.5" /> TM Formal Definition (7-Tuple)
        </button>

        <button
          onClick={() => setActiveTab('table')}
          className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-semibold transition-all',
            activeTab === 'table'
              ? 'border border-primary/40 bg-primary/10 text-primary shadow-xs'
              : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground',
          )}
        >
          <Table className="size-3.5" /> Transition Function (δ)
        </button>

        <button
          onClick={() => setActiveTab('theory')}
          className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-semibold transition-all',
            activeTab === 'theory'
              ? 'border border-primary/40 bg-primary/10 text-primary shadow-xs'
              : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground',
          )}
        >
          <BookOpen className="size-3.5" /> Proof & Complexity Analysis
        </button>
      </div>

      {/* Tab 1: Interactive Simulation */}
      {activeTab === 'simulation' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
            {/* Input string field */}
            <div className="flex flex-wrap items-center gap-3">
              <label className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Input String (w):
              </label>
              <input
                type="text"
                value={simInput}
                onChange={(e) => setSimInput(e.target.value)}
                placeholder="ε (empty)"
                className="h-9 w-44 rounded-xl border border-border bg-background px-3 font-mono text-sm text-foreground focus:border-primary focus:outline-none"
              />
              <span className="font-mono text-xs text-muted-foreground">
                (len: {simInput.length})
              </span>
            </div>

            {/* Step Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSimStep(0)}
                disabled={simStep === 0}
                className="h-9 rounded-xl"
              >
                <RotateCcw className="size-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSimStep((s) => Math.max(0, s - 1))}
                disabled={simStep === 0}
                className="h-9 rounded-xl"
              >
                <SkipBack className="size-3.5" />
              </Button>
              <Button
                size="sm"
                onClick={() => setIsPlaying(!isPlaying)}
                className="h-9 gap-1.5 rounded-xl px-4"
              >
                {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                {isPlaying ? 'Pause' : 'Play'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSimStep((s) => Math.min(maxSteps, s + 1))}
                disabled={simStep >= maxSteps}
                className="h-9 rounded-xl"
              >
                <SkipForward className="size-3.5" />
              </Button>

              {/* Speed slider */}
              <div className="ml-2 flex items-center gap-2 font-mono text-xs text-muted-foreground">
                <span>Speed:</span>
                <input
                  type="range"
                  min="50"
                  max="1000"
                  step="50"
                  value={playSpeed}
                  onChange={(e) => setPlaySpeed(Number(e.target.value))}
                  className="h-2 w-20 accent-primary cursor-pointer"
                />
              </div>
            </div>

            {/* Status Pill */}
            <div className="flex items-center gap-3 font-mono text-xs">
              <span>
                Step <strong>{simStep}</strong> / {maxSteps}
              </span>
              {(() => {
                const isFinal = simStep === maxSteps
                const accepted = isMultiTapeMode
                  ? multiSimulation.accepted
                  : singleSimulation.accepted
                const rejected = isMultiTapeMode
                  ? multiSimulation.rejected
                  : singleSimulation.rejected
                const inconclusive = isMultiTapeMode
                  ? multiSimulation.inconclusive
                  : singleSimulation.inconclusive

                if (isFinal) {
                  if (accepted) {
                    return (
                      <span className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-3.5" /> ACCEPTED
                      </span>
                    )
                  }
                  if (rejected) {
                    return (
                      <span className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 font-bold text-rose-600 dark:text-rose-400">
                        <XCircle className="size-3.5" /> REJECTED
                      </span>
                    )
                  }
                  if (inconclusive) {
                    return (
                      <span className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-bold text-amber-600 dark:text-amber-400">
                        <AlertCircle className="size-3.5" /> INCONCLUSIVE
                      </span>
                    )
                  }
                }
                return (
                  <span className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 font-semibold text-primary">
                    RUNNING
                  </span>
                )
              })()}
            </div>
          </div>

          {/* Tape Visualizer */}
          {isMultiTapeMode ? (
            <TuringMultiTapeGraph
              tapes={currentMultiStep?.tapes || [[BLANK]]}
              heads={currentMultiStep?.heads || [0, 0]}
              state={currentMultiStep?.state || multiTapeTm.startState}
              blankSymbol={multiTapeTm.blankSymbol}
              lastTransition={currentMultiStep?.transitionApplied}
              isAccepted={currentMultiStep?.isAccepted}
              isRejected={currentMultiStep?.isRejected}
              isInconclusive={currentMultiStep?.isInconclusive}
            />
          ) : (
            <TuringTapeGraph
              tape={currentSingleStep?.tape || [BLANK]}
              head={currentSingleStep?.head || 0}
              state={currentSingleStep?.state || currentTm.startState}
              blankSymbol={currentTm.blankSymbol}
              lastTransition={currentSingleStep?.transitionApplied}
              instantaneousDescription={currentSingleStep?.instantaneousDescription}
              isAccepted={currentSingleStep?.isAccepted}
              isRejected={currentSingleStep?.isRejected}
              isInconclusive={currentSingleStep?.isInconclusive}
            />
          )}

          {/* Execution History Timeline */}
          <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-serif text-sm font-semibold text-foreground">
                Configuration History (Instantaneous Descriptions)
              </h3>
              <span className="font-mono text-xs text-muted-foreground">
                Total Steps: {maxSteps + 1}
              </span>
            </div>

            <div className="max-h-56 space-y-1.5 overflow-y-auto pr-2 scrollbar-thin">
              {(isMultiTapeMode ? multiSimulation.history : singleSimulation.history).map(
                (step, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSimStep(idx)}
                    className={cn(
                      'flex cursor-pointer items-center justify-between rounded-lg px-3 py-1.5 font-mono text-xs transition-all',
                      simStep === idx
                        ? 'border border-primary/40 bg-primary/10 font-bold text-primary shadow-xs'
                        : 'hover:bg-secondary/40 text-muted-foreground',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-12 text-muted-foreground">Step {step.stepIndex}:</span>
                      <span className="text-foreground">
                        {isMultiTapeMode
                          ? `State: [${step.state}] Heads: (${(step as any).heads.join(', ')})`
                          : (step as any).instantaneousDescription}
                      </span>
                    </div>

                    <div>
                      {step.isAccepted && (
                        <span className="text-emerald-500 font-bold">ACCEPT</span>
                      )}
                      {step.isRejected && (
                        <span className="text-rose-500 font-bold">REJECT</span>
                      )}
                      {step.isInconclusive && (
                        <span className="text-amber-500 font-bold">LIMIT</span>
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Formal Definition & Live Editor */}
      {activeTab === 'editor' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Rules Editor */}
          <div className="space-y-3 rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Transition Rules Specification (δ)
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(tmText, 'rules')}
                className="h-7 gap-1 font-mono text-xs"
              >
                <Copy className="size-3" /> {copied === 'rules' ? 'Copied!' : 'Copy'}
              </Button>
            </div>

            <textarea
              value={tmText}
              onChange={(e) => setTmText(e.target.value)}
              rows={16}
              className="w-full resize-none rounded-xl border border-border bg-background p-3 font-mono text-xs leading-relaxed text-foreground focus:border-primary focus:outline-none"
              placeholder="q0, 0 -> q1, X, R&#10;q1, 1 -> q2, Y, L"
            />

            {parsedTmResult.error ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 font-mono text-xs text-rose-500">
                <span className="font-bold">Error:</span> {parsedTmResult.error}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 font-mono text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-4" />
                <span>Valid Turing Machine specification with {currentTm.transitions.length} transitions.</span>
              </div>
            )}
          </div>

          {/* Formal 7-Tuple & State Invariants */}
          <div className="space-y-4 rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
            <h3 className="font-serif text-base font-semibold text-foreground">
              Formal 7-Tuple Definition
            </h3>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 font-mono text-xs leading-relaxed text-foreground space-y-2">
              <div>
                <strong>Machine:</strong> M = (Q, Σ, Γ, δ, q0, B, F)
              </div>
              <div>
                <strong>States (Q):</strong> &#123; {currentTm.states.join(', ')} &#125;
              </div>
              <div>
                <strong>Input Alphabet (Σ):</strong> &#123; {currentTm.inputAlphabet.join(', ')} &#125;
              </div>
              <div>
                <strong>Tape Alphabet (Γ):</strong> &#123; {currentTm.tapeAlphabet.join(', ')} &#125;
              </div>
              <div>
                <strong>Start State (q0):</strong> {currentTm.startState}
              </div>
              <div>
                <strong>Blank Symbol (B):</strong> `{currentTm.blankSymbol}`
              </div>
              <div>
                <strong>Accept States (F):</strong> &#123; {currentTm.acceptStates.join(', ')} &#125;
              </div>
              <div>
                <strong>Reject States:</strong> &#123; {currentTm.rejectStates.join(', ')} &#125;
              </div>
            </div>

            {/* State Invariants Table */}
            <div className="space-y-2">
              <h4 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                State Meanings & Invariants
              </h4>
              <div className="max-h-60 overflow-y-auto rounded-xl border border-border/60 scrollbar-thin">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-muted/40 text-muted-foreground border-b border-border/60">
                    <tr>
                      <th className="p-2.5">State</th>
                      <th className="p-2.5">Role / Semantic Meaning</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {educationalSolution.stateInvariants.map((st) => (
                      <tr key={st.state} className="hover:bg-secondary/20">
                        <td className="p-2.5 font-bold text-primary">
                          {st.state}
                          {st.isAccept && (
                            <span className="ml-1.5 rounded bg-emerald-500/20 px-1 py-0.5 text-[10px] text-emerald-500">
                              accept
                            </span>
                          )}
                          {st.isReject && (
                            <span className="ml-1.5 rounded bg-rose-500/20 px-1 py-0.5 text-[10px] text-rose-500">
                              reject
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-muted-foreground">{st.role}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Transition Table */}
      {activeTab === 'table' && (
        <div className="space-y-4 rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-base font-semibold text-foreground">
              Transition Function δ: Q × Γ → Q × Γ × &#123;L, R, S&#125;
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                handleCopy(formatTMTableMarkdown(currentTm), 'transition_table')
              }
              className="gap-1.5 rounded-lg text-xs"
            >
              <Copy className="size-3.5" />
              {copied === 'transition_table' ? 'Copied Markdown!' : 'Copy Markdown Table'}
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border/60 scrollbar-thin">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-muted/40 text-muted-foreground border-b border-border/60">
                <tr>
                  <th className="p-3">Current State (q)</th>
                  <th className="p-3">Read Symbol (a)</th>
                  <th className="p-3">Next State (p)</th>
                  <th className="p-3">Write Symbol (b)</th>
                  <th className="p-3">Direction (D)</th>
                  <th className="p-3">Annotation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {currentTm.transitions.map((t, idx) => (
                  <tr key={idx} className="hover:bg-secondary/20">
                    <td className="p-3 font-semibold text-foreground">{t.fromState}</td>
                    <td className="p-3">
                      <span className="rounded bg-muted/60 px-2 py-0.5 font-bold">
                        {t.readSymbol === currentTm.blankSymbol ? '␣' : t.readSymbol}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-primary">{t.toState}</td>
                    <td className="p-3">
                      <span className="rounded bg-muted/60 px-2 py-0.5 font-bold">
                        {t.writeSymbol === currentTm.blankSymbol ? '␣' : t.writeSymbol}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-foreground">{t.move}</td>
                    <td className="p-3 text-muted-foreground">{t.description || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Proof & Complexity */}
      {activeTab === 'theory' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
            <h3 className="font-serif text-lg font-bold text-foreground">
              Mathematical Correctness & Induction Proof
            </h3>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap">
              {educationalSolution.mathematicalProof}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-2">
              <span className="font-mono text-xs uppercase tracking-wider text-primary font-bold">
                Time Complexity
              </span>
              <p className="font-mono text-2xl font-bold text-foreground">
                {educationalSolution.complexityAnalysis.timeComplexity}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {educationalSolution.complexityAnalysis.explanation}
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-2">
              <span className="font-mono text-xs uppercase tracking-wider text-primary font-bold">
                Multi-Tape vs. Single-Tape Speedup
              </span>
              <p className="font-mono text-sm font-semibold text-foreground">
                Quadratic Simulation Theorem
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {educationalSolution.complexityAnalysis.multiTapeComparison}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

