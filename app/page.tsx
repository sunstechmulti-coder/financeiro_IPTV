'use client'

import { useState } from 'react'
import { CashFlowDashboard } from '@/components/cash-flow-dashboard'
import { AuthGate } from '@/components/auth-gate'
import type { User } from '@supabase/supabase-js'

interface Subscription {
  id: string
  user_id: string
  plan_type: string
  started_at: string
  expires_at: string | null
  first_access_at: string | null
  is_active: boolean
  is_expired?: boolean
  days_remaining?: number
}

export default function Page() {
  const [user, setUser] = useState<User | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)

  return (
    <AuthGate onUserChange={setUser} onSubscriptionChange={setSubscription}>
      <CashFlowDashboard 
        key={user?.id ?? 'unauthenticated'} 
        subscription={subscription}
      />
    </AuthGate>
  )
}
