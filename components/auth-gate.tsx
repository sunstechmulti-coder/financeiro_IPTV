'use client'

import { useState, useEffect } from 'react'
import { Wallet, Mail, ArrowRight, LogOut, Lock, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

interface AuthGateProps {
  children: React.ReactNode
  onUserChange?: (user: User | null) => void
}

export function AuthGate({ children, onUserChange }: AuthGateProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  // On mount: check existing session
  useEffect(() => {
    const checkUser = async () => {
      try {
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
        const userPromise = supabase.auth.getUser().then(r => r.data.user)
        const result = await Promise.race([userPromise, timeoutPromise])
        if (result) {
          setUser(result)
          onUserChange?.(result)
        }
      } catch (err) {
        console.error('Error checking user session:', err)
      } finally {
        setMounted(true)
      }
    }
    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user)
          onUserChange?.(session.user)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          onUserChange?.(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Preencha email e senha.')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      })

      if (error) {
        if (error.message.includes('Invalid login')) {
          setError('Email ou senha incorretos.')
        } else {
          setError('Erro ao fazer login. Tente novamente.')
        }
        return
      }

      if (data.user) {
        setUser(data.user)
        onUserChange?.(data.user)
      }
    } catch {
      setError('Erro ao fazer login.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setEmail('')
    setPassword('')
    onUserChange?.(null)
  }

  // Loading skeleton
  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Wallet className="h-5 w-5 animate-pulse" />
          <span>Carregando...</span>
        </div>
      </div>
    )
  }

  // Authenticated
  if (user) {
    return (
      <div className="relative">
        <div className="fixed top-0 right-0 z-50 m-2 sm:m-4">
          <div className="flex items-center gap-1.5 sm:gap-2 rounded-lg border bg-card/95 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm shadow-sm backdrop-blur max-w-[200px] sm:max-w-none">
            <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground truncate hidden sm:inline max-w-[180px]">{user.email}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="h-6 sm:h-7 px-1.5 sm:px-2 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="sr-only">Sair</span>
            </Button>
          </div>
        </div>
        {children}
      </div>
    )
  }

  // Login card
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <Wallet className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Financeiro IPTV</CardTitle>
          <CardDescription>
            Controle suas finanças de forma simples e segura
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  autoComplete="email"
                  autoFocus
                  disabled={loading}
                  data-testid="email-input"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-10"
                  autoComplete="current-password"
                  disabled={loading}
                  data-testid="password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading} data-testid="login-btn">
              {loading ? 'Entrando...' : <>Entrar <ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
