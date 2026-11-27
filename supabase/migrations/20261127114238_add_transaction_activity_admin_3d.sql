-- Etapa 1: classificação de atividade, compatível com os clientes existentes.
-- NULL representa legado ainda não classificado. Nenhuma linha é reclassificada.
BEGIN;

SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

DO $preconditions$
BEGIN
  IF to_regprocedure('public.is_admin()') IS NULL THEN
    RAISE EXCEPTION 'A função existente public.is_admin() é obrigatória.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public.transactions'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS deve estar habilitada em public.transactions.';
  END IF;
END
$preconditions$;

ALTER TABLE public.transactions
  ADD COLUMN activity text,
  ADD CONSTRAINT transactions_activity_check
    CHECK (activity IN ('iptv', 'printing_3d')),
  ADD CONSTRAINT transactions_printing_3d_without_credits_check
    CHECK (
      activity IS DISTINCT FROM 'printing_3d'
      OR (server_id IS NULL AND COALESCE(credits_delta, 0) = 0)
    );

COMMENT ON COLUMN public.transactions.activity IS
  'iptv ou printing_3d; NULL = lançamento legado ainda não classificado. Sem classificação automática do histórico.';

-- Uma política permissiva adicional não restringiria as políticas existentes.
-- Esta política restritiva é combinada com elas por AND, mantendo a titularidade.
CREATE POLICY transactions_activity_admin_guard
  ON public.transactions
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND (
      activity IS DISTINCT FROM 'printing_3d'
      OR (SELECT public.is_admin())
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (
      activity IS DISTINCT FROM 'printing_3d'
      OR (SELECT public.is_admin())
    )
  );

COMMIT;
