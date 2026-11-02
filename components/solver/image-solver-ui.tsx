'use client'

import { useState, useRef, useMemo } from 'react'
import {
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Info,
  Check,
  X,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  HelpCircle,
  Cpu,
  Table as TableIcon,
  Code2,
  BookOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  type ImageRecognitionResult,
  type ImageExtractionCategory,
  type ExtractedState,
  type ExtractedTransition,
  type ExtractedAutomatonData,
  MAX_IMAGE_FILE_SIZE,
  validateImageFile,
} from '@/lib/image-recognition/types'
import { reconstructAutomatonFromExtraction } from '@/lib/image-recognition/reconstruction'
import { SAMPLE_IMAGE_PRESETS, type ImageSamplePreset } from '@/lib/image-recognition/sample-presets'
import { solveProblem, type SolvedSolution } from '@/lib/automata-solver'
import { parseQuestion } from '@/lib/nlp-parser'
import {
  type Automaton,
  runAutomatonDetailed,
  type DetailedRunResult,
  generateTransitionTable,
  formatTransitionTableMarkdown,
} from '@/lib/automata'
import { verifyAgainstReference, type ReferenceVerificationResult } from '@/lib/automata-editor'
import { AutomatonGraph } from '@/components/labs/automaton-graph'

export function ImageSolverUI() {
  // Step 1: Upload state
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [imageMeta, setImageMeta] = useState<{ name: string; size: number; type: string } | null>(null)
  const [userConsent, setUserConsent] = useState(true)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisStep, setAnalysisStep] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Step 2: Confirmation / Review state
  const [recognitionResult, setRecognitionResult] = useState<ImageRecognitionResult | null>(null)
  const [editedCategory, setEditedCategory] = useState<ImageExtractionCategory>('text_question')
  const [editedPrompt, setEditedPrompt] = useState<string>('')
  const [editedAlphabet, setEditedAlphabet] = useState<string>('0, 1')
  const [editedTargetType, setEditedTargetType] = useState<'DFA' | 'NFA'>('DFA')
  const [editedStates, setEditedStates] = useState<ExtractedState[]>([])
  const [editedTransitions, setEditedTransitions] = useState<ExtractedTransition[]>([])
  const [intendedLanguage, setIntendedLanguage] = useState<string>('')

  // Step 3: Solved state
  const [solvedStep, setSolvedStep] = useState<'idle' | 'analyzing' | 'review' | 'solved'>('idle')
  const [questionSolution, setQuestionSolution] = useState<SolvedSolution | null>(null)
  const [reconstructedAuto, setReconstructedAuto] = useState<Automaton | null>(null)
  const [verificationResult, setVerificationResult] = useState<ReferenceVerificationResult | null>(null)

  // Simulator state for reconstructed/verified automaton
  const [simInput, setSimInput] = useState('01')
  const [simStep, setSimStep] = useState(0)

  // File selection handler
  function handleFileSelected(file: File) {
    setUploadError(null)
    const validation = validateImageFile(file.size, file.type)
    if (!validation.valid) {
      setUploadError(validation.error || 'Invalid file.')
      return
    }

    setImageMeta({
      name: file.name,
      size: file.size,
      type: file.type,
    })

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setSelectedImage(result)
    }
    reader.readAsDataURL(file)
  }

  // Preset selector
  function handleSelectPreset(preset: ImageSamplePreset) {
    setUploadError(null)
    setSelectedImage(preset.svgDataUrl)
    setImageMeta({
      name: `${preset.id}.svg`,
      size: 4096,
      type: 'image/svg+xml',
    })
    populateConfirmationFromExtraction(preset.extraction)
  }

  function populateConfirmationFromExtraction(result: ImageRecognitionResult) {
    setRecognitionResult(result)
    setEditedCategory(result.category)

    if (result.category === 'text_question' && result.questionData) {
      setEditedPrompt(result.questionData.prompt)
      setEditedAlphabet((result.questionData.alphabet || ['0', '1']).join(', '))
      setEditedTargetType(result.questionData.suggestedType === 'nfa' ? 'NFA' : 'DFA')
    } else if (result.category === 'transition_table' || result.category === 'diagram') {
      const autoData = result.automatonData
      if (autoData) {
        setEditedAlphabet(autoData.alphabet.join(', '))
        setEditedStates(autoData.states)
        setEditedTransitions(autoData.transitions)
        setEditedTargetType(autoData.isNfa ? 'NFA' : 'DFA')
      }
    } else if (result.category === 'student_solution') {
      const sol = result.studentSolutionData
      if (sol) {
        setEditedAlphabet(sol.automaton.alphabet.join(', '))
        setEditedStates(sol.automaton.states)
        setEditedTransitions(sol.automaton.transitions)
        setEditedTargetType(sol.automaton.isNfa ? 'NFA' : 'DFA')
        setIntendedLanguage(sol.intendedLanguagePrompt || 'Construct a DFA over {0,1} that accepts strings ending with 01.')
      }
    }
    setSolvedStep('review')
  }

  // Trigger server-side analysis
  async function handleAnalyzeImage() {
    if (!selectedImage) return
    if (!userConsent) {
      setUploadError('Please review and accept the privacy disclosure before proceeding.')
      return
    }

    setIsAnalyzing(true)
    setSolvedStep('analyzing')
    setAnalysisStep('Auditing image dimensions and encoding...')

    try {
      setTimeout(() => setAnalysisStep('Extracting diagram topology, states, and formal symbols...'), 600)
      setTimeout(() => setAnalysisStep('Auditing state transitions and checking invariants...'), 1200)

      const res = await fetch('/api/vision/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: selectedImage,
          mimeType: imageMeta?.type || 'image/png',
        }),
      })

      const data: ImageRecognitionResult = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to extract information from image.')
      }

      populateConfirmationFromExtraction(data)
    } catch (err: any) {
      setUploadError(err.message || 'Image recognition failed. Please try a clearer photo or enter details manually.')
      setSolvedStep('idle')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Execution after confirmation
  function handleExecuteConfirmedSolver() {
    if (editedCategory === 'text_question') {
      const parsed = parseQuestion(editedPrompt)
      if (parsed.success && parsed.problemSpec) {
        const solution = solveProblem(parsed.problemSpec)
        setQuestionSolution(solution)
        setSolvedStep('solved')
      } else {
        // Fallback default
        const solution = solveProblem({
          type: 'dfa_from_language',
          alphabet: editedAlphabet.split(',').map((s) => s.trim()).filter(Boolean),
          languagePattern: { kind: 'ends_with', paramString: '01' },
        })
        setQuestionSolution(solution)
        setSolvedStep('solved')
      }
    } else if (editedCategory === 'transition_table' || editedCategory === 'diagram') {
      const cleanAlphabet = editedAlphabet.split(',').map((s) => s.trim()).filter(Boolean)
      const recon = reconstructAutomatonFromExtraction(
        {
          isNfa: editedTargetType === 'NFA',
          alphabet: cleanAlphabet,
          states: editedStates,
          transitions: editedTransitions,
          uncertainElements: [],
        },
        { autoCompleteDfa: true },
      )
      setReconstructedAuto(recon.automaton)
      setSolvedStep('solved')
    } else if (editedCategory === 'student_solution') {
      const cleanAlphabet = editedAlphabet.split(',').map((s) => s.trim()).filter(Boolean)
      const recon = reconstructAutomatonFromExtraction(
        {
          isNfa: editedTargetType === 'NFA',
          alphabet: cleanAlphabet,
          states: editedStates,
          transitions: editedTransitions,
          uncertainElements: [],
        },
        { autoCompleteDfa: true },
      )
      setReconstructedAuto(recon.automaton)

      // Run formal equivalence verification
      const verify = verifyAgainstReference(recon.automaton, {
        type: 'nl_query',
        query: intendedLanguage || 'Construct a DFA over {0,1} that accepts strings ending with 01.',
      })
      setVerificationResult(verify)
      setSolvedStep('solved')
    }
  }

  // Simulator helper
  const activeAutoForSim = reconstructedAuto || questionSolution?.automaton
  const simTrace: DetailedRunResult | null = useMemo(() => {
    if (!activeAutoForSim) return null
    return runAutomatonDetailed(activeAutoForSim, simInput)
  }, [activeAutoForSim, simInput])

  return (
    <div className="space-y-8">
      {/* Top Banner / Privacy Disclosure */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div className="space-y-1">
              <h2 className="font-serif text-lg font-bold text-foreground">
                Image-Based Exam Question & Solution Solver
              </h2>
              <p className="text-pretty text-xs text-muted-foreground sm:text-sm">
                Upload photos of textbook problems, handwritten transition tables, or student automaton diagrams.
                Review the extracted interpretation in an editable confirmation screen, then verify with the deterministic mathematical engine.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 font-mono text-[11px] text-muted-foreground">
              <Info className="size-3 text-primary" /> Max 5 MB • PNG, JPEG, WebP
            </span>
          </div>
        </div>
      </div>

      {/* STEP 1: Upload & Sample Selection */}
      {solvedStep === 'idle' && (
        <div className="space-y-6">
          {/* Preset Buttons for Quick Demonstration */}
          <div className="space-y-2">
            <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Or Try a Realistic University Exam Preset
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {SAMPLE_IMAGE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset)}
                  className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-3.5 text-left transition-all hover:border-primary/50 hover:bg-secondary/40"
                >
                  <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
                    {preset.category.toUpperCase().replace('_', ' ')}
                  </span>
                  <div className="font-sans text-xs font-bold text-foreground">{preset.title}</div>
                  <div className="line-clamp-2 font-sans text-[11px] text-muted-foreground">
                    {preset.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Drag & Drop File Zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              if (e.dataTransfer.files?.[0]) {
                handleFileSelected(e.dataTransfer.files[0])
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all sm:p-12',
              selectedImage
                ? 'border-primary/60 bg-primary/5'
                : 'border-border bg-card hover:border-primary/40 hover:bg-secondary/30',
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleFileSelected(e.target.files[0])
                }
              }}
            />

            {selectedImage ? (
              <div className="flex flex-col items-center gap-4">
                <div className="relative overflow-hidden rounded-xl border border-border shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedImage}
                    alt="Uploaded preview"
                    className="max-h-64 max-w-full object-contain"
                  />
                </div>
                <div className="space-y-1">
                  <div className="font-mono text-xs font-semibold text-foreground">
                    {imageMeta?.name || 'Uploaded Image'}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {(Number(imageMeta?.size || 0) / 1024).toFixed(1)} KB • {imageMeta?.type || 'Image'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      fileInputRef.current?.click()
                    }}
                  >
                    Change Image
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedImage(null)
                      setImageMeta(null)
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="grid size-14 place-items-center rounded-2xl border border-border bg-secondary/50 text-muted-foreground transition-transform group-hover:scale-105 group-hover:text-primary">
                  <Upload className="size-6" />
                </div>
                <div className="space-y-1">
                  <div className="font-sans text-sm font-semibold text-foreground">
                    Drag and drop your image here, or click to browse
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    Supports PNG, JPEG, and WebP (up to 5 MB)
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Privacy Disclosure & Action */}
          <div className="space-y-4 rounded-xl border border-border bg-card p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={userConsent}
                onChange={(e) => setUserConsent(e.target.checked)}
                className="mt-0.5 size-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Privacy & Processing Disclosure:</strong> Uploaded images are processed on the server to extract textual statements and graph topologies. No personal biometric data or sensitive personal information should be uploaded.
              </span>
            </label>

            {uploadError && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 font-sans text-xs text-destructive">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <Button
              onClick={handleAnalyzeImage}
              disabled={!selectedImage || isAnalyzing || !userConsent}
              className="w-full sm:w-auto"
            >
              <Sparkles className="size-4 mr-2" /> Extract & Review Problem
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: Loading State */}
      {solvedStep === 'analyzing' && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card p-12 text-center">
          <div className="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <div className="space-y-1">
            <h3 className="font-serif text-lg font-bold text-foreground">Analyzing Automata Image</h3>
            <p className="font-mono text-xs text-muted-foreground">{analysisStep}</p>
          </div>
        </div>
      )}

      {/* STEP 3: Editable Confirmation Screen */}
      {solvedStep === 'review' && recognitionResult && (
        <div className="space-y-6">
          <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-primary" />
              <div>
                <span className="font-mono text-xs font-bold text-foreground">
                  Extraction Complete ({Math.round(recognitionResult.confidence * 100)}% Confidence)
                </span>
                <p className="text-xs text-muted-foreground">{recognitionResult.disclaimer}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-border bg-card px-2.5 py-1 font-mono text-[11px] text-foreground">
                Provider: {recognitionResult.providerUsed}
              </span>
            </div>
          </div>

          {/* Uncertainty Warnings */}
          {recognitionResult.uncertainties.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-600 dark:text-amber-400">
              <div className="flex items-center gap-2 font-bold mb-1">
                <AlertTriangle className="size-4" /> Potential Ambiguities Identified in Image:
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                {recognitionResult.uncertainties.map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Category Selector */}
          <div className="space-y-2">
            <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Confirmed Problem Category
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(['text_question', 'transition_table', 'diagram', 'student_solution'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setEditedCategory(cat)}
                  className={cn(
                    'rounded-xl border p-3 text-left font-mono text-xs font-semibold transition-all',
                    editedCategory === cat
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:bg-secondary/40',
                  )}
                >
                  {cat === 'text_question' && 'Text Question'}
                  {cat === 'transition_table' && 'Transition Table'}
                  {cat === 'diagram' && 'State Diagram'}
                  {cat === 'student_solution' && 'Student Solution'}
                </button>
              ))}
            </div>
          </div>

          {/* Category-Specific Form Fields */}
          {editedCategory === 'text_question' && (
            <div className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
              {/* Multiple Questions Selector (if detected in image) */}
              {recognitionResult.questionData?.multipleQuestionsDetected &&
                recognitionResult.questionData.multipleQuestionsDetected.length > 1 && (
                  <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
                    <div className="flex items-center gap-2 font-bold font-mono text-xs text-foreground">
                      <HelpCircle className="size-4 text-primary" />
                      Multiple Questions Detected in Uploaded Image:
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Choose which question you would like to solve:
                    </p>
                    <div className="space-y-1.5 pt-1">
                      {recognitionResult.questionData.multipleQuestionsDetected.map((q, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setEditedPrompt(q)}
                          className={cn(
                            'w-full text-left p-2.5 rounded-lg border font-mono text-xs transition-all',
                            editedPrompt === q
                              ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                              : 'border-border bg-card text-foreground hover:bg-secondary/40',
                          )}
                        >
                          <span className="font-bold mr-1.5">Q{idx + 1}:</span> {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              <div className="space-y-2">
                <label className="block font-mono text-xs text-muted-foreground">Extracted Question Text</label>
                <textarea
                  value={editedPrompt}
                  onChange={(e) => setEditedPrompt(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-border bg-background p-3 font-sans text-sm text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="block font-mono text-xs text-muted-foreground">Alphabet (comma-separated)</label>
                  <input
                    type="text"
                    value={editedAlphabet}
                    onChange={(e) => setEditedAlphabet(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-mono text-xs text-muted-foreground">Target Automaton</label>
                  <select
                    value={editedTargetType}
                    onChange={(e) => setEditedTargetType(e.target.value as 'DFA' | 'NFA')}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="DFA">Deterministic Finite Automaton (DFA)</option>
                    <option value="NFA">Nondeterministic Finite Automaton (NFA)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {(editedCategory === 'transition_table' || editedCategory === 'diagram' || editedCategory === 'student_solution') && (
            <div className="space-y-5 rounded-xl border border-border bg-card p-4 sm:p-6">
              {/* If student solution: prompt for intended language */}
              {editedCategory === 'student_solution' && (
                <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <label className="block font-mono text-xs font-bold text-foreground">
                    Target Intended Language Specification
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Enter the language the candidate automaton was designed to recognize. The verification engine will check mathematical equivalence and extract counterexamples.
                  </p>
                  <input
                    type="text"
                    value={intendedLanguage}
                    onChange={(e) => setIntendedLanguage(e.target.value)}
                    placeholder="e.g. Construct a DFA that accepts strings ending with 01"
                    className="w-full rounded-lg border border-border bg-background p-2.5 font-sans text-sm text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              )}

              {/* Alphabet & States Editor */}
              <div className="space-y-2">
                <label className="block font-mono text-xs text-muted-foreground">Alphabet</label>
                <input
                  type="text"
                  value={editedAlphabet}
                  onChange={(e) => setEditedAlphabet(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background p-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              {/* States Listing */}
              <div className="space-y-2">
                <label className="block font-mono text-xs text-muted-foreground">Reconstructed States</label>
                <div className="flex flex-wrap gap-2">
                  {editedStates.map((st, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-xs',
                        st.isStart ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-foreground',
                      )}
                    >
                      <span>{st.id}</span>
                      {st.isStart && <span className="text-[10px] uppercase font-bold text-primary">(Start)</span>}
                      {st.isAccept && <span className="text-[10px] uppercase font-bold text-emerald-500">(Accept)</span>}
                      <button
                        onClick={() => {
                          const updated = [...editedStates]
                          updated[i].isAccept = !updated[i].isAccept
                          setEditedStates(updated)
                        }}
                        className="text-[10px] text-muted-foreground hover:text-foreground ml-1"
                      >
                        [Toggle Accept]
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Transitions Listing */}
              <div className="space-y-2">
                <label className="block font-mono text-xs text-muted-foreground">Reconstructed Transitions</label>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-background p-2 font-mono text-xs space-y-1">
                  {editedTransitions.map((tr, i) => (
                    <div key={i} className="flex items-center justify-between border-b border-border/40 py-1 px-2">
                      <span>
                        {tr.from} --({tr.symbol})--&gt; {tr.to}
                      </span>
                      {tr.uncertain && (
                        <span className="text-amber-500 text-[10px] flex items-center gap-1">
                          <AlertTriangle className="size-3" /> Uncertain
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Action Confirmation Buttons */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={() => setSolvedStep('idle')}>
              Back to Image Selection
            </Button>
            <Button onClick={handleExecuteConfirmedSolver}>
              Confirm & Run Formal Verification <ArrowRight className="size-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: Solved / Verified View */}
      {solvedStep === 'solved' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-500" />
              <h3 className="font-serif text-xl font-bold text-foreground">
                Formal Mathematical Verification
              </h3>
            </div>
            <Button size="sm" variant="outline" onClick={() => setSolvedStep('idle')}>
              <RotateCcw className="size-3.5 mr-1.5" /> Analyze Another Image
            </Button>
          </div>

          {/* If Student Solution: Show Equivalence Banner & Counterexample */}
          {verificationResult && (
            <div className="space-y-4">
              <div
                className={cn(
                  'rounded-2xl border p-5 shadow-sm',
                  verificationResult.equivalent
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : 'border-destructive/40 bg-destructive/10',
                )}
              >
                <div className="flex items-start gap-3">
                  {verificationResult.equivalent ? (
                    <CheckCircle2 className="size-6 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldAlert className="size-6 text-destructive shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1.5">
                    <h4 className="font-serif text-lg font-bold text-foreground">
                      {verificationResult.equivalent
                        ? 'Student Automaton is Mathematically Equivalent!'
                        : 'Language Discrepancy Found (Non-Equivalent)'}
                    </h4>
                    <p className="font-sans text-xs sm:text-sm text-foreground/90 leading-relaxed">
                      {verificationResult.explanation}
                    </p>
                  </div>
                </div>

                {/* Distinguishing Counterexample Trace */}
                {!verificationResult.equivalent && verificationResult.counterexample !== undefined && (
                  <div className="mt-4 space-y-2 rounded-xl border border-destructive/30 bg-card p-4">
                    <div className="font-mono text-xs font-bold text-destructive">
                      Shortest Distinguishing Counterexample: &quot;{verificationResult.counterexample || 'ε (empty string)'}&quot;
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 font-mono text-xs">
                      <div className="p-2.5 rounded border border-border bg-background">
                        <span className="text-muted-foreground block text-[10px] uppercase">Reconstructed Student Machine</span>
                        <span className={cn('font-bold', verificationResult.acceptedByStudent ? 'text-emerald-500' : 'text-destructive')}>
                          {verificationResult.acceptedByStudent ? 'ACCEPTS' : 'REJECTS'}
                        </span>
                      </div>
                      <div className="p-2.5 rounded border border-border bg-background">
                        <span className="text-muted-foreground block text-[10px] uppercase">Intended Language Reference</span>
                        <span className={cn('font-bold', verificationResult.acceptedByReference ? 'text-emerald-500' : 'text-destructive')}>
                          {verificationResult.acceptedByReference ? 'ACCEPTS' : 'REJECTS'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reconstructed Graph Diagram */}
          {activeAutoForSim && (
            <div className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  State-Transition Graph Diagram
                </h4>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {activeAutoForSim.states.length} states • {activeAutoForSim.alphabet.join(', ')}
                </span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-border bg-zinc-950 p-2">
                <AutomatonGraph
                  automaton={activeAutoForSim}
                  active={simTrace?.steps[simStep]?.activeStates || [activeAutoForSim.start]}
                />
              </div>
            </div>
          )}

          {/* Transition Table */}
          {activeAutoForSim && (
            <div className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-6">
              <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                State Transition Table
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="p-2.5">State</th>
                      {activeAutoForSim.alphabet.map((sym) => (
                        <th key={sym} className="p-2.5">Input &apos;{sym}&apos;</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeAutoForSim.states.map((st) => (
                      <tr key={st.id} className="border-b border-border/50">
                        <td className="p-2.5 font-bold">
                          {st.id === activeAutoForSim.start && '-> '}
                          {st.accept && '* '}
                          {st.id}
                        </td>
                        {activeAutoForSim.alphabet.map((sym) => (
                          <td key={sym} className="p-2.5">
                            {activeAutoForSim.delta[st.id]?.[sym]?.join(', ') || '∅'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Interactive Live Simulator */}
          {activeAutoForSim && (
            <div className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
              <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Interactive String Simulation
              </h4>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={simInput}
                  onChange={(e) => {
                    setSimInput(e.target.value)
                    setSimStep(0)
                  }}
                  placeholder="Enter test string (e.g. 1001)"
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
                />
                <Button size="sm" variant="outline" onClick={() => setSimStep(0)}>
                  Reset
                </Button>
              </div>

              {simTrace && (
                <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/20 p-3 font-mono text-xs">
                  <div>
                    Verdict:{' '}
                    <span className={cn('font-bold', simTrace.accepted ? 'text-emerald-500' : 'text-destructive')}>
                      {simTrace.accepted ? 'ACCEPTED' : 'REJECTED'}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    State at end: {simTrace.steps[simTrace.steps.length - 1]?.activeStates?.join(', ') || 'None'}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* If Question: 9-Point Educational Explanation Suite */}
          {questionSolution && (
            <div className="space-y-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-6">
              <h4 className="font-serif text-lg font-bold text-foreground">
                Theoretical Derivations & Correctness Proof
              </h4>
              <div className="space-y-2 text-xs font-mono bg-card p-3 rounded-xl border border-border">
                <div className="font-bold text-primary">Formal Language Definition:</div>
                <div>{questionSolution.formalLanguageDefinition}</div>
              </div>
              <div className="space-y-2 text-xs font-mono bg-card p-3 rounded-xl border border-border whitespace-pre-wrap">
                <div className="font-bold text-primary">Inductive Correctness Proof Sketch:</div>
                <div>{questionSolution.invariantProofSketch}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
