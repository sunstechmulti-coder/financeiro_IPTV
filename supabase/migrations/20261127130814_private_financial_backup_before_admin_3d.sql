BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
CREATE SCHEMA cashflow_backup_20261127;
REVOKE ALL ON SCHEMA cashflow_backup_20261127 FROM PUBLIC, anon, authenticated;
CREATE TABLE cashflow_backup_20261127.before_admin_3d (
  id integer PRIMARY KEY CHECK (id = 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  snapshot jsonb NOT NULL
);
ALTER TABLE cashflow_backup_20261127.before_admin_3d ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE cashflow_backup_20261127.before_admin_3d FROM PUBLIC, anon, authenticated;
INSERT INTO cashflow_backup_20261127.before_admin_3d (id, snapshot)
SELECT 1, jsonb_build_object(
  'captured_at', now(),
  'project_id', 'exotuwkjubprpobivmja',
  'purpose', 'Private recovery copy before administrator 3D activity release',
  'tables', jsonb_build_object('servidores', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.servidores t),
'transactions', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.transactions t),
'planos', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.planos t),
'saidas_rapidas', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.saidas_rapidas t),
'credit_movements', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.credit_movements t),
'activation_products', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.activation_products t),
'activation_transactions', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.activation_transactions t),
'revenda_grupos', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.revenda_grupos t),
'user_subscriptions', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.user_subscriptions t),
'user_profiles', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.user_profiles t),
'reseller_wallets', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.reseller_wallets t),
'reseller_credit_ledger', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.reseller_credit_ledger t),
'reseller_renewal_plans', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.reseller_renewal_plans t),
'reseller_settings', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.reseller_settings t)),
  'columns', (SELECT jsonb_agg(to_jsonb(c)) FROM information_schema.columns c WHERE c.table_schema='public'),
  'policies', (SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE p.schemaname='public'),
  'constraints', (SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',con.conname,'definition',pg_get_constraintdef(con.oid))) FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'),
  'triggers', (SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'definition',pg_get_triggerdef(t.oid))) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal),
  'functions', (SELECT jsonb_agg(jsonb_build_object('name',p.proname,'definition',pg_get_functiondef(p.oid))) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f')
);
COMMIT;
