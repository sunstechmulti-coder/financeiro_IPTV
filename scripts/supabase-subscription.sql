-- =====================================================
-- User Subscriptions Table
-- Sistema de assinaturas/licenciamento por tempo
-- =====================================================

-- Criar tabela de assinaturas
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type VARCHAR(20) NOT NULL DEFAULT 'trial', -- 'trial', '1_month', '2_months', '3_months', '6_months', '12_months'
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- NULL = aguardando primeiro acesso (para trial)
  first_access_at TIMESTAMPTZ, -- Quando acessou pela primeira vez (ativa o trial)
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_expires_at ON user_subscriptions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan_type ON user_subscriptions(plan_type);

-- Habilitar RLS
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS

-- Usuários podem ver sua própria assinatura
CREATE POLICY "Users can view own subscription"
  ON user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Usuários podem atualizar first_access_at (para ativar trial no primeiro acesso)
CREATE POLICY "Users can update own first_access"
  ON user_subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Apenas service_role pode inserir/deletar (via API admin)
-- Insert e Delete serão feitos via service_role no backend

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trigger_update_subscription_updated_at ON user_subscriptions;
CREATE TRIGGER trigger_update_subscription_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_updated_at();
