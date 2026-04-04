'use client'

import { useState, useEffect, useRef } from 'react'
import { Wallet, Mail, ArrowRight, LogOut, Shield, RefreshCw, Lock, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

type Step = 'login' | 'otp' | 'authenticated'
type AuthMode = 'password' | 'otp'

interface AuthGateProps {
  children: React.ReactNode
  onUserChange?: (user: User | null) => void
}

export function AuthGate({ children, onUserChange }: AuthGateProps) {
  const [step, setStep] = useState<Step>('login')
  const [authMode, setAuthMode] = useState<AuthMode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pendingEmail, setPending] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', '', '', ''])
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
      try {
        // Add timeout to prevent infinite loading
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
        const userPromise = supabase.auth.getUser().then(r => r.data.user)
        const result = await Promise.race([userPromise, timeoutPromise])
        if (result) {
          setUser(result)
          setStep('authenticated')
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
          setStep('authenticated')
          onUserChange?.(session.user)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setStep('login')
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

  // ── Login com senha ──────────────────────────────────────────────────────
  const handlePasswordLogin = async (e: React.FormEvent) => {
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
        setStep('authenticated')
        onUserChange?.(data.user)
      }
    } catch {
      setError('Erro ao fazer login.')
    } finally {
      setLoading(false)
    }
  }

  // ── Enviar OTP ──────────────────────────────────────────────────────────
  const handleOtpRequest = async (e: React.FormEvent) => {
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
      setOtp(['', '', '', '', '', '', '', ''])
      setStep('otp')
      setResendCooldown(60)
      setTimeout(() => otpRefs.current[0]?.focus(), 100)
    } catch {
      setError('Erro ao enviar código.')
    } finally {
      setLoading(false)
    }
  }

  // ── Verificar OTP ──────────────────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (value.length === 8 && /^\d{8}$/.test(value)) {
      const digits = value.split('')
      setOtp(digits)
      otpRefs.current[7]?.focus()
      return
    }
    if (!/^\d?$/.test(value)) return
    const next = [...otp]
    next[index] = value
    setOtp(next)
    if (value && index < 7) {
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
    if (code.length !== 8) {
      setError('Digite todos os 8 dígitos.')
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
        setOtp(['', '', '', '', '', '', '', ''])
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
      setOtp(['', '', '', '', '', '', '', ''])
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
      setOtp(['', '', '', '', '', '', '', ''])
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
    setStep('login')
    setEmail('')
    setPassword('')
    setOtp(['', '', '', '', '', '', '', ''])
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

  // ── Login card ─────────────────────────────────────────────────────────
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
              ? <>Enviamos um código de 8 dígitos para <strong>{pendingEmail}</strong></>
              : 'Controle suas finanças de forma simples e segura'
            }
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* ── Step: Login ── */}
          {step === 'login' && (
            <>
              {authMode === 'password' ? (
                <form onSubmit={handlePasswordLogin} className="space-y-4">
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
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => { setAuthMode('otp'); setError('') }}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Entrar com código por e-mail
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleOtpRequest} className="space-y-4">
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
                    {loading ? 'Enviando...' : <>Enviar código <ArrowRight className="ml-2 h-4 w-4" /></>}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Um código de verificação será enviado para o seu e-mail.
                  </p>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => { setAuthMode('password'); setError('') }}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Entrar com senha
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* ── Step: OTP ── */}
          {step === 'otp' && (
            <form onSubmit={handleVerify} className="space-y-6">
              <div className="space-y-3">
                <Label>Código de verificação</Label>
                <div className="flex gap-1 justify-center">
                  {otp.map((digit, i) => (
                    <Input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el }}
                      type="text"
                      inputMode="numeric"
                      maxLength={8}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="w-10 h-12 text-center text-lg font-mono tabular-nums px-0"
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
                disabled={loading || otp.join('').length !== 8}
                data-testid="verify-otp-btn"
              >
                {loading ? 'Verificando...' : 'Verificar e entrar'}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => { setStep('login'); setError('') }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Voltar
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
