'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Sparkles,
  Check,
  X,
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Copy,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Layers,
  ArrowRight,
  ShieldCheck,
  Upload,
  Download,
  BookOpen,
  HelpCircle,
} from 'lucide-react'
import {
  type Automaton,
  EPSILON,
  runAutomatonDetailed,
  type DetailedRunResult,
  completeDfaWithSink,
} from '@/lib/automata'
import {
  createBlankAutomaton,
  addStateToAutomaton,
  removeStateFromAutomaton,
  setAutomatonStartState,
  toggleAutomatonAcceptState,
  setAutomatonTransition,
  setAutomatonAlphabet,
  toggleAutomatonNfa,
  validateEditorAutomaton,
  verifyAgainstReference,
  parseTransitionTableText,
  exportTransitionTableText,
  SAMPLE_LEARNING_AUTOMATA,
  type DetailedEditorValidation,
  type ReferenceVerificationResult,
} from '@/lib/automata-editor'
import { AutomatonGraph } from '@/components/labs/automaton-graph'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const REFERENCE_PRESETS = [
  { label: 'Ends with "01"', query: 'Construct a DFA that accepts strings ending with 01' },
  { label: 'Even number of zeros', query: 'Construct a DFA that accepts strings containing an even number of zeros' },
  { label: 'Odd number of ones', query: 'Construct a DFA that accepts strings with an odd number of ones' },
  { label: 'Contains substring 101', query: 'Construct a DFA that accepts strings containing the substring 101' },
  { label: 'Does not contain substring 011', query: 'Construct a DFA that does not contain substring 011' },
  { label: 'Binary divisible by 3', query: 'Construct a DFA that accepts strings whose binary value is divisible by 3' },
  { label: 'No consecutive ones', query: 'Construct a DFA that accepts strings containing no consecutive ones' },
  { label: 'Length divisible by 3', query: 'Construct a DFA that accepts strings whose length is divisible by 3' },
  { label: 'Regex: (0|1)*01', regex: '(0|1)*01' },
  { label: 'Regex: 0*1*', regex: '0*1*' },
  { label: 'Regex: (01)*', regex: '(01)*' },
]

export function AutomatonEditorStudio() {
  const [automaton, setAutomaton] = useState<Automaton>(() =>
    createBlankAutomaton(false, ['0', '1']),
  )
  const [newStateId, setNewStateId] = useState('')
  const [alphabetInput, setAlphabetInput] = useState('0, 1')
  const [copied, setCopied] = useState<string | null>(null)

  // Simulation state
  const [simInput, setSimInput] = useState('01')
  const [simStep, setSimStep] = useState(0)
  const [simPlaying, setSimPlaying] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reference verification state
  const [refMode, setRefMode] = useState<'preset' | 'custom_nl' | 'custom_regex'>('preset')
  const [selectedRefPreset, setSelectedRefPreset] = useState(REFERENCE_PRESETS[0].label)
  const [customRefNl, setCustomRefNl] = useState('Construct a DFA that accepts strings ending with 01')
  const [customRefRegex, setCustomRefRegex] = useState('(0|1)*01')
  const [verificationResult, setVerificationResult] = useState<ReferenceVerificationResult | null>(null)

  // Table import state
  const [showImportModal, setShowImportModal] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState<string | null>(null)

  // Validation
  const validation: DetailedEditorValidation = useMemo(() => {
    return validateEditorAutomaton(automaton)
  }, [automaton])

  // Simulation
  const trace: DetailedRunResult | null = useMemo(() => {
    if (!validation.hasStart) return null
    return runAutomatonDetailed(automaton, simInput)
  }, [automaton, simInput, validation.hasStart])

  const maxSimStep = trace ? trace.steps.length - 1 : 0
  const currentStep = trace ? trace.steps[Math.min(simStep, maxSimStep)] : null
  const simFinished = simStep >= maxSimStep

  // Autoplay
  useEffect(() => {
    if (!simPlaying) return
    if (simStep >= maxSimStep) {
      setSimPlaying(false)
      return
    }
    timerRef.current = setTimeout(() => setSimStep((s) => s + 1), 750)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [simPlaying, simStep, maxSimStep])

  // Handlers for state & alphabet manipulation
  function handleAddState(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!newStateId.trim()) return
    try {
      const updated = addStateToAutomaton(automaton, newStateId)
      setAutomaton(updated)
      setNewStateId('')
    } catch (err: any) {
      alert(err.message)
    }
  }

  function handleRemoveState(id: string) {
    const updated = removeStateFromAutomaton(automaton, id)
    setAutomaton(updated)
  }

  function handleSetStart(id: string) {
    setAutomaton(setAutomatonStartState(automaton, id))
  }

  function handleToggleAccept(id: string) {
    setAutomaton(toggleAutomatonAcceptState(automaton, id))
  }

  function handleUpdateAlphabet() {
    const symbols = alphabetInput
      .split(/[\s,]+/)
      .map((s) => s.trim().replace(/['"]/g, ''))
      .filter(Boolean)
    if (symbols.length === 0) return
    setAutomaton(setAutomatonAlphabet(automaton, symbols))
  }

  function handleToggleNfaType(toNfa: boolean) {
    setAutomaton(toggleAutomatonNfa(automaton, toNfa))
    setVerificationResult(null)
  }

  function handleCellChange(fromState: string, symbol: string, value: string) {
    const cleanTargets = value
      .replace(/[{}]/g, '')
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    setAutomaton(setAutomatonTransition(automaton, fromState, symbol, cleanTargets))
    setVerificationResult(null)
  }

  function handleCompleteSink() {
    try {
      const completed = completeDfaWithSink(automaton, 'q_sink')
      setAutomaton(completed)
    } catch (err: any) {
      alert(err.message)
    }
  }

  function handleLoadSample(key: string) {
    const sample = SAMPLE_LEARNING_AUTOMATA[key]
    if (sample) {
      setAutomaton(JSON.parse(JSON.stringify(sample.automaton)))
      setAlphabetInput(sample.automaton.alphabet.join(', '))
      setVerificationResult(null)
      setSimStep(0)
    }
  }

  function handleResetBlank(isNfa: boolean) {
    setAutomaton(createBlankAutomaton(isNfa, ['0', '1']))
    setAlphabetInput('0, 1')
    setVerificationResult(null)
    setSimStep(0)
  }

  function handleRunVerification() {
    let refInput:
      | { type: 'automaton'; automaton: Automaton }
      | { type: 'nl_query'; query: string }
      | { type: 'regex'; regex: string }

    if (refMode === 'preset') {
      const preset = REFERENCE_PRESETS.find((p) => p.label === selectedRefPreset)
      if (!preset) return
      if (preset.regex) {
        refInput = { type: 'regex', regex: preset.regex }
      } else {
        refInput = { type: 'nl_query', query: preset.query! }
      }
    } else if (refMode === 'custom_nl') {
      refInput = { type: 'nl_query', query: customRefNl }
    } else {
      refInput = { type: 'regex', regex: customRefRegex }
    }

    const res = verifyAgainstReference(automaton, refInput)
    setVerificationResult(res)
  }

  function handleImportTable() {
    setImportError(null)
    const res = parseTransitionTableText(importText, automaton.nondeterministic)
    if (res.success && res.automaton) {
      setAutomaton(res.automaton)
      setAlphabetInput(res.automaton.alphabet.join(', '))
      setShowImportModal(false)
      setImportText('')
    } else {
      setImportError(res.error || 'Failed to parse transition table.')
    }
  }

  function handleCopy(type: string, text: string) {
    navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const symbolsToDisplay = automaton.nondeterministic
    ? [...automaton.alphabet, EPSILON]
    : automaton.alphabet

  return (
    <div className="space-y-6">
      {/* Studio Header & Learning Presets */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-card p-4 shadow-sm sm:p-5">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-primary">
            Interactive Automaton Studio
          </span>
          <h2 className="font-serif text-2xl font-bold text-foreground">
            Student Automaton Editor & Solution Verifier
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Build your own DFA or NFA, inspect the live diagram, simulate strings, and verify language equivalence against problem targets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 font-mono text-xs"
            onClick={() => handleResetBlank(false)}
          >
            <RotateCcw className="size-3" /> Blank DFA
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 font-mono text-xs"
            onClick={() => handleResetBlank(true)}
          >
            <RotateCcw className="size-3" /> Blank NFA
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 font-mono text-xs"
            onClick={() => setShowImportModal(true)}
          >
            <Upload className="size-3" /> Import Table
          </Button>
        </div>
      </div>

      {/* Quick Sample Automata Pills */}
      <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
        <span>Load sample machines:</span>
        {Object.entries(SAMPLE_LEARNING_AUTOMATA).map(([key, item]) => (
          <button
            key={key}
            onClick={() => handleLoadSample(key)}
            className="rounded-lg border border-border/70 bg-secondary/30 px-2.5 py-1 text-foreground/80 hover:bg-secondary/70 hover:text-foreground"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Configuration Bar: Type and Alphabet */}
      <div className="grid gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm md:grid-cols-2">
        <div className="space-y-2">
          <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Automaton Type
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => handleToggleNfaType(false)}
              className={cn(
                'flex-1 rounded-xl border py-2 font-mono text-xs font-semibold transition-all',
                !automaton.nondeterministic
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/60 text-muted-foreground hover:bg-secondary/40',
              )}
            >
              Deterministic (DFA)
            </button>
            <button
              onClick={() => handleToggleNfaType(true)}
              className={cn(
                'flex-1 rounded-xl border py-2 font-mono text-xs font-semibold transition-all',
                automaton.nondeterministic
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/60 text-muted-foreground hover:bg-secondary/40',
              )}
            >
              Nondeterministic (NFA with ε)
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {!automaton.nondeterministic
              ? 'DFA requires exactly 1 transition per symbol per state when complete.'
              : 'NFA permits 0, 1, or multiple destinations and ε-transitions.'}
          </p>
        </div>

        <div className="space-y-2">
          <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Input Alphabet Σ
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={alphabetInput}
              onChange={(e) => setAlphabetInput(e.target.value)}
              placeholder="e.g. 0, 1 or a, b, c"
              className="flex-1 rounded-xl border border-input bg-background px-3 py-1.5 font-mono text-sm outline-none focus:border-primary"
            />
            <Button size="sm" onClick={handleUpdateAlphabet} className="font-mono text-xs">
              Apply Alphabet
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Current alphabet: {'{'}{automaton.alphabet.join(', ')}{'}'}
          </p>
        </div>
      </div>

      {/* State List Manager */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            State Management ({automaton.states.length} States in Q)
          </span>
          <form onSubmit={handleAddState} className="flex gap-2">
            <input
              type="text"
              value={newStateId}
              onChange={(e) => setNewStateId(e.target.value)}
              placeholder="New state ID, e.g. q2"
              className="h-8 w-36 rounded-lg border border-input bg-background px-2.5 font-mono text-xs outline-none focus:border-primary"
            />
            <Button size="sm" type="submit" className="h-8 gap-1 font-mono text-xs">
              <Plus className="size-3" /> Add State
            </Button>
          </form>
        </div>

        {/* State Badges Grid */}
        <div className="flex flex-wrap gap-2">
          {automaton.states.map((s) => {
            const isStart = s.id === automaton.start
            const isAccept = s.accept
            return (
              <div
                key={s.id}
                className={cn(
                  'flex items-center gap-2 rounded-xl border p-2 font-mono text-xs shadow-sm',
                  isStart ? 'border-primary/60 bg-primary/5' : 'border-border bg-secondary/20',
                )}
              >
                <span className="font-semibold text-foreground">
                  {isStart && <span className="text-primary font-bold">→ </span>}
                  {isAccept && <span className="text-success font-bold">* </span>}
                  {s.id}
                </span>

                <div className="flex items-center gap-1 border-l border-border/80 pl-1.5">
                  <button
                    onClick={() => handleSetStart(s.id)}
                    title={isStart ? 'Initial Start State' : 'Set as Initial Start State'}
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors',
                      isStart ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary/60',
                    )}
                  >
                    Start
                  </button>
                  <button
                    onClick={() => handleToggleAccept(s.id)}
                    title={isAccept ? 'Accepting State (Click to toggle)' : 'Non-accepting (Click to make accepting)'}
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors',
                      isAccept ? 'bg-success text-success-foreground' : 'text-muted-foreground hover:bg-secondary/60',
                    )}
                  >
                    Accept
                  </button>
                  {automaton.states.length > 1 && (
                    <button
                      onClick={() => handleRemoveState(s.id)}
                      title="Delete state"
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Interactive Transition Table Editor */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Transition Function δ: Q × Σ → {automaton.nondeterministic ? 'P(Q)' : 'Q'}
            </span>
            <p className="text-[11px] text-muted-foreground">
              {automaton.nondeterministic
                ? 'Enter comma-separated states (e.g. "q0, q1") or leave blank for ∅.'
                : 'Enter a single target state (e.g. "q1") or leave blank for undefined.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!automaton.nondeterministic && !validation.isCompleteDfa && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 border-accent text-accent hover:bg-accent/10 font-mono text-xs"
                onClick={handleCompleteSink}
              >
                <Sparkles className="size-3.5" /> Auto Complete with Sink
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 font-mono text-xs"
              onClick={() => handleCopy('table', exportTransitionTableText(automaton))}
            >
              <Copy className="size-3" />
              {copied === 'table' ? 'Copied' : 'Copy Table'}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full font-mono text-xs">
            <thead className="bg-secondary/60 text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left">State</th>
                {symbolsToDisplay.map((sym) => (
                  <th key={sym} className="px-4 py-2.5 text-left">
                    δ(·, {sym})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {automaton.states.map((s) => {
                const isStart = s.id === automaton.start
                const isAccept = s.accept
                return (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-4 py-2 text-foreground font-semibold">
                      {isStart && <span className="text-primary font-bold">→ </span>}
                      {isAccept && <span className="text-success font-bold">* </span>}
                      {s.id}
                    </td>
                    {symbolsToDisplay.map((sym) => {
                      const targets = automaton.delta[s.id]?.[sym] ?? []
                      const cellValue = targets.join(', ')
                      return (
                        <td key={sym} className="px-3 py-1.5">
                          <input
                            type="text"
                            value={cellValue}
                            onChange={(e) => handleCellChange(s.id, sym, e.target.value)}
                            placeholder="—"
                            className="w-full min-w-[70px] rounded-md border border-input bg-background px-2.5 py-1 font-mono text-xs outline-none transition-colors focus:border-primary"
                          />
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Diagram & Structural Validation */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* State Transition Diagram */}
        <div className="lg:col-span-2 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-5 py-3">
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Live State-Transition Diagram ({automaton.nondeterministic ? 'NFA' : 'DFA'})
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              Drag / Zoom / Pan supported
            </span>
          </div>
          <div className="bg-grid min-h-[380px] p-2">
            <AutomatonGraph
              automaton={automaton}
              active={currentStep ? currentStep.activeStates : []}
              height={380}
            />
          </div>
        </div>

        {/* Structural Invariant Checklist */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground border-b border-border/80 pb-2">
            <ShieldCheck className="size-4 text-primary" /> Structural Validation
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span>Start state designated:</span>
              <span className={validation.hasStart ? 'text-success font-semibold' : 'text-destructive font-semibold'}>
                {validation.hasStart ? 'Valid (q₀)' : 'Missing'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Accepting states designated:</span>
              <span className={validation.hasAccept ? 'text-success font-semibold' : 'text-amber-500 font-semibold'}>
                {validation.hasAccept ? `${automaton.states.filter((s) => s.accept).length} states` : '0 (Rejects all)'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Determinism check:</span>
              <span className={validation.isDeterministic ? 'text-success font-semibold' : 'text-amber-500 font-semibold'}>
                {validation.isDeterministic ? 'Deterministic' : 'Nondeterministic'}
              </span>
            </div>
            {!automaton.nondeterministic && (
              <div className="flex items-center justify-between">
                <span>DFA completeness:</span>
                <span className={validation.isCompleteDfa ? 'text-success font-semibold' : 'text-amber-500 font-semibold'}>
                  {validation.isCompleteDfa ? 'Complete' : `Missing ${validation.missingTransitions.length} transitions`}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span>Unreachable states:</span>
              <span className={validation.unreachableStates.length === 0 ? 'text-success font-semibold' : 'text-amber-500 font-semibold'}>
                {validation.unreachableStates.length === 0 ? 'None (All reachable)' : `${validation.unreachableStates.length} unreachable`}
              </span>
            </div>
          </div>

          {/* Validation Messages */}
          {validation.errors.length > 0 && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs space-y-1 text-destructive">
              <p className="font-semibold">Errors preventing formal validity:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {validation.errors.map((e, idx) => (
                  <li key={idx}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {validation.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs space-y-1 text-amber-600 dark:text-amber-400">
              <p className="font-semibold">Notices / Suggestions:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {validation.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {validation.valid && (
            <div className="flex items-center gap-2 rounded-xl border border-success/40 bg-success/10 p-3 text-xs text-success">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>Automaton is structurally sound and ready for simulation & reference verification.</span>
            </div>
          )}
        </div>
      </div>

      {/* String Simulator */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Interactive String Simulator ({automaton.nondeterministic ? 'NFA' : 'DFA'})
          </div>
          <span className="font-mono text-xs text-primary">
            Σ = {'{'}{automaton.alphabet.join(', ')}{'}'}
          </span>
        </div>

        <div>
          <input
            type="text"
            value={simInput}
            onChange={(e) => {
              const cleaned = [...e.target.value]
                .filter((c) => automaton.alphabet.includes(c))
                .join('')
              setSimInput(cleaned)
              setSimStep(0)
              setSimPlaying(false)
            }}
            placeholder="Type string to simulate..."
            className="w-full rounded-xl border border-input bg-background px-4 py-2 font-mono text-lg tracking-[0.25em] outline-none focus:border-primary"
          />
        </div>

        {/* Tape ribbon */}
        <div className="flex flex-wrap gap-1">
          {simInput.length === 0 ? (
            <span className="font-mono text-sm text-muted-foreground">
              ε (empty input string)
            </span>
          ) : (
            [...simInput].map((ch, idx) => (
              <span
                key={idx}
                className={cn(
                  'flex size-9 items-center justify-center rounded-md border font-mono text-base font-semibold',
                  currentStep && idx < currentStep.consumed
                    ? 'border-primary/50 bg-primary/15 text-primary'
                    : currentStep && idx === currentStep.consumed
                      ? 'border-accent bg-accent/20 text-accent'
                      : 'border-border bg-muted/40 text-muted-foreground',
                )}
              >
                {ch}
              </span>
            ))
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSimStep(0)}
            title="Reset to start"
          >
            <RotateCcw className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={simStep === 0}
            onClick={() => setSimStep((s) => Math.max(0, s - 1))}
            title="Step backward"
          >
            <SkipBack className="size-3.5" />
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (simFinished) setSimStep(0)
              setSimPlaying((p) => !p)
            }}
          >
            {simPlaying ? (
              <>
                <Pause className="size-3.5" /> Pause
              </>
            ) : (
              <>
                <Play className="size-3.5" /> Step Run
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={simFinished}
            onClick={() => setSimStep((s) => Math.min(maxSimStep, s + 1))}
            title="Step forward"
          >
            <SkipForward className="size-3.5" />
          </Button>
          <span className="font-mono text-xs text-muted-foreground">
            step {simStep}/{maxSimStep}
          </span>
        </div>

        {/* Step details */}
        {currentStep && (
          <div className="space-y-1.5 rounded-xl border border-border bg-secondary/20 p-3">
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-muted-foreground">ACTIVE STATES:</span>
              <span className="flex flex-wrap gap-1 font-semibold text-primary">
                {currentStep.activeStates.length === 0 ? (
                  <span className="text-destructive">∅ (Dead / Rejected)</span>
                ) : (
                  currentStep.activeStates.map((st) => (
                    <span key={st} className="rounded bg-primary/10 px-1.5 py-0.5">
                      {st}
                    </span>
                  ))
                )}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{currentStep.explanation}</p>
          </div>
        )}

        {/* Verdict */}
        {trace && (
          <div
            className={cn(
              'flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium',
              !simFinished
                ? 'border-border bg-muted/30 text-muted-foreground'
                : trace.accepted
                  ? 'border-success/40 bg-success/15 text-success'
                  : 'border-destructive/40 bg-destructive/15 text-destructive',
            )}
          >
            {!simFinished ? (
              'Run the simulation to the end of input to reach final verdict.'
            ) : trace.accepted ? (
              <>
                <Check className="size-4" /> {trace.verdictExplanation}
              </>
            ) : (
              <>
                <X className="size-4" /> {trace.verdictExplanation}
              </>
            )}
          </div>
        )}
      </div>

      {/* Verification Against Reference Solution */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border/80 pb-3">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="size-4 text-primary" /> Formal Reference Verification
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            Checks exact language equivalence (L(Student) = L(Reference))
          </span>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs font-mono">
            <button
              onClick={() => setRefMode('preset')}
              className={cn(
                'rounded-lg px-3 py-1.5 transition-colors',
                refMode === 'preset' ? 'bg-primary text-primary-foreground' : 'bg-secondary/40 text-muted-foreground',
              )}
            >
              Standard Preset Problem
            </button>
            <button
              onClick={() => setRefMode('custom_nl')}
              className={cn(
                'rounded-lg px-3 py-1.5 transition-colors',
                refMode === 'custom_nl' ? 'bg-primary text-primary-foreground' : 'bg-secondary/40 text-muted-foreground',
              )}
            >
              Natural Language Prompt
            </button>
            <button
              onClick={() => setRefMode('custom_regex')}
              className={cn(
                'rounded-lg px-3 py-1.5 transition-colors',
                refMode === 'custom_regex' ? 'bg-primary text-primary-foreground' : 'bg-secondary/40 text-muted-foreground',
              )}
            >
              Regular Expression Target
            </button>
          </div>

          {refMode === 'preset' && (
            <div className="flex flex-wrap gap-1.5">
              {REFERENCE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setSelectedRefPreset(p.label)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1 font-mono text-xs transition-colors',
                    selectedRefPreset === p.label
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/60 bg-secondary/30 text-muted-foreground hover:bg-secondary/70 hover:text-foreground',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {refMode === 'custom_nl' && (
            <div>
              <input
                type="text"
                value={customRefNl}
                onChange={(e) => setCustomRefNl(e.target.value)}
                placeholder="e.g. Construct a DFA accepting strings with an even number of zeros"
                className="w-full rounded-xl border border-input bg-background px-4 py-2 font-mono text-xs outline-none focus:border-primary"
              />
            </div>
          )}

          {refMode === 'custom_regex' && (
            <div>
              <input
                type="text"
                value={customRefRegex}
                onChange={(e) => setCustomRefRegex(e.target.value)}
                placeholder="e.g. (0|1)*01 or 0*1*"
                className="w-full rounded-xl border border-input bg-background px-4 py-2 font-mono text-xs outline-none focus:border-primary"
              />
            </div>
          )}

          {/* Partial DFA Explanatory Notice */}
          {!automaton.nondeterministic && validation.missingTransitions.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/40 bg-accent/10 p-3.5 font-sans text-xs text-foreground/90">
              <div className="space-y-1">
                <p className="font-semibold text-accent">
                  ℹ️ Partial DFA Semantics
                </p>
                <p>
                  Your automaton has <strong>{validation.missingTransitions.length} missing transition(s)</strong>.
                  In formal language equivalence checking, missing transitions are interpreted with <em>implicit rejecting semantics</em> (an implicit sink/dead state).
                  You may test as a partial DFA or convert it into a total DFA with an explicit sink state:
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 border-accent/40 bg-background font-mono text-xs text-accent hover:bg-accent/10"
                onClick={handleCompleteSink}
              >
                Complete with Sink State
              </Button>
            </div>
          )}

          <Button onClick={handleRunVerification} className="gap-2 font-mono text-xs">
            <ShieldCheck className="size-4" /> Compare Against Reference Solution
          </Button>

          {/* Verification Results Card */}
          {verificationResult && (
            <div
              className={cn(
                'mt-4 rounded-xl border p-4 space-y-3 font-mono text-xs',
                verificationResult.equivalent
                  ? 'border-success/40 bg-success/10 text-success dark:text-emerald-400'
                  : 'border-destructive/40 bg-destructive/10 text-destructive dark:text-red-400',
              )}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                {verificationResult.equivalent ? (
                  <>
                    <CheckCircle2 className="size-5" /> Solution Verified: Exact Language Equivalence!
                  </>
                ) : (
                  <>
                    <AlertCircle className="size-5" /> Verification Discrepancy Found
                  </>
                )}
              </div>
              <p className="text-pretty leading-relaxed text-foreground/90 font-sans text-xs">
                {verificationResult.explanation}
              </p>

              {/* Counterexample details if not equivalent */}
              {verificationResult.counterexample !== undefined && (
                <div className="rounded-lg border border-border bg-background p-3 text-xs text-foreground space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-1">
                    <span className="font-semibold text-primary">Distinguishing Counterexample</span>
                    <button
                      onClick={() => {
                        setSimInput(verificationResult.counterexample!)
                        setSimStep(0)
                      }}
                      className="text-xs text-primary underline"
                    >
                      Load into simulator
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <p className="text-muted-foreground">Test String w:</p>
                      <p className="font-bold">
                        {verificationResult.counterexample === '' ? 'ε (empty string)' : `"${verificationResult.counterexample}"`}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Formal Language Verdict:</p>
                      <p>
                        Your Machine:{' '}
                        <strong className={verificationResult.acceptedByStudent ? 'text-success' : 'text-destructive'}>
                          {verificationResult.acceptedByStudent ? 'ACCEPTS' : 'REJECTS'}
                        </strong>
                      </p>
                      <p>
                        Reference Solution:{' '}
                        <strong className={verificationResult.acceptedByReference ? 'text-success' : 'text-destructive'}>
                          {verificationResult.acceptedByReference ? 'ACCEPTS' : 'REJECTS'}
                        </strong>
                      </p>
                    </div>
                  </div>

                  {/* Side-by-side simulation trace breakdown */}
                  <div className="space-y-2 border-t border-border pt-2 font-sans text-xs">
                    <p className="font-semibold text-foreground/90">Trace Execution Comparison on &quot;{verificationResult.counterexample}&quot;:</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded border border-border/80 bg-secondary/30 p-2 font-mono text-[11px]">
                        <p className="font-semibold text-primary">Your Machine Trace:</p>
                        {verificationResult.studentTrace ? (
                          <div className="mt-1 space-y-0.5 text-muted-foreground">
                            {verificationResult.studentTrace.steps.map((st, i) => (
                              <p key={i}>
                                Step {i}: [{st.activeStates.join(', ') || '∅ (Dead)'}]
                              </p>
                            ))}
                            <p className="font-bold text-foreground">
                              Final: {verificationResult.acceptedByStudent ? 'ACCEPTED' : 'REJECTED'}
                            </p>
                          </div>
                        ) : (
                          <p className="text-muted-foreground">No trace available</p>
                        )}
                      </div>

                      <div className="rounded border border-border/80 bg-secondary/30 p-2 font-mono text-[11px]">
                        <p className="font-semibold text-primary">Reference Solution Trace:</p>
                        {verificationResult.referenceTrace ? (
                          <div className="mt-1 space-y-0.5 text-muted-foreground">
                            {verificationResult.referenceTrace.steps.map((st, i) => (
                              <p key={i}>
                                Step {i}: [{st.activeStates.join(', ') || '∅ (Dead)'}]
                              </p>
                            ))}
                            <p className="font-bold text-foreground">
                              Final: {verificationResult.acceptedByReference ? 'ACCEPTED' : 'REJECTED'}
                            </p>
                          </div>
                        ) : (
                          <p className="text-muted-foreground">No trace available</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-bold text-foreground">
                Import Transition Table
              </h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-secondary"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Paste a transition table formatted as CSV, Markdown, or tab-delimited text. Use <code>-&gt;</code> for start state and <code>*</code> for accept states.
            </p>

            <textarea
              rows={8}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={`State, 0, 1\n->q0, q1, q0\n*q1, q1, q2\nq2, q1, q0`}
              className="w-full rounded-xl border border-input bg-background p-3 font-mono text-xs outline-none focus:border-primary"
            />

            {importError && (
              <p className="font-mono text-xs text-destructive">{importError}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowImportModal(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleImportTable}>
                Import Automaton
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
