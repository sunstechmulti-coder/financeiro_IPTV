'use client'

import { useState } from 'react'
import { CashFlowDashboard } from '@/components/cash-flow-dashboard'
import { AuthGate } from '@/components/auth-gate'
import type { User } from '@supabase/supabase-js'

export default function Page() {
  const [user, setUser] = useState<User | null>(null)

  return (
    <AuthGate onUserChange={setUser}>
      <CashFlowDashboard key={user?.id ?? 'unauthenticated'} />
    </AuthGate>
  )
}
