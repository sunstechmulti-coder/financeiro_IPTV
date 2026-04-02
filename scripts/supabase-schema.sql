-- ============================================
-- SUPABASE SCHEMA - Financeiro IPTV (Vetore)
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── TABELA: servidores ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS servidores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome VARCHAR(100) NOT NULL,
  custo_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
  credits_balance INTEGER NOT NULL DEFAULT 0,
  permite_venda_fracionada BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para servidores
CREATE INDEX IF NOT EXISTS idx_servidores_user_id ON servidores(user_id);

-- RLS para servidores
ALTER TABLE servidores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own servidores" ON servidores
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own servidores" ON servidores
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own servidores" ON servidores
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own servidores" ON servidores
  FOR DELETE USING (auth.uid() = user_id);

-- ─── TABELA: transactions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  server_id UUID REFERENCES servidores(id) ON DELETE SET NULL,
  credits_delta INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para transactions
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

-- RLS para transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" ON transactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions" ON transactions
  FOR DELETE USING (auth.uid() = user_id);

-- ─── TABELA: planos ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS planos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  codigo VARCHAR(20) NOT NULL,
  descricao TEXT NOT NULL,
  servidor_id UUID NOT NULL REFERENCES servidores(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('renovacao', 'novo')),
  meses INTEGER NOT NULL,
  creditos INTEGER NOT NULL,
  valor_venda DECIMAL(10,2) NOT NULL,
  custo DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para planos
CREATE INDEX IF NOT EXISTS idx_planos_user_id ON planos(user_id);
CREATE INDEX IF NOT EXISTS idx_planos_servidor_id ON planos(servidor_id);

-- RLS para planos
ALTER TABLE planos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own planos" ON planos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own planos" ON planos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own planos" ON planos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own planos" ON planos
  FOR DELETE USING (auth.uid() = user_id);

-- ─── TABELA: saidas_rapidas ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saidas_rapidas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome VARCHAR(100) NOT NULL,
  categoria VARCHAR(50) NOT NULL,
  server_id UUID REFERENCES servidores(id) ON DELETE SET NULL,
  valor_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
  usa_quantidade BOOLEAN NOT NULL DEFAULT false,
  descricao_padrao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para saidas_rapidas
CREATE INDEX IF NOT EXISTS idx_saidas_rapidas_user_id ON saidas_rapidas(user_id);

-- RLS para saidas_rapidas
ALTER TABLE saidas_rapidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saidas_rapidas" ON saidas_rapidas
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saidas_rapidas" ON saidas_rapidas
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saidas_rapidas" ON saidas_rapidas
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own saidas_rapidas" ON saidas_rapidas
  FOR DELETE USING (auth.uid() = user_id);

-- ─── TABELA: credit_movements ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  server_id UUID NOT NULL REFERENCES servidores(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('purchase', 'sale')),
  credits INTEGER NOT NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para credit_movements
CREATE INDEX IF NOT EXISTS idx_credit_movements_user_id ON credit_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_movements_server_id ON credit_movements(server_id);
CREATE INDEX IF NOT EXISTS idx_credit_movements_transaction_id ON credit_movements(transaction_id);

-- RLS para credit_movements
ALTER TABLE credit_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit_movements" ON credit_movements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credit_movements" ON credit_movements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credit_movements" ON credit_movements
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own credit_movements" ON credit_movements
  FOR DELETE USING (auth.uid() = user_id);

-- ─── TABELA: activation_products ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activation_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome VARCHAR(100) NOT NULL,
  validade_meses INTEGER NOT NULL,
  custos_permitidos DECIMAL(10,2)[] NOT NULL DEFAULT '{}',
  regras_preco JSONB NOT NULL DEFAULT '[]',
  linked_server_id UUID REFERENCES servidores(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para activation_products
CREATE INDEX IF NOT EXISTS idx_activation_products_user_id ON activation_products(user_id);

-- RLS para activation_products
ALTER TABLE activation_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activation_products" ON activation_products
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activation_products" ON activation_products
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own activation_products" ON activation_products
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own activation_products" ON activation_products
  FOR DELETE USING (auth.uid() = user_id);

-- ─── TABELA: activation_transactions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activation_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  product_id UUID REFERENCES activation_products(id) ON DELETE SET NULL,
  product_nome VARCHAR(100) NOT NULL,
  custo DECIMAL(10,2) NOT NULL,
  valor_venda DECIMAL(10,2) NOT NULL,
  lucro DECIMAL(10,2) NOT NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para activation_transactions
CREATE INDEX IF NOT EXISTS idx_activation_transactions_user_id ON activation_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_activation_transactions_product_id ON activation_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_activation_transactions_transaction_id ON activation_transactions(transaction_id);

-- RLS para activation_transactions
ALTER TABLE activation_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activation_transactions" ON activation_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activation_transactions" ON activation_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own activation_transactions" ON activation_transactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own activation_transactions" ON activation_transactions
  FOR DELETE USING (auth.uid() = user_id);

-- ─── FUNÇÃO: auto update timestamp ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para auto-update de updated_at
CREATE TRIGGER update_servidores_updated_at BEFORE UPDATE ON servidores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_planos_updated_at BEFORE UPDATE ON planos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_saidas_rapidas_updated_at BEFORE UPDATE ON saidas_rapidas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activation_products_updated_at BEFORE UPDATE ON activation_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FIM DO SCHEMA
-- ============================================
