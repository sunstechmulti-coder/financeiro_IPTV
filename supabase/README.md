# Etapa 1 — atividade dos lançamentos

Preparação para separar IPTV e impressão 3D no financeiro. A migração deste
diretório foi preparada a partir da estrutura e das políticas consultadas no
projeto `Financeiro_IPTV` em 27/11/2026. Não é um esquema completo para criar
um banco vazio: pressupõe a tabela `public.transactions`, RLS habilitada, as
políticas de titularidade existentes e a função `public.is_admin()`.

## Comportamento

- Acrescenta `transactions.activity`: `iptv`, `printing_3d` ou `NULL`.
- `NULL` significa lançamento legado ainda não classificado. Não identifica
  automaticamente uma atividade e não deve ser apresentado como IPTV confirmado.
- Não executa `UPDATE` ou `DELETE` no histórico. Valores, datas, IDs, snapshots
  financeiros e saldos de servidores são preservados.
- Clientes atuais continuam inserindo sem enviar o campo novo. O mapeamento
  atual ignora a coluna adicional ao ler `select('*')`.
- Uma política **restritiva** preserva as políticas existentes e exige a
  titularidade da linha em leitura, inclusão, alteração e exclusão. Registros
  `printing_3d` exigem também o resultado positivo de `public.is_admin()`.
- O administrador continua limitado às transações da própria conta.
- O banco rejeita `printing_3d` associado a servidor ou movimento de créditos
  diferente de zero. Não há alteração nas regras atuais de IPTV.
- A transação e os limites de espera fazem uma falha abortar o conjunto em vez
  de deixar uma alteração parcialmente aplicada.

## Validação local

```sh
npm --prefix tests/database install --ignore-scripts --no-audit --no-fund
npm --prefix tests/database test
```

Os testes executam SQL e RLS em PostgreSQL embarcado (PGlite), com dados
sintéticos, sem credenciais e sem conexão ao banco hospedado. O contexto mínimo
de autenticação reproduz a função `is_admin()` observada no projeto e simula
sessões com `SET LOCAL ROLE authenticated` ou `anon`.

Cobertura: preservação integral das linhas anteriores; inserções de clientes
antigos; CRUD de IPTV; valores fracionados; entradas e saídas 3D por admin;
negação de acesso a usuários comuns, anônimos e administradores inativos;
isolamento entre contas; metadata de usuário sem poder conceder acesso;
revogação do papel admin; atividades inválidas; e bloqueio de créditos em 3D.

Isso não substitui o teste da aplicação completa nem valida os formulários,
o fluxo de consumo de créditos ou os gráficos, que ainda não foram modificados.

## Ordem de aplicação

1. Revisar esta migração e confirmar que a estrutura e as políticas não mudaram.
2. Registrar a contagem, os totais por usuário/período e os saldos de servidores
   como referência, além de confirmar um meio de recuperação dos dados.
3. Aplicar somente a migração revisada ao projeto existente.
4. Conferir coluna, constraints, política, preservação dos registros e consultas
   autenticadas. Executar novamente os assessores de segurança.
5. Em uma etapa posterior, atualizar tipos, persistência e formulários para
   enviar a atividade explicitamente. Alinhar a exibição de administrador à
   função do banco, que aceita tanto o administrador principal quanto o perfil
   administrador ativo.
6. Preparar a classificação **revisada** do histórico antes de mostrar totais
   por atividade como completos. Itens não classificados precisam de indicação
   própria. Conferir lançamentos vinculados a créditos/ativações antes de
   reclassificá-los.
7. Atualizar Dashboard, Transações, Analytics e exportações para usar os mesmos
   filtros e manter os dados 3D restritos ao administrador.

Nesta etapa não há mudanças na aplicação nem deploy. Após a migração, é
possível manter a versão atual do aplicativo; não é necessário remover a
coluna para recuar uma versão de interface. Depois que houver registros
classificados, remover a coluna apagaria a classificação e não deve ser usado
como procedimento automático de reversão.
