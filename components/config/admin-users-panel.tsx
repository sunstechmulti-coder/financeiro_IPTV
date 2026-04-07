'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users,
  UserPlus,
  Trash2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Check,
  Loader2,
  RefreshCw,
  Calendar,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Subscription {
  id: string
  user_id: string
  plan_type: string
  started_at: string
  expires_at: string | null
  first_access_at: string | null
  is_active: boolean
}

interface AdminUser {
  id: string
  email: string | undefined
  created_at: string
  last_sign_in_at: string | undefined
  subscription: Subscription | null
}

const PLAN_LABELS: Record<string, string> = {
  trial: 'Teste Grátis',
  '1_month': '1 Mês',
  '2_months': '2 Meses',
  '3_months': '3 Meses',
  '6_months': '6 Meses',
  '12_months': '12 Meses',
}

export function AdminUsersPanel() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [error, setError] = useState('')

  // Novo usuário
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')

  // Deletar
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Editar plano
  const [editPlanDialogOpen, setEditPlanDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [selectedPlan, setSelectedPlan] = useState('')
  const [updatingPlan, setUpdatingPlan] = useState(false)
  const [planUpdateSuccess, setPlanUpdateSuccess] = useState('')

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true)
    setError('')
    try {
      const res = await fetch('/api/admin/users')
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Erro ao carregar usuários.')
        return
      }
      setUsers(json.users)
    } catch {
      setError('Erro ao conectar ao servidor.')
    } finally {
      setLoadingUsers(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    setCreateSuccess('')
    setCreating(true)

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, password: newPassword }),
      })
      const json = await res.json()
      if (!res.ok) {
        setCreateError(json.error || 'Erro ao criar usuário.')
        return
      }
      setCreateSuccess(`Usuário ${json.user.email} criado com sucesso!`)
      setNewEmail('')
      setNewPassword('')
      await fetchUsers()
      setTimeout(() => {
        setDialogOpen(false)
        setCreateSuccess('')
      }, 1500)
    } catch {
      setCreateError('Erro ao conectar ao servidor.')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    setDeletingId(userId)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Erro ao remover usuário.')
        return
      }
      setUsers((prev) => prev.filter((u) => u.id !== userId))
    } catch {
      setError('Erro ao remover usuário.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleUpdatePlan = async () => {
    if (!editingUser || !selectedPlan) return
    setUpdatingPlan(true)
    setPlanUpdateSuccess('')

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: editingUser.id, planType: selectedPlan }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Erro ao atualizar plano.')
        return
      }
      setPlanUpdateSuccess('Plano atualizado com sucesso!')
      await fetchUsers()
      setTimeout(() => {
        setEditPlanDialogOpen(false)
        setEditingUser(null)
        setSelectedPlan('')
        setPlanUpdateSuccess('')
      }, 1500)
    } catch {
      setError('Erro ao atualizar plano.')
    } finally {
      setUpdatingPlan(false)
    }
  }

  const openEditPlanDialog = (user: AdminUser) => {
    setEditingUser(user)
    setSelectedPlan(user.subscription?.plan_type || 'trial')
    setEditPlanDialogOpen(true)
    setPlanUpdateSuccess('')
  }

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getSubscriptionBadge = (u: AdminUser) => {
    // Admin não mostra badge de subscription
    if (u.email === 'admin1@sunstech.com') {
      return null
    }

    const sub = u.subscription
    
    if (!sub) {
      return <Badge variant="outline" className="text-xs">Sem plano</Badge>
    }

    // Se ainda não fez primeiro acesso
    if (!sub.first_access_at) {
      return (
        <Badge className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">
          Aguardando ativação
        </Badge>
      )
    }

    // Calcular dias restantes
    const now = new Date()
    const expiresAt = sub.expires_at ? new Date(sub.expires_at) : null
    const daysRemaining = expiresAt 
      ? Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      : 0

    // Expirado
    if (daysRemaining <= 0) {
      return (
        <Badge variant="destructive" className="text-xs">
          Expirado
        </Badge>
      )
    }

    // Menos de 7 dias - vermelho/laranja
    if (daysRemaining <= 7) {
      return (
        <Badge className="text-xs bg-orange-500/20 text-orange-400 border-orange-500/30">
          {daysRemaining}d restantes
        </Badge>
      )
    }

    // Menos de 15 dias - amarelo
    if (daysRemaining <= 15) {
      return (
        <Badge className="text-xs bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
          {daysRemaining}d restantes
        </Badge>
      )
    }

    // Trial
    if (sub.plan_type === 'trial') {
      return (
        <Badge className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">
          Teste - {daysRemaining}d
        </Badge>
      )
    }

    // Ativo normal - verde
    return (
      <Badge className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
        {PLAN_LABELS[sub.plan_type] || sub.plan_type} - {daysRemaining}d
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            Gerenciar Usuários
          </h3>
          <p className="text-sm text-muted-foreground">
            Crie e gerencie os usuários que têm acesso à plataforma.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchUsers}
            disabled={loadingUsers}
          >
            <RefreshCw className={`h-4 w-4 ${loadingUsers ? 'animate-spin' : ''}`} />
            <span className="sr-only">Atualizar</span>
          </Button>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open)
              if (!open) {
                setNewEmail('')
                setNewPassword('')
                setCreateError('')
                setCreateSuccess('')
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="mr-2 h-4 w-4" />
                Novo Usuário
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Criar Novo Usuário</DialogTitle>
                <DialogDescription>
                  O usuário poderá fazer login com o e-mail e senha informados.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="new-user-email">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="new-user-email"
                      type="email"
                      placeholder="usuario@email.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="pl-9"
                      disabled={creating}
                      autoFocus
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-user-password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="new-user-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-9 pr-10"
                      disabled={creating}
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

                {createError && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {createError}
                  </div>
                )}
                {createSuccess && (
                  <div className="flex items-center gap-2 text-sm text-emerald-600">
                    <Check className="h-4 w-4 shrink-0" />
                    {createSuccess}
                  </div>
                )}

                <DialogFooter>
                  <Button type="submit" disabled={creating} className="w-full">
                    {creating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Criar Usuário
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            Usuários cadastrados
          </CardTitle>
          {!loadingUsers && (
            <CardDescription>
              {users.length} {users.length === 1 ? 'usuário' : 'usuários'} no total
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loadingUsers ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Carregando usuários...
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
              <Users className="h-8 w-8 opacity-30" />
              <p className="text-sm">Nenhum usuário cadastrado.</p>
            </div>
          ) : (
            <div className="divide-y">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{u.email}</span>
                      {u.email === 'admin1@sunstech.com' && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          Admin
                        </Badge>
                      )}
                      {getSubscriptionBadge(u)}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span>Criado em {formatDate(u.created_at)}</span>
                      {u.email !== 'admin1@sunstech.com' && u.subscription?.expires_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Expira: {new Date(u.subscription.expires_at).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                      {u.last_sign_in_at && (
                        <span className="hidden sm:inline">
                          Último acesso: {formatDate(u.last_sign_in_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    {u.email !== 'admin1@sunstech.com' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditPlanDialog(u)}
                          className="h-8"
                        >
                          <Clock className="h-3.5 w-3.5 mr-1.5" />
                          <span className="hidden sm:inline">Plano</span>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                              disabled={deletingId === u.id}
                            >
                              {deletingId === u.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                              <span className="sr-only">Remover usuário</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover usuário</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja remover o usuário <strong>{u.email}</strong>? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteUser(u.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de edição de plano */}
      <Dialog
        open={editPlanDialogOpen}
        onOpenChange={(open) => {
          setEditPlanDialogOpen(open)
          if (!open) {
            setEditingUser(null)
            setSelectedPlan('')
            setPlanUpdateSuccess('')
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Plano</DialogTitle>
            <DialogDescription>
              Alterar o plano de assinatura de <strong>{editingUser?.email}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="plan-select">Tipo de Plano</Label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger id="plan-select">
                  <SelectValue placeholder="Selecione um plano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Teste Grátis (30 dias)</SelectItem>
                  <SelectItem value="1_month">1 Mês</SelectItem>
                  <SelectItem value="2_months">2 Meses</SelectItem>
                  <SelectItem value="3_months">3 Meses</SelectItem>
                  <SelectItem value="6_months">6 Meses</SelectItem>
                  <SelectItem value="12_months">12 Meses (1 Ano)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                O plano será ativado imediatamente a partir de hoje.
              </p>
            </div>

            {editingUser?.subscription?.expires_at && (
              <div className="rounded-md bg-muted/50 p-3 text-sm">
                <p className="text-muted-foreground">
                  <strong>Plano atual:</strong> {PLAN_LABELS[editingUser.subscription.plan_type] || editingUser.subscription.plan_type}
                </p>
                <p className="text-muted-foreground">
                  <strong>Expira em:</strong> {new Date(editingUser.subscription.expires_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            )}

            {planUpdateSuccess && (
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <Check className="h-4 w-4 shrink-0" />
                {planUpdateSuccess}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditPlanDialogOpen(false)}
              disabled={updatingPlan}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdatePlan}
              disabled={updatingPlan || !selectedPlan}
            >
              {updatingPlan ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Plano'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
