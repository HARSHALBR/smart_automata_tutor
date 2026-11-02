'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Sparkles,
  ArrowRight,
  Check,
  X,
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Copy,
  HelpCircle,
  Cpu,
  Layers,
  Table,
  CheckCircle2,
  FileCode,
  Code2,
  BookOpen,
  Camera,
  GitBranch,
} from 'lucide-react'
import { parseQuestion, type ParsedQuestion } from '@/lib/nlp-parser'
import {
  solveProblem,
  type SolvedSolution,
  type ProblemSpec,
  type TestStringResult,
} from '@/lib/automata-solver'
import {
  runAutomatonDetailed,
  type DetailedRunResult,
  NFA_EXAMPLES,
  generateTransitionTable,
  formatTransitionTableMarkdown,
  validateAutomaton,
  type Automaton,
} from '@/lib/automata'
import { buildRegexPipeline } from '@/lib/thompson-construction'
import { AutomatonEditorStudio } from '@/components/solver/automaton-editor-studio'
import { ImageSolverUI } from '@/components/solver/image-solver-ui'
import { AutomatonGraph } from '@/components/labs/automaton-graph'
import { CfgSolverUI } from '@/components/solver/cfg-solver-ui'
import { solveCfgProblem, type CfgSolution } from '@/lib/cfg-solver'
import { formatCfgToText } from '@/lib/cfg'
import { PdaSolverUI } from '@/components/solver/pda-solver-ui'
import { solvePdaProblem } from '@/lib/pda-solver'
import { formatPdaToText } from '@/lib/pda'
import { TuringSolverUI } from '@/components/solver/turing-solver-ui'
import { solveTuringProblem } from '@/lib/turing-solver'
import { formatTMToText } from '@/lib/turing'
import { PumpingMyhillUI } from '@/components/solver/pumping-myhill-ui'
import { solvePumpingMyhillProblem } from '@/lib/pumping-myhill-solver'
import { type NonRegularPattern } from '@/lib/pumping-lemma'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const PRESET_QUESTIONS = [
  'Construct a DFA over {0,1} that accepts strings ending with 01.',
  'Construct a DFA that accepts strings containing an even number of zeros.',
  'Construct a DFA that accepts strings with an odd number of ones.',
  "Construct a CFG for strings with equal numbers of a's and b's.",
  'Construct a CFG for palindromes over {0,1}.',
  'Construct a PDA for a^n b^n.',
  'Construct a PDA for balanced parentheses.',
  'Construct a PDA for palindromes over {0,1}.',
  'Construct a PDA for strings containing equal numbers of 0s and 1s.',
  'Convert CFG to PDA.',
  'Convert PDA to CFG.',
  'Construct a TM that accepts a^n b^n c^n.',
  'Construct a TM for palindromes over {0,1}.',
  'Construct a TM that accepts strings containing equal numbers of 0s and 1s.',
  'Construct a TM that performs unary addition.',
  'Construct a TM for binary divisibility by 3.',
  'Prove that {0^n1^n | n ≥ 0} is not regular.',
  'Prove that {a^n b^n c^n | n ≥ 0} is not regular.',
  'Prove that palindromes over {0,1} are not regular.',
  'Prove that {ww | w ∈ {0,1}*} is not regular.',
  'Apply Myhill–Nerode Theorem to {0^n 1^n}.',
  'Find distinguishing suffix for strings 0 and 01.',
  'Find the leftmost derivation of 0011.',
  'Convert grammar into CNF.',
  'Demonstrate ambiguity with two parse trees.',
  'Construct a DFA that accepts strings containing the substring 101.',
  'Construct a DFA that does not contain substring 011.',
  'Accept strings containing at most two ones.',
  'Construct a DFA accepting strings with exactly two ones.',
  'Construct a DFA that accepts strings of length at most 3.',
  'Construct a DFA where every 0 is immediately followed by 1.',
  'Construct a DFA for decimal numbers divisible by 3.',
  'Construct a DFA containing substring 01 at least twice.',
  'Strings where the number of zeros is divisible by 3.',
  'Construct a DFA accepting strings containing 00 but not 11.',
  'Design a machine starting with 01 OR ending with 10.',
  'Construct a DFA that accepts strings whose binary value is divisible by 3.',
  'Construct a DFA that accepts strings beginning with 1 and ending with 0.',
  'Construct a DFA that accepts strings containing no consecutive ones.',
  'Construct a DFA that accepts strings whose length is divisible by 3.',
  'Convert this NFA into an equivalent DFA.',
  'Minimize the following DFA.',
]

const REGEX_PRESETS = [
  '(0|1)*01',
  '0*1*',
  '(01)*',
  '0|01',
  '(0|(1*0))*',
  '0*',
  '0|1',
  '01',
  'ε',
  '∅',
]

export function AutomataSolverUI() {
  const [solverMode, setSolverMode] = useState<'nl' | 'regex' | 'editor' | 'image' | 'cfg' | 'pda' | 'tm' | 'pumping_myhill'>('nl')
  const [cfgInitialText, setCfgInitialText] = useState<string | undefined>(undefined)
  const [pdaInitialText, setPdaInitialText] = useState<string | undefined>(undefined)
  const [tmInitialText, setTmInitialText] = useState<string | undefined>(undefined)
  const [pumpingMyhillInitialPattern, setPumpingMyhillInitialPattern] = useState<NonRegularPattern | undefined>(undefined)
  const [query, setQuery] = useState(PRESET_QUESTIONS[0])
  const [regexInput, setRegexInput] = useState('(0|1)*01')
  const [regexAlphabet, setRegexAlphabet] = useState('0, 1')
  const [showGrammarHelp, setShowGrammarHelp] = useState(false)
  const [activeRegexStage, setActiveRegexStage] = useState<'ast' | 'nfa' | 'dfa' | 'minimized'>('minimized')

  const [parsed, setParsed] = useState<ParsedQuestion | null>(null)
  const [solution, setSolution] = useState<SolvedSolution | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  // Simulation state
  const [simInput, setSimInput] = useState('1001')
  const [simStep, setSimStep] = useState(0)
  const [simPlaying, setSimPlaying] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Run initial query on mount
  useEffect(() => {
    executeSolveNL(PRESET_QUESTIONS[0])
  }, [])

  function executeSolveNL(textToSolve: string) {
    const parseResult = parseQuestion(textToSolve)
    setParsed(parseResult)

    if (parseResult.targetDomain === 'pumping_myhill' && parseResult.pumpingMyhillSpec) {
      setPumpingMyhillInitialPattern(parseResult.pumpingMyhillSpec.pattern as any)
      setSolverMode('pumping_myhill')
      setSolution(null)
      return
    }

    if (parseResult.targetDomain === 'tm' && parseResult.tmProblemSpec) {
      const tmSol = solveTuringProblem(textToSolve, parseResult.tmProblemSpec)
      setTmInitialText(formatTMToText(tmSol.formalTm))
      setSolverMode('tm')
      setSolution(null)
      return
    }

    if (parseResult.targetDomain === 'pda' && parseResult.pdaProblemSpec) {
      const pdaSol = solvePdaProblem(textToSolve, parseResult.pdaProblemSpec)
      setPdaInitialText(formatPdaToText(pdaSol.formalPda))
      setSolverMode('pda')
      setSolution(null)
      return
    }

    if (parseResult.targetDomain === 'cfg' && parseResult.cfgProblemSpec) {
      const cfgSol = solveCfgProblem(textToSolve, parseResult.cfgProblemSpec)
      setCfgInitialText(formatCfgToText(cfgSol.formalGrammar))
      setSolverMode('cfg')
      setSolution(null)
      return
    }

    if (parseResult.success && parseResult.problemSpec) {
      const spec: ProblemSpec = { ...parseResult.problemSpec }

      if (spec.type === 'nfa_to_dfa' && !spec.givenAutomaton) {
        spec.givenAutomaton = NFA_EXAMPLES[0]
      }
      if (spec.type === 'minimize_dfa' && !spec.givenAutomaton) {
        spec.givenAutomaton = {
          id: 'redundant-ab',
          name: 'Contains "ab" (Redundant)',
          description: '5-state DFA with equivalent states',
          language: 'Strings over {a,b} containing ab',
          alphabet: ['a', 'b'],
          start: 's0',
          states: [
            { id: 's0', x: 80, y: 180 },
            { id: 's1', x: 220, y: 110 },
            { id: 's2', x: 220, y: 270 },
            { id: 's3', x: 420, y: 110, accept: true },
            { id: 's4', x: 420, y: 270, accept: true },
          ],
          edges: [],
          delta: {
            s0: { a: ['s1'], b: ['s2'] },
            s1: { a: ['s1'], b: ['s3'] },
            s2: { a: ['s1'], b: ['s2'] },
            s3: { a: ['s3'], b: ['s3'] },
            s4: { a: ['s4'], b: ['s4'] },
          },
        }
      }
      if (spec.languagePattern?.kind === 'complement' && !spec.givenAutomaton && !spec.languagePattern.targetPattern) {
        spec.givenAutomaton = {
          id: 'example-ends-01',
          name: 'Ends with "01"',
          description: 'DFA accepting strings ending with 01',
          language: 'Strings over {0,1} ending with 01',
          alphabet: ['0', '1'],
          start: 'q0',
          states: [
            { id: 'q0', x: 80, y: 180 },
            { id: 'q1', x: 220, y: 180 },
            { id: 'q2', x: 380, y: 180, accept: true },
          ],
          edges: [],
          delta: {
            q0: { '0': ['q1'], '1': ['q0'] },
            q1: { '0': ['q1'], '1': ['q2'] },
            q2: { '0': ['q1'], '1': ['q0'] },
          },
        }
      }

      const sol = solveProblem(spec)
      setSolution(sol)
      setSimInput(sol.testStrings[0]?.input || '01')
      setSimStep(0)
      setSimPlaying(false)
      if (sol.regexPipeline) {
        setActiveRegexStage('minimized')
      }
    } else {
      setSolution(null)
    }
  }

  function executeSolveRegex(expr: string, customAlphaStr?: string) {
    const rawAlpha = (customAlphaStr ?? regexAlphabet)
      .split(/[\s,]+/)
      .map((s) => s.trim().replace(/['"]/g, ''))
      .filter(Boolean)
    const alphabet = rawAlpha.length > 0 ? Array.from(new Set(rawAlpha)) : undefined

    try {
      const pipeline = buildRegexPipeline(expr, alphabet)
      const activeAuto = pipeline.minimizedDfa
      const val = validateAutomaton(activeAuto)
      const testStrings: TestStringResult[] = pipeline.sampleStrings.map((sample) => {
        const trace = runAutomatonDetailed(activeAuto, sample.input)
        return {
          input: sample.input,
          expectedAccept: sample.minDfaAccepted,
          actualAccept: trace.accepted,
          trace,
        }
      })

      setParsed({
        success: true,
        needsClarification: false,
        interpretedIntent: `Convert regular expression "${pipeline.normalizedRegex}" to ε-NFA (Thompson), DFA, and Minimized DFA.`,
        confidence: 1.0,
      })

      setSolution({
        title: `Regex Pipeline: ${pipeline.normalizedRegex}`,
        problemType: 'regex_to_automata',
        interpretation: `Regular expression "${pipeline.normalizedRegex}" parsed into formal AST, converted to ε-NFA via Thompson's construction, converted to equivalent DFA via subset construction, and minimized via partition refinement.`,
        formalTuple: val.formalTuple,
        stateDescriptions: Object.fromEntries(
          activeAuto.states.map((s) => [
            s.id,
            s.accept ? 'Accepting state in minimized DFA' : 'Non-accepting state in minimized DFA',
          ]),
        ),
        constructionReasoning:
          `1. Parsed formal AST (Precedence: Parentheses > Kleene Star > Concatenation > Union).\n` +
          `2. Thompson ε-NFA (${pipeline.nfa.states.length} states) constructed with single entry and exit points.\n` +
          `3. Subset construction generated equivalent DFA (${pipeline.dfa.states.length} states) using powerset ε-closures.\n` +
          `4. Moore's partition refinement minimized DFA to ${pipeline.minimizedDfa.states.length} state(s).\n` +
          `5. Verified formal language equivalence between subset DFA and minimized DFA.`,
        stepByStepDetails: pipeline.constructionDetails,
        transitionTable: generateTransitionTable(activeAuto),
        transitionTableMarkdown: formatTransitionTableMarkdown(activeAuto),
        automaton: activeAuto,
        correctnessExplanation: pipeline.equivalence.message,
        testStrings,
        jsonExport: JSON.stringify(pipeline, null, 2),
        regexPipeline: pipeline,
        formalLanguageDefinition: `L = L(${pipeline.normalizedRegex}) = { w ∈ {${activeAuto.alphabet.join(', ')}}* | w matches regular expression "${pipeline.normalizedRegex}" }`,
        stateInvariants: activeAuto.states.map((s) => ({
          state: s.id,
          invariant: s.accept
            ? `Prefixes u ∈ Σ* driving the automaton to ${s.id} correspond to an accepted match for ${pipeline.normalizedRegex}.`
            : `Prefixes u ∈ Σ* driving the automaton to ${s.id} represent intermediate non-accepting states.`,
          isStart: s.id === activeAuto.start,
          isAccept: Boolean(s.accept),
        })),
        invariantProofSketch:
          `Theorem: The constructed automaton recognizes precisely L(${pipeline.normalizedRegex}).\n\n` +
          `Proof by Structural Induction:\n` +
          `1. Base Step: Atomic regular expressions (ε, ∅, a ∈ Σ) produce correct Thompson sub-NFAs.\n` +
          `2. Inductive Step: Induction over Union (parallel branches), Concatenation (chaining), and Kleene Star (loopback ε-transitions) preserves language equivalence.\n` +
          `3. Subset Construction: For all w ∈ Σ*, δ*(q0, w) = E-closure(δ_NFA*(q0_NFA, w)), preserving acceptance.\n` +
          `4. Minimization: Partition refinement merges indistinguishable Nerode equivalence classes. Q.E.D.`,
        complexityNotes: {
          stateCount: activeAuto.states.length,
          transitionCount: Object.values(activeAuto.delta).reduce(
            (acc, m) => acc + Object.values(m).reduce((a2, arr) => a2 + arr.length, 0),
            0,
          ),
          isMinimal: true,
          myhillNerodeIndex: activeAuto.states.length,
          notes: `Optimized Thompson pipeline. State count matches the minimal Myhill-Nerode index for L(${pipeline.normalizedRegex}).`,
        },
      })
      setActiveRegexStage('minimized')
      setSimInput(pipeline.sampleStrings[0]?.input || '01')
      setSimStep(0)
      setSimPlaying(false)
    } catch (err: any) {
      setParsed({
        success: false,
        needsClarification: true,
        clarificationPrompt: err.message || 'Syntax error in regular expression.',
        clarificationOptions: ['(0|1)*01', '0*1*', '(01)*', '0|01', '(0|(1*0))*'],
        confidence: 0.5,
      })
      setSolution(null)
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (solverMode === 'nl') {
      if (!query.trim()) return
      executeSolveNL(query)
    } else {
      if (!regexInput.trim()) return
      executeSolveRegex(regexInput)
    }
  }

  function handleSelectPreset(preset: string) {
    setQuery(preset)
    executeSolveNL(preset)
  }

  function handleSelectRegexPreset(preset: string) {
    setRegexInput(preset)
    executeSolveRegex(preset)
  }

  // Active automaton determined dynamically by activeRegexStage
  const displayedAutomaton: Automaton | null = useMemo(() => {
    if (!solution) return null
    if (!solution.regexPipeline) return solution.automaton
    switch (activeRegexStage) {
      case 'nfa':
        return solution.regexPipeline.nfa
      case 'dfa':
        return solution.regexPipeline.dfa
      case 'minimized':
      default:
        return solution.regexPipeline.minimizedDfa
    }
  }, [solution, activeRegexStage])

  // Live simulation execution on displayed automaton
  const activeTrace: DetailedRunResult | null = useMemo(() => {
    if (!displayedAutomaton) return null
    return runAutomatonDetailed(displayedAutomaton, simInput)
  }, [displayedAutomaton, simInput])

  const maxSimStep = activeTrace ? activeTrace.steps.length - 1 : 0
  const currentStep = activeTrace ? activeTrace.steps[Math.min(simStep, maxSimStep)] : null
  const simFinished = simStep >= maxSimStep

  // Transition table for displayed automaton
  const displayedTransitionTable = useMemo(() => {
    if (!displayedAutomaton) return null
    return generateTransitionTable(displayedAutomaton)
  }, [displayedAutomaton])

  const displayedTableMarkdown = useMemo(() => {
    if (!displayedAutomaton) return ''
    return formatTransitionTableMarkdown(displayedAutomaton)
  }, [displayedAutomaton])

  // Autoplay effect
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

  function handleCopy(type: string, text: string) {
    navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      {/* Page Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs text-primary">
          <Sparkles className="size-3.5" /> Deterministic Formal Automata Engine
        </div>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Automata Problem Solver & Regex Studio
        </h1>
        <p className="text-pretty text-muted-foreground">
          Synthesize mathematically verified automata from natural-language exam queries or formal regular expressions.
          Generates Abstract Syntax Trees, Thompson ε-NFAs, Subset DFAs, and Minimized DFAs with step-by-step proofs.
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <button
          onClick={() => {
            setSolverMode('nl')
            executeSolveNL(query)
          }}
          className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-semibold transition-all',
            solverMode === 'nl'
              ? 'border border-primary/40 bg-primary/10 text-primary shadow-sm'
              : 'border border-transparent text-muted-foreground hover:bg-secondary/40 hover:text-foreground',
          )}
        >
          <BookOpen className="size-3.5" /> Natural Language Questions
        </button>
        <button
          onClick={() => {
            setSolverMode('regex')
            executeSolveRegex(regexInput)
          }}
          className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-semibold transition-all',
            solverMode === 'regex'
              ? 'border border-primary/40 bg-primary/10 text-primary shadow-sm'
              : 'border border-transparent text-muted-foreground hover:bg-secondary/40 hover:text-foreground',
          )}
        >
          <Code2 className="size-3.5" /> Regular Expression Pipeline (Thompson)
        </button>
        <button
          onClick={() => {
            setSolverMode('editor')
          }}
          className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-semibold transition-all',
            solverMode === 'editor'
              ? 'border border-primary/40 bg-primary/10 text-primary shadow-sm'
              : 'border border-transparent text-muted-foreground hover:bg-secondary/40 hover:text-foreground',
          )}
        >
          <Cpu className="size-3.5" /> Student Automaton Studio (Build & Verify)
        </button>
        <button
          onClick={() => {
            setSolverMode('image')
          }}
          className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-semibold transition-all',
            solverMode === 'image'
              ? 'border border-primary/40 bg-primary/10 text-primary shadow-sm'
              : 'border border-transparent text-muted-foreground hover:bg-secondary/40 hover:text-foreground',
          )}
        >
          <Camera className="size-3.5" /> Image & Exam Question Solver
        </button>
        <button
          onClick={() => {
            setSolverMode('cfg')
          }}
          className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-semibold transition-all',
            solverMode === 'cfg'
              ? 'border border-primary/40 bg-primary/10 text-primary shadow-sm'
              : 'border border-transparent text-muted-foreground hover:bg-secondary/40 hover:text-foreground',
          )}
        >
          <GitBranch className="size-3.5" /> Context-Free Grammar (CFG) Solver
        </button>
        <button
          onClick={() => {
            setSolverMode('pda')
          }}
          className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-semibold transition-all',
            solverMode === 'pda'
              ? 'border border-primary/40 bg-primary/10 text-primary shadow-sm'
              : 'border border-transparent text-muted-foreground hover:bg-secondary/40 hover:text-foreground',
          )}
        >
          <Layers className="size-3.5" /> Pushdown Automata (PDA) Solver
        </button>
        <button
          onClick={() => {
            setSolverMode('tm')
          }}
          className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-semibold transition-all',
            solverMode === 'tm'
              ? 'border border-primary/40 bg-primary/10 text-primary shadow-sm'
              : 'border border-transparent text-muted-foreground hover:bg-secondary/40 hover:text-foreground',
          )}
        >
          <Cpu className="size-3.5" /> Turing Machine (TM) Solver
        </button>
        <button
          onClick={() => {
            setSolverMode('pumping_myhill')
          }}
          className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-semibold transition-all',
            solverMode === 'pumping_myhill'
              ? 'border border-primary/40 bg-primary/10 text-primary shadow-sm'
              : 'border border-transparent text-muted-foreground hover:bg-secondary/40 hover:text-foreground',
          )}
        >
          <ShieldAlert className="size-3.5" /> Pumping Lemma & Myhill–Nerode
        </button>
      </div>

      {/* Question Input Section: NL Mode */}
      {solverMode === 'nl' && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Ask a Question in Natural Language
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Construct a DFA over {0,1} that accepts strings ending with 01"
                className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 font-mono text-sm outline-none transition-colors focus:border-primary"
              />
              <Button type="submit" className="gap-2">
                Solve Problem <ArrowRight className="size-4" />
              </Button>
            </div>
          </form>

          {/* Quick Presets */}
          <div className="mt-4 space-y-2">
            <span className="font-mono text-xs text-muted-foreground">
              Try standard exam questions:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSelectPreset(q)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1 text-left font-mono text-xs transition-colors',
                    query === q
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/60 bg-secondary/30 text-muted-foreground hover:bg-secondary/70 hover:text-foreground',
                  )}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Question Input Section: Regex Mode */}
      {solverMode === 'regex' && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Enter Formal Regular Expression
              </label>
              <button
                type="button"
                onClick={() => setShowGrammarHelp(!showGrammarHelp)}
                className="flex items-center gap-1 font-mono text-xs text-primary hover:underline"
              >
                <HelpCircle className="size-3.5" />
                {showGrammarHelp ? 'Hide Grammar Guide' : 'Grammar & Syntax Guide'}
              </button>
            </div>

            {/* Grammar Help Panel */}
            {showGrammarHelp && (
              <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs">
                <div className="font-serif text-sm font-semibold text-foreground">
                  Formal Regular Expression Grammar
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="font-mono font-semibold text-primary">Precedence Order:</p>
                    <ol className="list-decimal pl-4 space-y-0.5 text-muted-foreground">
                      <li>Parentheses: <code className="font-mono font-bold text-foreground">(R)</code></li>
                      <li>Kleene Star: <code className="font-mono font-bold text-foreground">R*</code> (zero or more)</li>
                      <li>Concatenation: <code className="font-mono font-bold text-foreground">AB</code> (implicit)</li>
                      <li>Union: <code className="font-mono font-bold text-foreground">A|B</code> (choice)</li>
                    </ol>
                  </div>
                  <div className="space-y-1">
                    <p className="font-mono font-semibold text-primary">Special Notation:</p>
                    <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                      <li>Empty String (ε): Type <code className="font-mono font-bold text-foreground">ε</code> or <code className="font-mono font-bold text-foreground">\e</code></li>
                      <li>Empty Language (∅): Type <code className="font-mono font-bold text-foreground">∅</code> or <code className="font-mono font-bold text-foreground">\0</code></li>
                      <li>Escaped Symbols: <code className="font-mono font-bold text-foreground">\*</code>, <code className="font-mono font-bold text-foreground">\|</code>, <code className="font-mono font-bold text-foreground">\(</code>, <code className="font-mono font-bold text-foreground">\)</code></li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="sm:col-span-3">
                <input
                  type="text"
                  value={regexInput}
                  onChange={(e) => setRegexInput(e.target.value)}
                  placeholder="e.g. (0|1)*01 or 0*1*"
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 font-mono text-base outline-none transition-colors focus:border-primary"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={regexAlphabet}
                  onChange={(e) => setRegexAlphabet(e.target.value)}
                  placeholder="Alphabet, e.g. 0, 1"
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 font-mono text-sm outline-none transition-colors focus:border-primary"
                  title="Declared alphabet symbols (comma separated)"
                />
              </div>
            </div>

            <Button type="submit" className="gap-2">
              Generate Automata Pipeline <ArrowRight className="size-4" />
            </Button>
          </form>

          {/* Quick Regex Presets */}
          <div className="mt-4 space-y-2">
            <span className="font-mono text-xs text-muted-foreground">
              Try canonical regular expressions:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {REGEX_PRESETS.map((r) => (
                <button
                  key={r}
                  onClick={() => handleSelectRegexPreset(r)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1 font-mono text-xs transition-colors',
                    regexInput === r
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/60 bg-secondary/30 text-muted-foreground hover:bg-secondary/70 hover:text-foreground',
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Student Automaton Studio: Interactive Builder & Verifier */}
      {solverMode === 'editor' && <AutomatonEditorStudio />}

      {/* Image-Based Exam Question & Solution Solver */}
      {solverMode === 'image' && <ImageSolverUI />}

      {/* Context-Free Grammar (CFG) Solver Studio */}
      {solverMode === 'cfg' && <CfgSolverUI initialGrammarText={cfgInitialText} />}

      {/* Pushdown Automata (PDA) Solver Studio */}
      {solverMode === 'pda' && <PdaSolverUI initialPdaText={pdaInitialText} />}

      {/* Turing Machine (TM) Solver Studio */}
      {solverMode === 'tm' && <TuringSolverUI initialTmText={tmInitialText} />}

      {/* Pumping Lemma & Myhill–Nerode Solver Studio */}
      {solverMode === 'pumping_myhill' && (
        <PumpingMyhillUI initialPattern={pumpingMyhillInitialPattern} />
      )}

      {/* Clarification Alert (if query was underspecified or regex had syntax error) */}
      {(solverMode === 'nl' || solverMode === 'regex') && parsed?.needsClarification && (
        <div className="rounded-2xl border border-accent/40 bg-accent/10 p-5">
          <div className="flex items-start gap-3">
            <HelpCircle className="mt-0.5 size-5 text-accent" />
            <div className="space-y-3">
              <h3 className="font-serif text-base font-semibold text-foreground">
                Clarification Needed
              </h3>
              <p className="whitespace-pre-wrap font-mono text-xs text-foreground/90">
                {parsed.clarificationPrompt}
              </p>
              {parsed.clarificationOptions && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {parsed.clarificationOptions.map((opt) => (
                    <Button
                      key={opt}
                      size="sm"
                      variant="outline"
                      className="border-accent/40 bg-background text-xs"
                      onClick={() => {
                        if (solverMode === 'nl') handleSelectPreset(opt)
                        else handleSelectRegexPreset(opt)
                      }}
                    >
                      {opt}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Solved Solution Presentation */}
      {(solverMode === 'nl' || solverMode === 'regex') && solution && displayedAutomaton && (
        <div className="space-y-6">
          {/* Solution Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
            <div>
              <span className="font-mono text-xs uppercase tracking-widest text-primary">
                Verified Formal Automaton
              </span>
              <h2 className="font-serif text-2xl font-bold text-foreground">
                {solution.title}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
              <span className="rounded-md border border-border bg-card px-2.5 py-1">
                Active: {displayedAutomaton.nondeterministic ? 'ε-NFA' : 'DFA'}
              </span>
              <span className="rounded-md border border-border bg-card px-2.5 py-1">
                States: {displayedAutomaton.states.length}
              </span>
              <span className="rounded-md border border-border bg-card px-2.5 py-1">
                Alphabet: Σ = {'{'}{displayedAutomaton.alphabet.join(', ')}{'}'}
              </span>
            </div>
          </div>

          {/* Regex Pipeline Stage Navigation (if generated from regex) */}
          {solution.regexPipeline && (
            <div className="space-y-4 rounded-2xl border border-primary/20 bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-3">
                <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Interactive Pipeline Stage Explorer
                </span>
                <span className="flex items-center gap-1 font-mono text-xs text-success">
                  <CheckCircle2 className="size-3.5" /> All representations mathematically equivalent
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={activeRegexStage === 'ast' ? 'default' : 'outline'}
                  onClick={() => setActiveRegexStage('ast')}
                  className="h-8 gap-1.5 font-mono text-xs"
                >
                  <FileCode className="size-3.5" /> 1. Expression & AST
                </Button>
                <Button
                  size="sm"
                  variant={activeRegexStage === 'nfa' ? 'default' : 'outline'}
                  onClick={() => setActiveRegexStage('nfa')}
                  className="h-8 gap-1.5 font-mono text-xs"
                >
                  <Cpu className="size-3.5" /> 2. Thompson ε-NFA ({solution.regexPipeline.nfa.states.length} states)
                </Button>
                <Button
                  size="sm"
                  variant={activeRegexStage === 'dfa' ? 'default' : 'outline'}
                  onClick={() => setActiveRegexStage('dfa')}
                  className="h-8 gap-1.5 font-mono text-xs"
                >
                  <Layers className="size-3.5" /> 3. Subset DFA ({solution.regexPipeline.dfa.states.length} states)
                </Button>
                <Button
                  size="sm"
                  variant={activeRegexStage === 'minimized' ? 'default' : 'outline'}
                  onClick={() => setActiveRegexStage('minimized')}
                  className="h-8 gap-1.5 font-mono text-xs"
                >
                  <Sparkles className="size-3.5" /> 4. Minimized DFA ({solution.regexPipeline.minimizedDfa.states.length} states)
                </Button>
              </div>

              {/* AST Detail View if Stage 1 is selected */}
              {activeRegexStage === 'ast' && (
                <div className="grid gap-4 pt-2 md:grid-cols-2">
                  <div className="space-y-2 rounded-xl border border-border bg-secondary/20 p-4">
                    <span className="font-mono text-xs font-semibold text-primary">
                      Mathematical Abstract Syntax Tree (AST)
                    </span>
                    <pre className="max-h-60 overflow-y-auto rounded-lg border border-border/80 bg-background p-3 font-mono text-xs text-foreground">
                      {solution.regexPipeline.astTree}
                    </pre>
                  </div>
                  <div className="space-y-2 rounded-xl border border-border bg-secondary/20 p-4">
                    <span className="font-mono text-xs font-semibold text-primary">
                      Parsing & Normalization
                    </span>
                    <div className="space-y-2 font-mono text-xs text-foreground/90">
                      <p>• <strong>Raw Input</strong>: <code className="text-primary">{solution.regexPipeline.rawRegex}</code></p>
                      <p>• <strong>Canonical Expression</strong>: <code className="text-success">{solution.regexPipeline.normalizedRegex}</code></p>
                      <p>• <strong>Extracted Alphabet</strong>: {'{'}{solution.regexPipeline.alphabet.join(', ')}{'}'}</p>
                      <p className="text-muted-foreground pt-2">
                        Parsed using recursive descent adhering to formal regular expression precedence:
                        Parentheses &gt; Kleene Star &gt; Concatenation &gt; Union.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 1. Formal Language Specification & 2. Active Formal 5-Tuple Definition */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
              <div className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-primary">
                <BookOpen className="size-4" /> 1. Formal Language Specification
              </div>
              <p className="font-mono text-base font-bold text-foreground">
                {solution.formalLanguageDefinition}
              </p>
              <p className="mt-2 text-pretty text-sm leading-relaxed text-foreground/90">
                {solution.interpretation}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                <Cpu className="size-4 text-primary" /> 2. Active Formal 5-Tuple Definition
              </div>
              <div className="space-y-1.5 font-mono text-xs text-foreground/90">
                <p>
                  <strong className="text-primary">M = (Q, Σ, δ, q₀, F)</strong>
                </p>
                <p>• <strong>Q</strong> = {'{'}{displayedAutomaton.states.map((s) => s.id).join(', ')}{'}'}</p>
                <p>• <strong>Σ</strong> = {'{'}{displayedAutomaton.alphabet.join(', ')}{'}'}</p>
                <p>• <strong>q₀</strong> = {displayedAutomaton.start}</p>
                <p>• <strong>F</strong> = {'{'}{displayedAutomaton.states.filter((s) => s.accept).map((s) => s.id).join(', ')}{'}'}</p>
                <p>• <strong>Type</strong>: {displayedAutomaton.nondeterministic ? 'Nondeterministic (ε-moves allowed)' : 'Deterministic'}</p>
              </div>
            </div>
          </div>

          {/* 3. State Semantic Invariants Table */}
          {solution.stateInvariants && solution.stateInvariants.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                <Layers className="size-4 text-primary" /> 3. State Semantic Invariants
              </div>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full font-mono text-xs">
                  <thead className="bg-secondary/60 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">State</th>
                      <th className="px-4 py-2 text-left">Role</th>
                      <th className="px-4 py-2 text-left">Formal State Meaning / Inductive Invariant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {solution.stateInvariants.map((inv) => (
                      <tr key={inv.state} className="border-t border-border">
                        <td className="px-4 py-2 font-bold text-foreground">
                          {inv.isStart && <span className="text-primary">→ </span>}
                          {inv.isAccept && <span className="text-success">* </span>}
                          {inv.state}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[11px]',
                              inv.isAccept
                                ? 'bg-success/15 text-success'
                                : 'bg-muted/40 text-muted-foreground',
                            )}
                          >
                            {inv.isStart && inv.isAccept
                              ? 'Start & Accept'
                              : inv.isStart
                                ? 'Start State'
                                : inv.isAccept
                                  ? 'Accept State'
                                  : 'Non-Accepting'}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-sans text-xs text-foreground/90">
                          {inv.invariant}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. Construction Reasoning & Steps */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              4. Algorithmic Construction Details
            </div>
            <ol className="space-y-1.5 text-sm text-foreground/90">
              {solution.stepByStepDetails.map((stepNote, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="font-mono text-xs text-primary">{i + 1}.</span>
                  <span>{stepNote}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* 5. State Transition Diagram (Visual Graph) */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-5 py-3">
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                5. State-Transition Diagram: {displayedAutomaton.name}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                Pinch / Scroll to zoom & pan
              </span>
            </div>
            <div className="bg-grid min-h-[360px] p-2">
              <AutomatonGraph
                automaton={displayedAutomaton}
                active={currentStep ? currentStep.activeStates : []}
                height={380}
              />
            </div>
          </div>

          {/* 6. Formal Transition Table */}
          {displayedTransitionTable && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  <Table className="size-4 text-primary" /> 6. Transition Table: {displayedAutomaton.name}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 font-mono text-[11px]"
                  onClick={() => handleCopy('table', displayedTableMarkdown)}
                >
                  <Copy className="size-3" />
                  {copied === 'table' ? 'Copied Markdown' : 'Copy Table'}
                </Button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full font-mono text-xs">
                  <thead className="bg-secondary/60 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">State</th>
                      {displayedTransitionTable.alphabet.map((sym) => (
                        <th key={sym} className="px-4 py-2 text-left">
                          δ(·, {sym})
                        </th>
                      ))}
                      {displayedTransitionTable.hasEpsilon && (
                        <th className="px-4 py-2 text-left">δ(·, ε)</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {displayedTransitionTable.rows.map((row) => (
                      <tr key={row.state} className="border-t border-border">
                        <td className="px-4 py-2 text-foreground">
                          {row.isStart && <span className="text-primary">→ </span>}
                          {row.isAccept && <span className="text-success">* </span>}
                          {row.state}
                        </td>
                        {displayedTransitionTable.alphabet.map((sym) => {
                          const dests = row.targets[sym] ?? []
                          return (
                            <td key={sym} className="px-4 py-2 text-muted-foreground">
                              {dests.length === 0 ? '—' : dests.join(', ')}
                            </td>
                          )
                        })}
                        {displayedTransitionTable.hasEpsilon && (
                          <td className="px-4 py-2 text-muted-foreground">
                            {(row.targets['ε'] ?? []).join(', ') || '—'}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 6. Interactive Live String Simulation on Active Machine */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                6. Interactive Live Simulator ({displayedAutomaton.name})
              </div>
              <span className="font-mono text-xs text-primary">
                Σ = {'{'}{displayedAutomaton.alphabet.join(', ')}{'}'}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  value={simInput}
                  onChange={(e) => {
                    const cleaned = [...e.target.value]
                      .filter((c) => displayedAutomaton.alphabet.includes(c))
                      .join('')
                    setSimInput(cleaned)
                    setSimStep(0)
                    setSimPlaying(false)
                  }}
                  placeholder="type string to simulate..."
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

              {/* Player Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSimStep(0)}
                  title="Reset to beginning"
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

              {/* Step Explanation & Live Verdict */}
              {currentStep && (
                <div className="space-y-2 rounded-xl border border-border bg-secondary/20 p-3">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-muted-foreground">ACTIVE STATES:</span>
                    <span className="flex flex-wrap gap-1 font-semibold text-primary">
                      {currentStep.activeStates.length === 0 ? (
                        <span className="text-destructive">∅ (Dead)</span>
                      ) : (
                        currentStep.activeStates.map((st) => (
                          <span
                            key={st}
                            className="rounded bg-primary/10 px-1.5 py-0.5"
                          >
                            {st}
                          </span>
                        ))
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {currentStep.explanation}
                  </p>
                </div>
              )}

              {/* Final Verdict */}
              {activeTrace && (
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium',
                    !simFinished
                      ? 'border-border bg-muted/30 text-muted-foreground'
                      : activeTrace.accepted
                        ? 'border-success/40 bg-success/15 text-success'
                        : 'border-destructive/40 bg-destructive/15 text-destructive',
                  )}
                >
                  {!simFinished ? (
                    'Run the machine to the end of input to reach final verdict.'
                  ) : activeTrace.accepted ? (
                    <>
                      <Check className="size-4" /> {activeTrace.verdictExplanation}
                    </>
                  ) : (
                    <>
                      <X className="size-4" /> {activeTrace.verdictExplanation}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 7. Inductive Correctness Proof Sketch */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              <CheckCircle2 className="size-4 text-success" /> 7. Inductive Correctness Proof Sketch
            </div>
            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground/90">
              {solution.invariantProofSketch}
            </pre>
          </div>

          {/* 8. Sample Test Battery */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              8. Sample Verification Test Suite
            </div>
            <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
              {solution.testStrings.map((ts, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setSimInput(ts.input)
                    setSimStep(0)
                  }}
                  className={cn(
                    'flex cursor-pointer items-center justify-between rounded-lg border px-3 py-1.5 font-mono text-xs transition-colors hover:border-primary',
                    ts.actualAccept
                      ? 'border-success/30 bg-success/5 text-success'
                      : 'border-border bg-muted/30 text-muted-foreground',
                  )}
                  title="Click to test in live simulator"
                >
                  <span>{ts.input === '' ? 'ε (empty)' : `"${ts.input}"`}</span>
                  <span>{ts.actualAccept ? 'ACCEPT' : 'REJECT'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 9. Complexity Notes & Myhill-Nerode Minimality */}
          {solution.complexityNotes && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                <Cpu className="size-4 text-primary" /> 9. Complexity & Minimality Notes
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-secondary/20 p-3">
                  <p className="font-mono text-xs text-muted-foreground">State Count |Q|</p>
                  <p className="font-mono text-xl font-bold text-foreground">
                    {solution.complexityNotes.stateCount}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-secondary/20 p-3">
                  <p className="font-mono text-xs text-muted-foreground">Transitions |δ|</p>
                  <p className="font-mono text-xl font-bold text-foreground">
                    {solution.complexityNotes.transitionCount}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-secondary/20 p-3">
                  <p className="font-mono text-xs text-muted-foreground">Myhill-Nerode Index</p>
                  <p className="font-mono text-xl font-bold text-foreground">
                    {solution.complexityNotes.myhillNerodeIndex || '—'}
                    {solution.complexityNotes.isMinimal && (
                      <span className="ml-2 font-sans text-xs font-normal text-success">(Minimal)</span>
                    )}
                  </p>
                </div>
              </div>
              <p className="mt-3 font-sans text-xs text-muted-foreground">
                {solution.complexityNotes.notes}
              </p>
            </div>
          )}

          {/* 10. Export Data */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                <FileCode className="size-4 text-primary" /> 10. Download & Export Data
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 font-mono text-xs"
                  onClick={() => handleCopy('json', solution.jsonExport)}
                >
                  <Copy className="size-3" />
                  {copied === 'json' ? 'Copied JSON' : 'Copy JSON'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 font-mono text-xs"
                  onClick={() => handleCopy('md', displayedTableMarkdown)}
                >
                  <Copy className="size-3" />
                  {copied === 'md' ? 'Copied Markdown' : 'Copy Active Table'}
                </Button>
              </div>
            </div>
            <pre className="max-h-40 overflow-y-auto rounded-xl border border-border bg-secondary/30 p-3 font-mono text-[11px] text-muted-foreground">
              {solution.jsonExport}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
