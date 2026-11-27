-- Etapa 1: classificação de atividade, compatível com os clientes existentes.
-- NULL representa legado ainda não classificado. Nenhuma linha é reclassificada.
BEGIN;

SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

-- A verificação ocorre sob os mesmos bloqueios usados pela alteração.
-- Ela não grava, reclassifica ou remove nenhum lançamento existente.
LOCK TABLE public.transactions IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.servidores, public.credit_movements IN SHARE MODE;
CREATE TEMP TABLE cashflow_release_integrity ON COMMIT DROP AS
SELECT 'transactions'::text AS table_name, count(*)::bigint AS row_count,
       md5(COALESCE(string_agg((to_jsonb(t) - 'activity' - 'printing_details')::text, chr(10) ORDER BY t.id), '')) AS digest
FROM public.transactions t
UNION ALL
SELECT 'servidores'::text AS table_name, count(*)::bigint AS row_count,
       md5(COALESCE(string_agg((to_jsonb(t) - 'activity' - 'printing_details')::text, chr(10) ORDER BY t.id), '')) AS digest
FROM public.servidores t
UNION ALL
SELECT 'credit_movements'::text AS table_name, count(*)::bigint AS row_count,
       md5(COALESCE(string_agg((to_jsonb(t) - 'activity' - 'printing_details')::text, chr(10) ORDER BY t.id), '')) AS digest
FROM public.credit_movements t;

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
  ADD COLUMN printing_details jsonb,
  ADD CONSTRAINT transactions_printing_details_check
    CHECK (
      printing_details IS NULL
      OR (
        activity IS NOT DISTINCT FROM 'printing_3d'
        AND jsonb_typeof(printing_details) = 'object'
      )
    ),
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

DO $preserve_existing_data$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
SELECT 'transactions'::text AS table_name, count(*)::bigint AS row_count,
       md5(COALESCE(string_agg((to_jsonb(t) - 'activity' - 'printing_details')::text, chr(10) ORDER BY t.id), '')) AS digest
FROM public.transactions t
UNION ALL
SELECT 'servidores'::text AS table_name, count(*)::bigint AS row_count,
       md5(COALESCE(string_agg((to_jsonb(t) - 'activity' - 'printing_details')::text, chr(10) ORDER BY t.id), '')) AS digest
FROM public.servidores t
UNION ALL
SELECT 'credit_movements'::text AS table_name, count(*)::bigint AS row_count,
       md5(COALESCE(string_agg((to_jsonb(t) - 'activity' - 'printing_details')::text, chr(10) ORDER BY t.id), '')) AS digest
FROM public.credit_movements t
    ) after_state
    FULL JOIN pg_temp.cashflow_release_integrity before_state USING (table_name)
    WHERE after_state.row_count IS DISTINCT FROM before_state.row_count
       OR after_state.digest IS DISTINCT FROM before_state.digest
  ) THEN
    RAISE EXCEPTION 'Integrity verification failed: existing financial records or credit balances changed.';
  END IF;
END
$preserve_existing_data$;

COMMIT;
