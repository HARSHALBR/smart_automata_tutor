/**
 * Sample Image Presets for Testing & Demonstration
 * Provides realistic visual presets across all 4 categories:
 * 1. Text Question Image
 * 2. Transition Table Image
 * 3. State-Transition Diagram Image
 * 4. Student Attempted Solution Image (with non-equivalence for counterexample testing)
 */

import type { ImageRecognitionResult, ImageExtractionCategory } from './types'

export interface ImageSamplePreset {
  id: string
  title: string
  description: string
  category: ImageExtractionCategory
  svgDataUrl: string
  extraction: ImageRecognitionResult
}

// Generate base64 SVG data URLs for sample images
function createSvgDataUrl(svgContent: string): string {
  const encoded = Buffer.from(svgContent.trim()).toString('base64')
  return `data:image/svg+xml;base64,${encoded}`
}

// Sample 1: Text Question
const svgTextQuestion = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="240" viewBox="0 0 600 240">
  <rect width="100%" height="100%" fill="#18181b"/>
  <rect x="20" y="20" width="560" height="200" rx="12" fill="#27272a" stroke="#3f3f46" stroke-width="2"/>
  <text x="50" y="70" font-family="monospace" font-size="14" fill="#a1a1aa" font-weight="bold">QUESTION 3 — UNIVERSITY EXAM</text>
  <text x="50" y="115" font-family="sans-serif" font-size="18" fill="#f4f4f5" font-weight="600">Construct a DFA over alphabet {0, 1} that</text>
  <text x="50" y="145" font-family="sans-serif" font-size="18" fill="#38bdf8" font-weight="600">accepts strings ending with "01".</text>
  <text x="50" y="185" font-family="sans-serif" font-size="13" fill="#71717a">Provide formal 5-tuple and state transition diagram.</text>
</svg>
`

// Sample 2: Transition Table
const svgTransitionTable = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="280" viewBox="0 0 600 280">
  <rect width="100%" height="100%" fill="#18181b"/>
  <rect x="20" y="20" width="560" height="240" rx="12" fill="#27272a" stroke="#3f3f46" stroke-width="2"/>
  <text x="50" y="60" font-family="sans-serif" font-size="16" fill="#f4f4f5" font-weight="bold">Transition Table: Even Zeros DFA</text>
  <line x1="50" y1="80" x2="550" y2="80" stroke="#3f3f46" stroke-width="2"/>
  <text x="70" y="110" font-family="monospace" font-size="14" fill="#a1a1aa">State</text>
  <text x="250" y="110" font-family="monospace" font-size="14" fill="#a1a1aa">Input 0</text>
  <text x="430" y="110" font-family="monospace" font-size="14" fill="#a1a1aa">Input 1</text>
  <line x1="50" y1="130" x2="550" y2="130" stroke="#3f3f46" stroke-width="1"/>
  <text x="70" y="165" font-family="monospace" font-size="16" fill="#4ade80" font-weight="bold">->* q0 (even)</text>
  <text x="260" y="165" font-family="monospace" font-size="16" fill="#f4f4f5">q1</text>
  <text x="440" y="165" font-family="monospace" font-size="16" fill="#f4f4f5">q0</text>
  <line x1="50" y1="190" x2="550" y2="190" stroke="#3f3f46" stroke-width="1"/>
  <text x="70" y="225" font-family="monospace" font-size="16" fill="#f87171">    q1 (odd)</text>
  <text x="260" y="225" font-family="monospace" font-size="16" fill="#f4f4f5">q0</text>
  <text x="440" y="225" font-family="monospace" font-size="16" fill="#f4f4f5">q1</text>
</svg>
`

// Sample 3: State Diagram (Binary Divisible by 3)
const svgStateDiagram = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300">
  <rect width="100%" height="100%" fill="#18181b"/>
  <rect x="20" y="20" width="560" height="260" rx="12" fill="#27272a" stroke="#3f3f46" stroke-width="2"/>
  <text x="50" y="55" font-family="sans-serif" font-size="16" fill="#f4f4f5" font-weight="bold">State Diagram: Binary Divisible by 3</text>
  
  <!-- Start Arrow -->
  <line x1="40" y1="160" x2="100" y2="160" stroke="#38bdf8" stroke-width="3"/>
  <polygon points="100,160 90,154 90,166" fill="#38bdf8"/>
  
  <!-- State q0 (Double ring: Accept) -->
  <circle cx="140" cy="160" r="32" fill="#18181b" stroke="#38bdf8" stroke-width="3"/>
  <circle cx="140" cy="160" r="26" fill="#18181b" stroke="#38bdf8" stroke-width="1.5"/>
  <text x="140" y="166" font-family="monospace" font-size="16" fill="#f4f4f5" text-anchor="middle">q0</text>
  
  <!-- State q1 -->
  <circle cx="300" cy="160" r="32" fill="#18181b" stroke="#a1a1aa" stroke-width="2.5"/>
  <text x="300" y="166" font-family="monospace" font-size="16" fill="#f4f4f5" text-anchor="middle">q1</text>
  
  <!-- State q2 -->
  <circle cx="460" cy="160" r="32" fill="#18181b" stroke="#a1a1aa" stroke-width="2.5"/>
  <text x="460" y="166" font-family="monospace" font-size="16" fill="#f4f4f5" text-anchor="middle">q2</text>
  
  <!-- Transitions -->
  <!-- q0 loop 0 -->
  <path d="M 130,130 C 130,90 150,90 150,130" fill="none" stroke="#a1a1aa" stroke-width="2"/>
  <text x="140" y="85" font-family="monospace" font-size="13" fill="#38bdf8" text-anchor="middle">0</text>
  
  <!-- q0 -> q1 on 1 -->
  <path d="M 172,150 Q 220,120 268,150" fill="none" stroke="#a1a1aa" stroke-width="2"/>
  <text x="220" y="125" font-family="monospace" font-size="13" fill="#f4f4f5">1</text>
  
  <!-- q1 -> q2 on 0 -->
  <path d="M 332,150 Q 380,120 428,150" fill="none" stroke="#a1a1aa" stroke-width="2"/>
  <text x="380" y="125" font-family="monospace" font-size="13" fill="#f4f4f5">0</text>
  
  <!-- q1 -> q0 on 1 -->
  <path d="M 268,170 Q 220,200 172,170" fill="none" stroke="#a1a1aa" stroke-width="2"/>
  <text x="220" y="195" font-family="monospace" font-size="13" fill="#f4f4f5">1</text>
  
  <!-- q2 -> q1 on 0 -->
  <path d="M 428,170 Q 380,200 332,170" fill="none" stroke="#a1a1aa" stroke-width="2"/>
  <text x="380" y="195" font-family="monospace" font-size="13" fill="#f4f4f5">0</text>
  
  <!-- q2 loop 1 -->
  <path d="M 450,130 C 450,90 470,90 470,130" fill="none" stroke="#a1a1aa" stroke-width="2"/>
  <text x="460" y="85" font-family="monospace" font-size="13" fill="#f4f4f5" text-anchor="middle">1</text>
</svg>
`

// Sample 4: Student Solution with a Bug (Target: Ends with 01, but student made q1 accept instead of q2)
const svgStudentBuggyDiagram = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300">
  <rect width="100%" height="100%" fill="#18181b"/>
  <rect x="20" y="20" width="560" height="260" rx="12" fill="#27272a" stroke="#ef4444" stroke-width="2"/>
  <text x="50" y="55" font-family="sans-serif" font-size="16" fill="#ef4444" font-weight="bold">Student Attempt: "Accept strings ending with 01"</text>
  <text x="50" y="80" font-family="sans-serif" font-size="12" fill="#a1a1aa">(Student mistakenly marked state q1 as accepting instead of q2)</text>
  
  <!-- Start Arrow -->
  <line x1="50" y1="180" x2="110" y2="180" stroke="#38bdf8" stroke-width="3"/>
  <polygon points="110,180 100,174 100,186" fill="#38bdf8"/>
  
  <!-- State q0 -->
  <circle cx="150" cy="180" r="30" fill="#18181b" stroke="#a1a1aa" stroke-width="2.5"/>
  <text x="150" y="186" font-family="monospace" font-size="16" fill="#f4f4f5" text-anchor="middle">q0</text>
  
  <!-- State q1 (Student mistakenly drew double ring on q1!) -->
  <circle cx="310" cy="180" r="30" fill="#18181b" stroke="#ef4444" stroke-width="2.5"/>
  <circle cx="310" cy="180" r="24" fill="#18181b" stroke="#ef4444" stroke-width="1.5"/>
  <text x="310" y="186" font-family="monospace" font-size="16" fill="#f4f4f5" text-anchor="middle">q1</text>
  
  <!-- State q2 (Student drew single ring on q2!) -->
  <circle cx="470" cy="180" r="30" fill="#18181b" stroke="#a1a1aa" stroke-width="2.5"/>
  <text x="470" y="186" font-family="monospace" font-size="16" fill="#f4f4f5" text-anchor="middle">q2</text>
  
  <!-- Transitions -->
  <!-- q0 loop 1 -->
  <path d="M 140,150 C 140,110 160,110 160,150" fill="none" stroke="#a1a1aa" stroke-width="2"/>
  <text x="150" y="105" font-family="monospace" font-size="13" fill="#f4f4f5" text-anchor="middle">1</text>
  
  <!-- q0 -> q1 on 0 -->
  <line x1="180" y1="180" x2="280" y2="180" stroke="#a1a1aa" stroke-width="2"/>
  <polygon points="280,180 270,174 270,186" fill="#a1a1aa"/>
  <text x="230" y="170" font-family="monospace" font-size="13" fill="#f4f4f5" text-anchor="middle">0</text>
  
  <!-- q1 loop 0 -->
  <path d="M 300,150 C 300,110 320,110 320,150" fill="none" stroke="#a1a1aa" stroke-width="2"/>
  <text x="310" y="105" font-family="monospace" font-size="13" fill="#f4f4f5" text-anchor="middle">0</text>
  
  <!-- q1 -> q2 on 1 -->
  <line x1="340" y1="180" x2="440" y2="180" stroke="#a1a1aa" stroke-width="2"/>
  <polygon points="440,180 430,174 430,186" fill="#a1a1aa"/>
  <text x="390" y="170" font-family="monospace" font-size="13" fill="#f4f4f5" text-anchor="middle">1</text>
  
  <!-- q2 -> q1 on 0 -->
  <path d="M 450,205 Q 390,250 330,205" fill="none" stroke="#a1a1aa" stroke-width="2"/>
  <text x="390" y="245" font-family="monospace" font-size="13" fill="#f4f4f5" text-anchor="middle">0</text>
  
  <!-- q2 -> q0 on 1 -->
  <path d="M 460,210 Q 310,280 160,210" fill="none" stroke="#a1a1aa" stroke-width="2"/>
  <text x="310" y="275" font-family="monospace" font-size="13" fill="#f4f4f5" text-anchor="middle">1</text>
</svg>
`

// Sample 5: Handwritten or Ambiguous State Diagram
const svgHandwrittenDiagram = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300">
  <rect width="100%" height="100%" fill="#18181b"/>
  <rect x="20" y="20" width="560" height="260" rx="12" fill="#27272a" stroke="#eab308" stroke-dasharray="6 4" stroke-width="2"/>
  <text x="50" y="55" font-family="sans-serif" font-size="16" fill="#eab308" font-weight="bold">Handwritten Exam Sketch (Ambiguous Diagram)</text>
  <text x="50" y="80" font-family="sans-serif" font-size="12" fill="#a1a1aa">(Faint stroke from q0 to q1; unclear whether transition label is '0' or '1')</text>
  
  <!-- Start Arrow -->
  <line x1="50" y1="180" x2="110" y2="180" stroke="#38bdf8" stroke-width="2.5" stroke-dasharray="4 2"/>
  <polygon points="110,180 102,175 102,185" fill="#38bdf8"/>
  
  <!-- State q0 -->
  <circle cx="150" cy="180" r="30" fill="#18181b" stroke="#facc15" stroke-width="2"/>
  <text x="150" y="186" font-family="sans-serif" font-size="16" fill="#f4f4f5" text-anchor="middle">q0</text>
  
  <!-- State q1 (Ambiguous dashed ring) -->
  <circle cx="330" cy="180" r="30" fill="#18181b" stroke="#facc15" stroke-width="2"/>
  <circle cx="330" cy="180" r="23" fill="#18181b" stroke="#facc15" stroke-width="1.5" stroke-dasharray="3 3"/>
  <text x="330" y="186" font-family="sans-serif" font-size="16" fill="#f4f4f5" text-anchor="middle">q1?</text>
  
  <!-- Ambiguous transition arrow -->
  <path d="M 180,170 Q 255,140 300,170" fill="none" stroke="#facc15" stroke-width="1.5" stroke-dasharray="4 3"/>
  <text x="255" y="145" font-family="sans-serif" font-size="14" fill="#facc15" text-anchor="middle">0(?)</text>
</svg>
`

export const SAMPLE_IMAGE_PRESETS: ImageSamplePreset[] = [
  {
    id: 'sample-text-question',
    title: 'Text Question: Ending in 01',
    description: 'Exam prompt requesting a DFA for strings ending with "01".',
    category: 'text_question',
    svgDataUrl: createSvgDataUrl(svgTextQuestion),
    extraction: {
      success: true,
      category: 'text_question',
      confidence: 0.98,
      detectedText: 'Construct a DFA over alphabet {0, 1} that accepts strings ending with "01".',
      questionData: {
        prompt: 'Construct a DFA over alphabet {0, 1} that accepts strings ending with 01',
        suggestedType: 'dfa',
        alphabet: ['0', '1'],
      },
      uncertainties: [],
      warnings: [],
      providerUsed: 'offline-heuristic',
      disclaimer: 'Extraction verified from sample exam card.',
    },
  },
  {
    id: 'sample-transition-table',
    title: 'Transition Table: Even Zeros',
    description: 'Tabular specification for an even number of zeros DFA.',
    category: 'transition_table',
    svgDataUrl: createSvgDataUrl(svgTransitionTable),
    extraction: {
      success: true,
      category: 'transition_table',
      confidence: 0.96,
      detectedText: 'State | 0 | 1\n->* q0 | q1 | q0\nq1 | q0 | q1',
      automatonData: {
        isNfa: false,
        alphabet: ['0', '1'],
        states: [
          { id: 'q0', isStart: true, isAccept: true, label: 'even zeros' },
          { id: 'q1', isStart: false, isAccept: false, label: 'odd zeros' },
        ],
        transitions: [
          { from: 'q0', symbol: '0', to: 'q1' },
          { from: 'q0', symbol: '1', to: 'q0' },
          { from: 'q1', symbol: '0', to: 'q0' },
          { from: 'q1', symbol: '1', to: 'q1' },
        ],
        uncertainElements: [],
        rawTableText: 'State, 0, 1\n->* q0, q1, q0\nq1, q0, q1',
      },
      uncertainties: [],
      warnings: [],
      providerUsed: 'offline-heuristic',
      disclaimer: 'Extracted tabular transitions verified from sample table.',
    },
  },
  {
    id: 'sample-diagram-div3',
    title: 'State Diagram: Binary Divisible by 3',
    description: 'Reconstructed 3-state DFA diagram modulo 3 with start and accept ring.',
    category: 'diagram',
    svgDataUrl: createSvgDataUrl(svgStateDiagram),
    extraction: {
      success: true,
      category: 'diagram',
      confidence: 0.94,
      detectedText: 'Diagram with states q0, q1, q2. Start: q0. Accept: q0.',
      automatonData: {
        isNfa: false,
        alphabet: ['0', '1'],
        states: [
          { id: 'q0', isStart: true, isAccept: true },
          { id: 'q1', isStart: false, isAccept: false },
          { id: 'q2', isStart: false, isAccept: false },
        ],
        transitions: [
          { from: 'q0', symbol: '0', to: 'q0' },
          { from: 'q0', symbol: '1', to: 'q1' },
          { from: 'q1', symbol: '0', to: 'q2' },
          { from: 'q1', symbol: '1', to: 'q0' },
          { from: 'q2', symbol: '0', to: 'q1' },
          { from: 'q2', symbol: '1', to: 'q2' },
        ],
        uncertainElements: [],
      },
      uncertainties: [],
      warnings: [],
      providerUsed: 'offline-heuristic',
      disclaimer: 'Extracted graph topology verified from sample diagram.',
    },
  },
  {
    id: 'sample-student-solution',
    title: 'Student Attempt: Buggy Ends with 01',
    description: 'Attempted solution with intended language; allows testing distinguishing counterexamples.',
    category: 'student_solution',
    svgDataUrl: createSvgDataUrl(svgStudentBuggyDiagram),
    extraction: {
      success: true,
      category: 'student_solution',
      confidence: 0.92,
      detectedText: 'Student Attempt: "Accept strings ending with 01"\nStates: q0, q1, q2\nStart: q0\nAccept: q1 (mistake)',
      studentSolutionData: {
        automaton: {
          isNfa: false,
          alphabet: ['0', '1'],
          states: [
            { id: 'q0', isStart: true, isAccept: false },
            { id: 'q1', isStart: false, isAccept: true }, // Student error: q1 accepted instead of q2!
            { id: 'q2', isStart: false, isAccept: false },
          ],
          transitions: [
            { from: 'q0', symbol: '1', to: 'q0' },
            { from: 'q0', symbol: '0', to: 'q1' },
            { from: 'q1', symbol: '0', to: 'q1' },
            { from: 'q1', symbol: '1', to: 'q2' },
            { from: 'q2', symbol: '0', to: 'q1' },
            { from: 'q2', symbol: '1', to: 'q0' },
          ],
          uncertainElements: ['Double circle detected on q1 instead of q2.'],
        },
        intendedLanguagePrompt: 'Construct a DFA over {0,1} that accepts strings ending with 01.',
        isLanguagePromptMissing: false,
      },
      uncertainties: ['Double-circle accept marking identified on state q1.'],
      warnings: ['Potential student error detected: acceptance state does not align with standard suffix pattern.'],
      providerUsed: 'offline-heuristic',
      disclaimer: 'Sample student solution loaded for equivalence checking and counterexample derivation.',
    },
  },
  {
    id: 'sample-multi-question',
    title: 'Exam Sheet: Multiple Questions',
    description: 'Exam page containing two distinct questions; tests question selection workflow.',
    category: 'text_question',
    svgDataUrl: createSvgDataUrl(svgTextQuestion),
    extraction: {
      success: true,
      category: 'text_question',
      confidence: 0.95,
      detectedText: '1. Construct a DFA over {0,1} that accepts strings ending with 01.\n2. Construct a DFA that accepts strings containing an even number of zeros.',
      questionData: {
        prompt: 'Construct a DFA over {0,1} that accepts strings ending with 01.',
        suggestedType: 'dfa',
        alphabet: ['0', '1'],
        multipleQuestionsDetected: [
          'Construct a DFA over {0,1} that accepts strings ending with 01.',
          'Construct a DFA that accepts strings containing an even number of zeros.',
        ],
      },
      uncertainties: [],
      warnings: ['Multiple questions detected in image. Please confirm which question to solve.'],
      providerUsed: 'offline-heuristic',
      disclaimer: 'Multiple question exam sheet detected. Select your target question below.',
    },
  },
  {
    id: 'sample-nfa-epsilon',
    title: 'NFA with ε-Transitions',
    description: 'Nondeterministic finite automaton diagram featuring epsilon transitions.',
    category: 'diagram',
    svgDataUrl: createSvgDataUrl(svgStateDiagram),
    extraction: {
      success: true,
      category: 'diagram',
      confidence: 0.93,
      detectedText: 'NFA with states q0, q1, q2. Epsilon transition from q0 to q1.',
      automatonData: {
        isNfa: true,
        alphabet: ['0', '1'],
        states: [
          { id: 'q0', isStart: true, isAccept: false },
          { id: 'q1', isStart: false, isAccept: false },
          { id: 'q2', isStart: false, isAccept: true },
        ],
        transitions: [
          { from: 'q0', symbol: 'ε', to: 'q1' },
          { from: 'q0', symbol: '0', to: 'q0' },
          { from: 'q1', symbol: '1', to: 'q2' },
          { from: 'q2', symbol: '0', to: 'q2' },
          { from: 'q2', symbol: '1', to: 'q2' },
        ],
        uncertainElements: [],
      },
      uncertainties: [],
      warnings: ['NFA containing ε-transitions. Subset construction can be used to convert to equivalent DFA.'],
      providerUsed: 'offline-heuristic',
      disclaimer: 'Extracted NFA topology with epsilon transitions verified.',
    },
  },
  {
    id: 'sample-handwritten-ambiguous',
    title: 'Handwritten Sketch: Ambiguous Diagram',
    description: 'Rough handwritten state diagram with low-contrast arrows and ambiguous labels.',
    category: 'diagram',
    svgDataUrl: createSvgDataUrl(svgHandwrittenDiagram),
    extraction: {
      success: true,
      category: 'diagram',
      confidence: 0.65,
      detectedText: 'Rough sketch: q0 -> q1? Arrow label unclear ("0"?). Circle on q1 partially dashed.',
      automatonData: {
        isNfa: false,
        alphabet: ['0', '1'],
        states: [
          { id: 'q0', isStart: true, isAccept: false },
          { id: 'q1', isStart: false, isAccept: true, uncertain: true },
        ],
        transitions: [
          { from: 'q0', symbol: '0', to: 'q1', uncertain: true },
          { from: 'q0', symbol: '1', to: 'q0', uncertain: false },
        ],
        uncertainElements: [
          'State q1 has incomplete outer circle (ambiguous accept state).',
          'Transition q0 -> q1 on "0" is faint and marked uncertain.',
        ],
      },
      uncertainties: [
        'State q1 acceptance status is ambiguous.',
        'Transition from q0 to q1 symbol label "0" is faint.',
      ],
      warnings: [
        'Ambiguous handwritten features detected. Please confirm the states and transitions before solving.',
      ],
      providerUsed: 'offline-heuristic',
      disclaimer: 'Extracted with visual ambiguity flags. Confirmation required before verification.',
    },
  },
]

