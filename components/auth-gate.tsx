'use client'

import { useState, useEffect, useRef } from 'react'
import { Wallet, Mail, ArrowRight, LogOut, Shield, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

type Step = 'email' | 'otp' | 'authenticated'

interface AuthGateProps {
  children: React.ReactNode
  onUserChange?: (user: User | null) => void
}

export function AuthGate({ children, onUserChange }: AuthGateProps) {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [pendingEmail, setPending] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [error, setError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const otpRefs = useRef<Array<HTMLInputElement | null>>([])
  const supabase = createClient()

  // On mount: check existing session
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        setStep('authenticated')
        onUserChange?.(user)
      }
      setMounted(true)
    }
    checkUser()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user)
          setStep('authenticated')
          onUserChange?.(session.user)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setStep('email')
          onUserChange?.(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Cooldown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  // ── Step 1: submit email ──────────────────────────────────────────────────
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Por favor, insira um e-mail válido.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase().trim(),
        options: {
          shouldCreateUser: true,
        },
      })

      if (error) {
        if (error.message.includes('rate limit')) {
          setError('Muitas tentativas. Aguarde alguns minutos.')
        } else {
          setError('Erro ao enviar código. Tente novamente.')
        }
        return
      }

      setPending(email)
      setOtp(['', '', '', '', '', ''])
      setStep('otp')
      setResendCooldown(60)
      setTimeout(() => otpRefs.current[0]?.focus(), 100)
    } catch {
      setError('Erro ao enviar código.')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: handle OTP input ──────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    // Allow paste of full 6-digit code
    if (value.length === 6 && /^\d{6}$/.test(value)) {
      const digits = value.split('')
      setOtp(digits)
      otpRefs.current[5]?.focus()
      return
    }
    if (!/^\d?$/.test(value)) return
    const next = [...otp]
    next[index] = value
    setOtp(next)
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = otp.join('')
    if (code.length !== 6) {
      setError('Digite todos os 6 dígitos.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: pendingEmail.toLowerCase().trim(),
        token: code,
        type: 'email',
      })

      if (error) {
        if (error.message.includes('expired')) {
          setError('Código expirado. Solicite um novo.')
        } else {
          setError('Código inválido. Tente novamente.')
        }
        setOtp(['', '', '', '', '', ''])
        otpRefs.current[0]?.focus()
        return
      }

      if (data.user) {
        setUser(data.user)
        setStep('authenticated')
        onUserChange?.(data.user)
      }
    } catch {
      setError('Erro na verificação.')
      setOtp(['', '', '', '', '', ''])
      otpRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    setError('')
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: pendingEmail.toLowerCase().trim(),
        options: {
          shouldCreateUser: true,
        },
      })

      if (error) {
        setError('Erro ao reenviar código.')
        return
      }

      setResendCooldown(60)
      setOtp(['', '', '', '', '', ''])
      setTimeout(() => otpRefs.current[0]?.focus(), 100)
    } catch {
      setError('Erro ao reenviar.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setStep('email')
    setEmail('')
    setOtp(['', '', '', '', '', ''])
    onUserChange?.(null)
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────
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

  // ── Authenticated ─────────────────────────────────────────────────────────
  if (step === 'authenticated' && user) {
    return (
      <div className="relative">
        <div className="fixed top-0 right-0 z-50 m-4">
          <div className="flex items-center gap-2 rounded-lg border bg-card/95 px-3 py-2 text-sm shadow-sm backdrop-blur">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground max-w-[180px] truncate">{user.email}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="ml-2 h-7 px-2 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Sair</span>
            </Button>
          </div>
        </div>
        {children}
      </div>
    )
  }

  // ── Login card shared wrapper ─────────────────────────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            {step === 'otp'
              ? <Shield className="h-8 w-8 text-primary-foreground" />
              : <Wallet className="h-8 w-8 text-primary-foreground" />
            }
          </div>
          <CardTitle className="text-2xl">
            {step === 'otp' ? 'Verificar identidade' : 'Financeiro IPTV'}
          </CardTitle>
          <CardDescription>
            {step === 'otp'
              ? <>Enviamos um código de 6 dígitos para <strong>{pendingEmail}</strong></>
              : 'Controle suas finanças de forma simples e segura'
            }
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* ── Step: email ── */}
          {step === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
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
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={loading} data-testid="submit-email-btn">
                {loading ? 'Enviando...' : <>Continuar <ArrowRight className="ml-2 h-4 w-4" /></>}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Um código de verificação será enviado para o seu e-mail.
              </p>
            </form>
          )}

          {/* ── Step: OTP ── */}
          {step === 'otp' && (
            <form onSubmit={handleVerify} className="space-y-6">
              <div className="space-y-3">
                <Label>Código de verificação</Label>
                <div className="flex gap-2 justify-center">
                  {otp.map((digit, i) => (
                    <Input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el }}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="w-11 h-12 text-center text-lg font-mono tabular-nums"
                      disabled={loading}
                      autoFocus={i === 0}
                      data-testid={`otp-input-${i}`}
                    />
                  ))}
                </div>
                {error && <p className="text-sm text-destructive text-center">{error}</p>}
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || otp.join('').length !== 6}
                data-testid="verify-otp-btn"
              >
                {loading ? 'Verificando...' : 'Verificar e entrar'}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => { setStep('email'); setError('') }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Trocar e-mail
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || loading}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <RefreshCw className="h-3 w-3" />
                  {resendCooldown > 0 ? `Reenviar (${resendCooldown}s)` : 'Reenviar código'}
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
