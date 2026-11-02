import Link from 'next/link'
import {
  ArrowRight,
  CircuitBoard,
  FlaskConical,
  Infinity as InfinityIcon,
  Sparkles,
} from 'lucide-react'
import { CURRICULUM, PARTS } from '@/lib/curriculum'
import { HeroAutomaton } from '@/components/landing/hero-automaton'
import { AboutDialog } from '@/components/about-dialog'

const PART_META: Record<string, { n: string; blurb: string }> = {
  'Automata & Languages': {
    n: 'I',
    blurb: 'Finite automata, regular expressions, and context-free grammars.',
  },
  'Computability Theory': {
    n: 'II',
    blurb: 'Turing machines, decidability, and the limits of computation.',
  },
  'Complexity Theory': {
    n: 'III',
    blurb: 'Time, space, P vs NP, and the geography of hardness.',
  },
}

const LABS = [
  {
    icon: CircuitBoard,
    title: 'Automaton simulator',
    desc: 'Build DFAs and NFAs, then step through any input and watch states light up.',
  },
  {
    icon: InfinityIcon,
    title: 'Turing machine',
    desc: 'Drive a head across an infinite tape and see real computation unfold.',
  },
  {
    icon: FlaskConical,
    title: 'Pumping & regex labs',
    desc: 'Pump strings to prove non-regularity and test live regular expressions.',
  },
]

export default function HomePage() {
  const firstTopic = CURRICULUM[0].topics[0].id

  return (
    <main className="bg-grid min-h-screen">
      {/* nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-2 font-mono text-sm font-semibold">
          <span className="grid size-7 place-items-center rounded-md bg-primary font-serif text-primary-foreground">
            A
          </span>
          Automata
        </span>
        <div className="flex items-center gap-2">
          <AboutDialog />
          <Link
            href="/solve"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-secondary/50 px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <Sparkles className="size-3.5 text-primary" /> DFA/NFA Solver
          </Link>
          <Link
            href="/learn"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            Start learning <ArrowRight className="size-4" />
          </Link>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-2 lg:pt-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 font-mono text-xs text-muted-foreground">
            <Sparkles className="size-3 text-accent" /> Based on Sipser&apos;s{' '}
            <em>Introduction to the Theory of Computation</em>
          </span>
          <h1 className="mt-6 text-balance font-serif text-5xl leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            The theory of computation,{' '}
            <span className="text-primary text-glow">made visible</span>.
          </h1>
          <p className="mt-6 max-w-md text-pretty text-lg leading-relaxed text-muted-foreground">
            From finite automata to the P versus NP question — learn the
            mathematics of what computers can and cannot do, through interactive
            machines you can run yourself.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={`/learn?topic=${firstTopic}`}
              className="glow-primary inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
            >
              Begin the course <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/solve"
              className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-5 py-3 font-medium text-primary transition-colors hover:bg-primary/20"
            >
              <Sparkles className="size-4" /> DFA/NFA Solver
            </Link>
            <Link
              href="/learn?topic=tm-lab"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 font-medium text-foreground transition-colors hover:bg-muted"
            >
              <FlaskConical className="size-4 text-accent" /> Open a lab
            </Link>
          </div>
        </div>
        <HeroAutomaton />
      </section>

      {/* labs strip */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-3">
          {LABS.map((lab) => (
            <div
              key={lab.title}
              className="rounded-2xl border border-border bg-card/50 p-6"
            >
              <lab.icon className="size-6 text-primary" />
              <h3 className="mt-4 font-medium text-foreground">{lab.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {lab.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* curriculum map */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-10">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            The syllabus
          </span>
          <h2 className="mt-2 text-balance font-serif text-4xl tracking-tight text-foreground">
            Three parts, one journey
          </h2>
        </div>

        <div className="space-y-12">
          {PARTS.map((part) => (
            <div key={part}>
              <div className="mb-5 flex items-baseline gap-3">
                <span className="font-serif text-3xl text-primary">
                  {PART_META[part].n}
                </span>
                <div>
                  <h3 className="text-xl font-medium text-foreground">{part}</h3>
                  <p className="text-sm text-muted-foreground">
                    {PART_META[part].blurb}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {CURRICULUM.filter((m) => m.part === part).map((mod) => {
                  const hasLab = mod.topics.some((t) => t.lab)
                  return (
                    <Link
                      key={mod.id}
                      href={`/learn?topic=${mod.topics[0].id}`}
                      className="group flex flex-col rounded-2xl border border-border bg-card/50 p-5 transition-colors hover:border-primary/50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-muted-foreground">
                          {mod.chapter}
                        </span>
                        {hasLab && (
                          <FlaskConical className="size-3.5 text-accent" />
                        )}
                      </div>
                      <h4 className="mt-2 font-serif text-2xl tracking-tight text-foreground group-hover:text-primary">
                        {mod.title}
                      </h4>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                        {mod.summary}
                      </p>
                      <span className="mt-4 inline-flex items-center gap-1 font-mono text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
                        Open <ArrowRight className="size-3" />
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* cta */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="glow-primary overflow-hidden rounded-3xl border border-primary/30 bg-card/60 px-8 py-14 text-center">
          <h2 className="text-balance font-serif text-4xl tracking-tight text-foreground">
            Ready to compute?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-pretty text-muted-foreground">
            Start with the simplest machine there is and work your way up to the
            deepest open question in computer science.
          </p>
          <Link
            href={`/learn?topic=${firstTopic}`}
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
          >
            Begin the course <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-center px-6 py-8 text-sm text-muted-foreground">
          <span className="font-mono">Automata · an interactive course</span>
        </div>
      </footer>
    </main>
  )
}
