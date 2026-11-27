'use client'

import { LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ACTIVITY_LABELS } from '@/lib/activity'
import type { ActivityScope } from '@/lib/activity'

interface Props {
  value: ActivityScope
  onChange: (value: ActivityScope) => void
  unclassified: number
}

export function ActivityFilter({ value, onChange, unclassified }: Props) {
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
      <span className="mr-auto inline-flex items-center gap-2 text-sm font-medium">
        <LockKeyhole className="h-4 w-4 text-primary" />Administrador
      </span>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Atividade financeira">
        {(['iptv', 'printing_3d', 'all'] as const).map(scope =>
          <Button key={scope} size="sm" variant={value === scope ? 'default' : 'ghost'}
            aria-pressed={value === scope} onClick={() => onChange(scope)}>{ACTIVITY_LABELS[scope]}</Button>,
        )}
      </div>
      {unclassified > 0 && <Button size="sm" variant={value === 'unclassified' ? 'secondary' : 'ghost'}
        aria-pressed={value === 'unclassified'} onClick={() => onChange('unclassified')}>
        Não classificados: {unclassified}
      </Button>}
    </div>
    {unclassified > 0 && <p className="text-xs text-muted-foreground">
      Os totais por atividade incluem apenas os lançamentos classificados. O Consolidado também inclui o histórico ainda não classificado.
    </p>}
  </div>
}
