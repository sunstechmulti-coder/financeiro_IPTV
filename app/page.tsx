'use client'

import { useState } from 'react'
import { CashFlowDashboard } from '@/components/cash-flow-dashboard'
import { EmailGate } from '@/components/email-gate'

export default function Page() {
  const [userEmail, setUserEmail] = useState<string | null>(null)

  return (
    <EmailGate onEmailChange={setUserEmail}>
      {/* key forces full remount when the authenticated email changes,
          so all localStorage reads use the newly scoped keys */}
      <CashFlowDashboard key={userEmail ?? 'unauthenticated'} />
    </EmailGate>
  )
}
