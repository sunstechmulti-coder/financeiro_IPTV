# Financeiro IPTV - PRD (Product Requirements Document)

## Problema Original
Migração completa de um dashboard financeiro IPTV de localStorage/V0 para Supabase, com autenticação real (Email/Senha + OTP), banco PostgreSQL com Row Level Security (RLS) e possibilidade de alteração de senhas.

## Stack
- **Frontend**: Next.js 16 (App Router), React, Tailwind CSS, shadcn/ui
- **Backend/DB**: Supabase (PostgreSQL + Auth)
- **Arquitetura**: Single-tenant com RLS (cada usuário vê apenas seus dados)

## Funcionalidades Implementadas

### Auth
- [x] Login com Email/Senha
- [x] Login com OTP por email (8 dígitos)
- [x] Alteração de senha pelo usuário (Configurações > Conta)
- [x] Script admin para redefinir senhas (`scripts/reset_password.py`)
- [x] API endpoints admin para reset de senha

### Dashboard
- [x] Cards de resumo (Entradas, Saídas, Saldo)
- [x] Créditos por Servidor
- [x] Card de Ativações
- [x] Heatmap de receita
- [x] Tabela de transações

### Configurações
- [x] Gerenciamento de Servidores
- [x] Gerenciamento de Planos
- [x] Gerenciamento de Saídas Rápidas
- [x] Gerenciamento de Ativações
- [x] Aba Conta (alterar senha)

### Banco de Dados
- [x] Schema Supabase com RLS
- [x] Seed de planos e saídas rápidas para admin1
- [x] 5 contas admin + 1 conta sunstechmulti

## Arquitetura de Arquivos
```
/app/
├── app/
│   ├── api/auth/         # API routes (change-password, admin-reset, OTP)
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── auth-gate.tsx     # Auth UI
│   ├── cash-flow-dashboard.tsx
│   ├── config/           # Config pages + Change Password
│   └── ui/               # shadcn components
├── hooks/
│   └── use-supabase-data.ts
├── lib/supabase/         # Supabase clients
└── scripts/
    ├── reset_password.py # Script para admin resetar senhas
    └── supabase-schema.sql
```

## Contas de Teste
- admin1@sunstech.com até admin5@sunstech.com (senha: Admin123!)
- sunstechmulti@gmail.com

## Problemas Conhecidos
- **Turbopack (dev mode)**: Causa erros de hidratação. App roda em **modo produção** (`next build && next start`)
- **WebSocket HMR**: Falha no preview (502) - normal no ambiente Emergent

## Backlog
- P1: Testar todos os fluxos de transação (Entradas/Vendas) end-to-end
- P1: Verificar criação de Servidores, Planos, Saídas Rápidas via UI
- P1: Testar aba Transações (histórico)
- P2: Implementar 2FA/TOTP (Authenticator App)
- P2: Implementar backup/export JSON
- P3: Limpeza de arquivos legados (storage.ts, config-storage.ts, etc.)

## Changelog
- 2026-04-03: Lançamento Express - entrada rápida estilo planilha com autocomplete por código de plano
- 2026-04-03: Corrigido schema DB (credits_delta, credits_balance, credits → DECIMAL) para suportar ativações com custos fracionários
- 2026-04-03: Visual da aba Planos - Tipo "Novo" em verde, "Renovação" em azul
- 2026-04-03: Ordenação de Planos: por servidor → tipo (novo primeiro) → meses (1,3,6,12)
- 2026-04-03: Valor de venda editável na hora da transação (override do preço do plano)
- 2026-04-03: Feature de alteração de senha na aba Conta (Configurações)
- 2026-04-03: Script admin para redefinir senhas (scripts/reset_password.py)
