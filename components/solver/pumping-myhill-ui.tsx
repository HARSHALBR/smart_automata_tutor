'use client'

import React, { useState } from 'react'
import {
  ShieldAlert,
  Layers,
  Sparkles,
  BookOpen,
} from 'lucide-react'
import { PumpingLemmaStudio } from './pumping-lemma-studio'
import { MyhillNerodeStudio } from './myhill-nerode-studio'
import { type NonRegularPattern } from '@/lib/pumping-lemma'
import { cn } from '@/lib/utils'

export function PumpingMyhillUI({
  initialPattern,
  initialTab = 'pumping',
}: {
  initialPattern?: NonRegularPattern
  initialTab?: 'pumping' | 'myhill'
}) {
  const [activeTab, setActiveTab] = useState<'pumping' | 'myhill'>(initialTab)

  return (
    <div className="space-y-6">
      {/* Tab Switcher Header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-2">
        <button
          onClick={() => setActiveTab('pumping')}
          className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-semibold transition-all',
            activeTab === 'pumping'
              ? 'border border-primary/40 bg-primary/10 text-primary shadow-xs'
              : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground',
          )}
        >
          <ShieldAlert className="size-3.5" /> Pumping Lemma for Regular Languages
        </button>

        <button
          onClick={() => setActiveTab('myhill')}
          className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-semibold transition-all',
            activeTab === 'myhill'
              ? 'border border-primary/40 bg-primary/10 text-primary shadow-xs'
              : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground',
          )}
        >
          <Layers className="size-3.5" /> Myhill–Nerode Theorem & Distinguishing Suffixes
        </button>
      </div>

      {/* Render Active Studio */}
      {activeTab === 'pumping' ? (
        <PumpingLemmaStudio initialPattern={initialPattern} />
      ) : (
        <MyhillNerodeStudio />
      )}
    </div>
  )
}

