'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  Flame,
  FlaskConical,
  Menu,
  Sparkles,
  X,
} from 'lucide-react'
import {
  CURRICULUM,
  PARTS,
  allTopics,
  findTopic,
} from '@/lib/curriculum'
import { LessonBody } from '@/components/lesson/content'
import { AboutDialog } from '@/components/about-dialog'
import { Quiz } from '@/components/exercise/quiz'
import { exercisesFor } from '@/lib/exercises'
import { useProgress } from '@/lib/progress'
import { cn } from '@/lib/utils'

export function LearnWorkspace({ initialTopic }: { initialTopic?: string }) {
  const flat = useMemo(() => allTopics(), [])
  const [activeId, setActiveId] = useState(
    initialTopic ?? flat[0].topic.id,
  )
  const [navOpen, setNavOpen] = useState(false)
  const {
    completed: completedList,
    streak,
    complete,
    markStudiedToday,
    recordScore,
  } = useProgress()
  const completed = useMemo(() => new Set(completedList), [completedList])

  const found = findTopic(activeId)!
  const exercise = exercisesFor(activeId)
  const index = flat.findIndex((t) => t.topic.id === activeId)
  const prev = index > 0 ? flat[index - 1] : null
  const next = index < flat.length - 1 ? flat[index + 1] : null
  const progress = Math.round((completed.size / flat.length) * 100)

  // Count any time the learner opens the app as a study day.
  useEffect(() => {
    markStudiedToday()
  }, [markStudiedToday])

  function go(id: string) {
    complete(activeId)
    setActiveId(id)
    setNavOpen(false)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-sidebar transition-transform lg:static lg:translate-x-0',
          navOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 font-mono text-sm font-semibold tracking-tight"
          >
            <span className="grid size-7 place-items-center rounded-md bg-primary font-serif text-primary-foreground">
              A
            </span>
            Automata
          </Link>
          <button
            className="text-muted-foreground lg:hidden"
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* progress */}
        <div className="border-b border-border px-5 py-3">
          <div className="mb-1.5 flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>course progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {PARTS.map((part) => (
            <div key={part} className="mb-5">
              <h2 className="px-2 pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {part}
              </h2>
              {CURRICULUM.filter((m) => m.part === part).map((mod) => (
                <div key={mod.id} className="mb-3">
                  <p className="px-2 py-1 text-xs font-medium text-foreground/70">
                    {mod.title}
                  </p>
                  <ul className="space-y-0.5">
                    {mod.topics.map((topic) => {
                      const isActive = topic.id === activeId
                      const isDone = completed.has(topic.id)
                      return (
                        <li key={topic.id}>
                          <button
                            onClick={() => go(topic.id)}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
                              isActive
                                ? 'bg-primary/15 text-primary'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}
                          >
                            <span
                              className={cn(
                                'grid size-4 shrink-0 place-items-center rounded-full border text-[9px]',
                                isDone
                                  ? 'border-success bg-success/20 text-success'
                                  : isActive
                                    ? 'border-primary text-primary'
                                    : 'border-muted-foreground/40',
                              )}
                            >
                              {isDone ? <Check className="size-2.5" /> : null}
                              {!isDone && topic.lab ? (
                                <FlaskConical className="size-2.5" />
                              ) : null}
                            </span>
                            <span className="leading-tight">{topic.title}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {navOpen && (
        <button
          aria-hidden
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-30 bg-background/70 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur lg:px-8">
          <button
            className="text-muted-foreground lg:hidden"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>
          <Link
            href="/"
            className="hidden items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground lg:flex"
          >
            <ChevronLeft className="size-4" /> Home
          </Link>
          <span className="font-mono text-xs text-muted-foreground">
            {found.module.chapter} · {found.module.title}
          </span>
          {streak > 0 && (
            <span
              className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 font-mono text-xs font-semibold text-accent"
              title={`${streak}-day study streak`}
            >
              <Flame className="size-3.5" /> {streak}
            </span>
          )}
          <Link
            href="/solve"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-xs font-medium text-primary transition-colors hover:bg-primary/20',
              streak > 0 ? '' : 'ml-auto',
            )}
          >
            <Sparkles className="size-3" /> Solver
          </Link>
          <AboutDialog />
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 lg:px-8 lg:py-14">
          {found.topic.lab && (
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 font-mono text-xs text-accent">
              <FlaskConical className="size-3" /> Interactive lab
            </span>
          )}
          <h1 className="mb-8 text-balance font-serif text-4xl tracking-tight text-foreground lg:text-5xl">
            {found.topic.title}
          </h1>

          <article className="space-y-6">
            <LessonBody topicId={activeId} />
          </article>

          {exercise && (
            <div className="mt-12">
              <Quiz topicId={activeId} onScored={recordScore} />
            </div>
          )}

          {/* prev / next */}
          <div className="mt-14 grid gap-3 border-t border-border pt-8 sm:grid-cols-2">
            {prev ? (
              <button
                onClick={() => go(prev.topic.id)}
                className="group flex flex-col items-start rounded-xl border border-border bg-card/50 p-4 text-left transition-colors hover:border-primary/50"
              >
                <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                  <ArrowLeft className="size-3" /> Previous
                </span>
                <span className="mt-1 text-sm font-medium text-foreground group-hover:text-primary">
                  {prev.topic.title}
                </span>
              </button>
            ) : (
              <div />
            )}
            {next ? (
              <button
                onClick={() => go(next.topic.id)}
                className="group flex flex-col items-end rounded-xl border border-border bg-card/50 p-4 text-right transition-colors hover:border-primary/50 sm:col-start-2"
              >
                <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                  Next <ArrowRight className="size-3" />
                </span>
                <span className="mt-1 text-sm font-medium text-foreground group-hover:text-primary">
                  {next.topic.title}
                </span>
              </button>
            ) : (
              <div />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
