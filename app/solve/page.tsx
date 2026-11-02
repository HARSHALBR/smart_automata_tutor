import Link from 'next/link'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { AutomataSolverUI } from '@/components/solver/automata-solver-ui'
import { AboutDialog } from '@/components/about-dialog'

export const metadata = {
  title: 'Automata Problem Solver — Theory of Computation',
  description:
    'Interactive deterministic DFA/NFA problem solver. Generates formal 5-tuples, state diagrams, transition tables, and step-by-step proofs.',
}

export default function SolvePage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Header Navigation */}
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 font-mono text-sm font-semibold tracking-tight transition-opacity hover:opacity-80"
            >
              <span className="grid size-7 place-items-center rounded-md bg-primary font-serif text-primary-foreground">
                A
              </span>
              Automata
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-mono text-xs font-medium text-foreground">
              Problem Solver
            </span>
          </div>

          <div className="flex items-center gap-2">
            <AboutDialog />
            <Link
              href="/learn"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 font-mono text-xs font-medium text-foreground transition-colors hover:bg-secondary"
            >
              <BookOpen className="size-3.5" /> Course
            </Link>
          </div>
        </div>
      </header>

      {/* Solver Main Component */}
      <AutomataSolverUI />
    </main>
  )
}
