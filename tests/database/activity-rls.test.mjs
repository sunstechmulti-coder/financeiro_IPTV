import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const migration = await readFile(
  new URL('../../supabase/migrations/20261127114238_add_transaction_activity_admin_3d.sql', import.meta.url),
  'utf8',
)

// Dados sintéticos. Nenhuma conexão ou credencial do projeto real é utilizada.
const adminId = '00000000-0000-4000-8000-000000000001'
const userId = '00000000-0000-4000-8000-000000000002'
const roleAdminId = '00000000-0000-4000-8000-000000000003'
const inactiveAdminId = '00000000-0000-4000-8000-000000000004'
const legacyId = '10000000-0000-4000-8000-000000000001'
const serverId = '20000000-0000-4000-8000-000000000001'
const threeDId = '30000000-0000-4000-8000-000000000001'

// Estrutura, políticas e is_admin reproduzem os objetos relevantes observados
// em produção em 27/11/2026. auth.uid lê claims locais para simular sessões.
const baseline = `
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE anon NOLOGIN;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
  $$;
  GRANT USAGE ON SCHEMA auth TO authenticated, anon;
  CREATE TABLE public.user_profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id), role text NOT NULL DEFAULT 'user',
    is_active boolean NOT NULL DEFAULT true
  );
  CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role = 'admin' AND is_active = true
      ) OR EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = auth.uid() AND email = 'admin1@sunstech.com'
      )
  $$;
  CREATE TABLE public.servidores (id uuid PRIMARY KEY, credits_balance numeric);
  CREATE TABLE public.transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id),
    date date NOT NULL,
    type varchar(20) NOT NULL CHECK (type IN ('income', 'expense')),
    description text NOT NULL,
    amount numeric(12,2) NOT NULL,
    server_id uuid REFERENCES public.servidores(id) ON DELETE SET NULL,
    credits_delta numeric,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    unit_cost_snapshot numeric,
    cost_snapshot numeric,
    profit_snapshot numeric
  );
  CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
  CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can view own transactions" ON public.transactions
    FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "Users can insert own transactions" ON public.transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "Users can update own transactions" ON public.transactions
    FOR UPDATE USING (auth.uid() = user_id);
  CREATE POLICY "Users can delete own transactions" ON public.transactions
    FOR DELETE USING (auth.uid() = user_id);
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated, anon;
  INSERT INTO auth.users VALUES
    ('${adminId}', 'admin1@sunstech.com'), ('${userId}', 'user@example.test'),
    ('${roleAdminId}', 'admin@example.test'), ('${inactiveAdminId}', 'inactive@example.test');
  INSERT INTO public.user_profiles VALUES
    ('${userId}', 'user', true), ('${roleAdminId}', 'admin', true),
    ('${inactiveAdminId}', 'admin', false);
  INSERT INTO public.servidores VALUES ('${serverId}', 12.75);
  INSERT INTO public.transactions
    (id, user_id, date, type, description, amount, server_id, credits_delta,
      unit_cost_snapshot, cost_snapshot, profit_snapshot, created_at, updated_at)
  VALUES
    ('${legacyId}', '${userId}', '2026-11-01', 'income', 'Plano IPTV', 30,
      '${serverId}', -0.5, 7, 3.5, 26.5, '2026-11-01T10:00:00Z', '2026-11-01T10:00:00Z'),
    (gen_random_uuid(), '${adminId}', '2026-11-02', 'income', 'Venda manual antiga',
      180, NULL, NULL, NULL, NULL, NULL, '2026-11-02T10:00:00Z', '2026-11-02T10:00:00Z');
`

test('atividade e RLS preservam IPTV e restringem 3D ao administrador', async (t) => {
  const db = new PGlite()
  try {
    await db.exec(baseline)
    const before = (await db.query('SELECT to_jsonb(t) AS row FROM public.transactions t ORDER BY id')).rows
    const balancesBefore = (await db.query('SELECT * FROM public.servidores ORDER BY id')).rows
    await db.exec(migration)

    // Toda simulação é revertida, inclusive quando o PostgreSQL rejeita a operação.
    async function asIdentity(id, action, { role = 'authenticated', metadata = {} } = {}) {
      await db.exec('BEGIN')
      try {
        const claims = JSON.stringify({ sub: id, role, user_metadata: metadata })
        await db.query("SELECT set_config('request.jwt.claims', $1, true)", [claims])
        await db.exec(role === 'anon' ? 'SET LOCAL ROLE anon' : 'SET LOCAL ROLE authenticated')
        return await action()
      } finally {
        await db.exec('ROLLBACK')
      }
    }

    function insertActivity(activity, owner = userId, extra = {}) {
      return db.query(`
        INSERT INTO public.transactions
          (user_id, date, type, description, amount, activity, server_id, credits_delta)
        VALUES ($1, '2026-11-27', $2, 'Lançamento sintético', 50, $3, $4, $5)
        RETURNING *`,
        [owner, extra.type || 'income', activity, extra.server || null, extra.credits ?? null])
    }

    await t.test('histórico, timestamps, valores, snapshots e saldos não mudam', async () => {
      const after = await db.query("SELECT to_jsonb(t) - 'activity' - 'printing_details' AS row FROM public.transactions t ORDER BY id")
      assert.deepEqual(after.rows, before)
      assert.equal((await db.query('SELECT count(*)::int AS n FROM public.transactions WHERE activity IS NOT NULL')).rows[0].n, 0)
      assert.deepEqual((await db.query('SELECT * FROM public.servidores ORDER BY id')).rows, balancesBefore)
    })

    await t.test('cliente antigo salva sem enviar a nova coluna', async () => {
      await asIdentity(userId, async () => {
        const result = await db.query(`INSERT INTO public.transactions
          (user_id, date, type, description, amount) VALUES ($1, '2026-11-27', 'income', 'Legado', 30)
          RETURNING activity`, [userId])
        assert.equal(result.rows[0].activity, null)
      })
    })

    await t.test('usuário mantém CRUD IPTV e créditos fracionados', async () => {
      await asIdentity(userId, async () => {
        const result = await insertActivity('iptv', userId, { server: serverId, credits: -0.25 })
        const id = result.rows[0].id
        assert.equal(Number(result.rows[0].credits_delta), -0.25)
        const updated = await db.query('UPDATE public.transactions SET amount = 75 WHERE id = $1 RETURNING amount', [id])
        assert.equal(Number(updated.rows[0].amount), 75)
        const deleted = await db.query('DELETE FROM public.transactions WHERE id = $1 RETURNING id', [id])
        assert.equal(deleted.rows.length, 1)
      })
    })

    for (const [name, activity, extra] of [
      ['despesa IPTV', 'iptv', { type: 'expense' }],
      ['entrada sem atividade', null, {}],
      ['despesa sem atividade', null, { type: 'expense' }],
    ]) {
      await t.test(`usuário continua cadastrando ${name}`, () => asIdentity(userId, async () => {
        assert.equal((await insertActivity(activity, userId, extra)).rows.length, 1)
      }))
    }

    await t.test('usuário não cadastra 3D, mesmo com metadata de administrador', async () => {
      await assert.rejects(
        asIdentity(userId, () => insertActivity('printing_3d'), { metadata: { role: 'admin' } }),
        { code: '42501' },
      )
    })

    await t.test('usuário não reclassifica uma venda própria para 3D', async () => {
      await assert.rejects(asIdentity(userId, () => db.query(
        'UPDATE public.transactions SET activity = $1, server_id = NULL, credits_delta = NULL WHERE id = $2',
        ['printing_3d', legacyId],
      )), { code: '42501' })
    })

    await t.test('administrador principal cadastra, edita e exclui 3D sem alterar servidores', async () => {
      await asIdentity(adminId, async () => {
        const result = await insertActivity('printing_3d', adminId)
        const id = result.rows[0].id
        assert.equal((await db.query('UPDATE public.transactions SET amount = 60 WHERE id = $1 RETURNING id', [id])).rows.length, 1)
        assert.equal((await db.query('DELETE FROM public.transactions WHERE id = $1 RETURNING id', [id])).rows.length, 1)
      })
      assert.deepEqual((await db.query('SELECT * FROM public.servidores ORDER BY id')).rows, balancesBefore)
    })

    await t.test('administrador registra saída 3D', () => asIdentity(adminId, async () => {
      assert.equal((await insertActivity('printing_3d', adminId, { type: 'expense' })).rows.length, 1)
    }))

    await t.test('perfil administrador ativo também é reconhecido pela função existente', () =>
      asIdentity(roleAdminId, async () => {
        assert.equal((await insertActivity('printing_3d', roleAdminId)).rows.length, 1)
      }),
    )

    await t.test('perfil administrador inativo não cadastra 3D', async () => {
      await assert.rejects(asIdentity(inactiveAdminId, () => insertActivity('printing_3d', inactiveAdminId)), { code: '42501' })
    })

    for (const [name, extra] of [
      ['servidor associado', { server: serverId }],
      ['débito de créditos', { credits: -0.5 }],
      ['compra de créditos', { credits: 1.25 }],
    ]) {
      await t.test(`3D rejeita ${name}`, async () => {
        await assert.rejects(asIdentity(adminId, () => insertActivity('printing_3d', adminId, extra)), { code: '23514' })
      })
    }

    await t.test('administrador salva detalhes 3D sem contaminar lançamentos IPTV', () =>
      asIdentity(adminId, async () => {
        const tx = (await insertActivity('printing_3d', adminId)).rows[0]
        const details = { customerName: 'Cliente teste', productName: 'Miniatura', paymentMethod: 'Pix' }
        const result = await db.query(
          'UPDATE public.transactions SET printing_details = $1::jsonb WHERE id = $2 RETURNING printing_details',
          [JSON.stringify(details), tx.id],
        )
        assert.deepEqual(result.rows[0].printing_details, details)
      }),
    )

    await t.test('IPTV não aceita detalhes reservados ao 3D', async () => {
      await assert.rejects(asIdentity(adminId, async () => {
        const tx = (await insertActivity('iptv', adminId)).rows[0]
        await db.query('UPDATE public.transactions SET printing_details = $1::jsonb WHERE id = $2', ['{}', tx.id])
      }), { code: '23514' })
    })

    await t.test('detalhes 3D precisam ser um objeto', async () => {
      await assert.rejects(asIdentity(adminId, async () => {
        const tx = (await insertActivity('printing_3d', adminId)).rows[0]
        await db.query('UPDATE public.transactions SET printing_details = $1::jsonb WHERE id = $2', ['[]', tx.id])
      }), { code: '23514' })
    })

    await t.test('atividade desconhecida é rejeitada', async () => {
      await assert.rejects(asIdentity(adminId, () => insertActivity('outra', adminId)), { code: '23514' })
    })

    await t.test('nem administrador transfere lançamento para outra conta', async () => {
      await assert.rejects(asIdentity(adminId, async () => {
        const inserted = await insertActivity('iptv', adminId)
        await db.query('UPDATE public.transactions SET user_id = $1 WHERE id = $2', [userId, inserted.rows[0].id])
      }), { code: '42501' })
    })

    await db.query(`INSERT INTO public.transactions
      (id, user_id, date, type, description, amount, activity)
      VALUES ($1, $2, '2026-11-27', 'income', '3D sintético', 50, 'printing_3d')`, [threeDId, adminId])

    await t.test('outro usuário não lê, edita nem exclui a venda 3D', () => asIdentity(userId, async () => {
      assert.equal((await db.query('SELECT id FROM public.transactions WHERE id = $1', [threeDId])).rows.length, 0)
      assert.equal((await db.query('UPDATE public.transactions SET amount = 1 WHERE id = $1 RETURNING id', [threeDId])).rows.length, 0)
      assert.equal((await db.query('DELETE FROM public.transactions WHERE id = $1 RETURNING id', [threeDId])).rows.length, 0)
    }))

    await t.test('administrador continua sem ler transações de outras contas', () => asIdentity(adminId, async () => {
      assert.equal((await db.query('SELECT id FROM public.transactions WHERE id = $1', [legacyId])).rows.length, 0)
    }))

    await t.test('sessão anônima não lê lançamentos', () => asIdentity(null, async () => {
      assert.equal((await db.query('SELECT id FROM public.transactions')).rows.length, 0)
    }, { role: 'anon' }))

    await t.test('sessão anônima não cadastra lançamentos', async () => {
      await assert.rejects(asIdentity(null, () => insertActivity('iptv'), { role: 'anon' }), { code: '42501' })
    })

    await db.query(`INSERT INTO public.transactions
      (user_id, date, type, description, amount, activity)
      VALUES ($1, '2026-11-27', 'income', 'Antes da remoção de papel', 50, 'printing_3d')`, [roleAdminId])
    await db.query("UPDATE public.user_profiles SET role = 'user' WHERE id = $1", [roleAdminId])

    await t.test('perder o papel admin impede acessar ou descaracterizar o próprio registro 3D', () =>
      asIdentity(roleAdminId, async () => {
        assert.equal((await db.query('SELECT id FROM public.transactions')).rows.length, 0)
        assert.equal((await db.query('UPDATE public.transactions SET activity = NULL RETURNING id')).rows.length, 0)
        assert.equal((await db.query('DELETE FROM public.transactions RETURNING id')).rows.length, 0)
      }),
    )
  } finally {
    await db.close()
  }
})
