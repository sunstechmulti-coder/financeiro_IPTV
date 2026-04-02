'use client'

import { useState } from 'react'
import { CashFlowDashboard } from '@/components/cash-flow-dashboard'
// import { EmailGate } from '@/components/email-gate' // Temporariamente desabilitado

export default function Page() {
  // Acesso direto ao dashboard (autenticação desabilitada temporariamente)
  const [userEmail] = useState<string | null>('usuario@local.dev')

  return (
    // Acesso direto sem autenticação
    <CashFlowDashboard key={userEmail ?? 'local'} />
  )
}
