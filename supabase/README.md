# Separação de IPTV e impressão 3D

Esta branch prepara a classificação dos lançamentos e as telas para o administrador.
A estrutura e as políticas relevantes do projeto Financeiro_IPTV foram consultadas
somente por leitura em 27/11/2026.

## Banco proposto

A migração depende de public.transactions, RLS habilitada, das políticas de
titularidade existentes e da função public.is_admin(). Não é um esquema completo
para inicializar um banco vazio.

- activity aceita iptv, printing_3d ou NULL. NULL significa histórico ainda não
  classificado; não há UPDATE nem DELETE automático no histórico.
- printing_details guarda cliente, peça, categoria e pagamento dos lançamentos 3D.
  Só aceita um objeto JSON em uma transação explicitamente classificada como 3D.
- A política restritiva é combinada com as permissões existentes por AND.
  Exige titularidade da linha em todas as operações e administrador para 3D.
- Transações 3D não podem ter servidor ou créditos diferentes de zero.
- Não são criadas funções SECURITY DEFINER, alterados perfis ou ampliados acessos.
- Clientes antigos continuam funcionando sem enviar os campos novos.
- A migração usa uma transação e limites de espera para evitar aplicação parcial.

## Comportamento da aplicação

- A identificação de administrador para o recurso usa a função do próprio banco.
- O recurso só aparece após a confirmação dos campos necessários. Antes da
  migração, a aplicação mantém o fluxo atual de IPTV e não envia colunas novas.
- Novos lançamentos de IPTV recebem atividade explícita após a migração.
- O administrador pode selecionar IPTV, Impressão 3D ou Consolidado e revisar
  registros não classificados na lista de transações.
- Consolidado inclui o histórico sem classificação; as visões por atividade
  incluem somente registros confirmados. Não se presume que todo o legado seja IPTV.
- Um lançamento vinculado a servidor, créditos, movimentos, ativações ou snapshot
  de custo não pode ser convertido para 3D pela interface.
- O formulário 3D aguarda a confirmação do salvamento, bloqueia envio duplicado e
  mantém os campos em caso de falha. Não chama o fluxo de créditos.
- A edição manual de transações existentes preserva os campos de vínculo e os
  snapshots que já estavam no registro.
- Dashboard, lista, CSV e Analytics usam a atividade selecionada. O Analytics
  de IPTV existente é mantido; as visões 3D e consolidada possuem gráficos e PDF
  próprios. Saldo de caixa não é apresentado como lucro por peça.
- Clientes identificados são nomes distintos nas entradas 3D do período. Não é
  uma contagem de clientes novos: campos vazios não são inventados ou estimados.

## Validação

O workflow financial-validation executa os testes em dependências isoladas e usa
somente dados sintéticos, sem credenciais de produção.

```sh
npm --prefix tests/database install --ignore-scripts --no-audit --no-fund
npm --prefix tests/database test
node --experimental-strip-types --test tests/activity.test.mjs
```

São verificados histórico, timestamps, snapshots, valores fracionados, titularidade,
perfis comuns/anônimos/admin, metadata sem poder conceder acesso, perda do papel
admin, detalhes reservados a 3D, filtros, conciliação em centavos, períodos, ranking,
clientes e valores monetários.

A aplicação é compilada com o lockfile existente e credenciais fictícias. O
TypeScript é comparado à base do PR para identificar qualquer diagnóstico novo
sem confundir erros preexistentes com esta alteração. Esses testes não substituem
a validação visual e o teste autenticado da aplicação em um ambiente de revisão.

## Validação do proprietário e aplicação

**Não aplicar SQL, reclassificar lançamentos, fazer merge ou publicar sem validação
explícita do proprietário.** O PR permanece em rascunho para essa revisão.

Depois da validação da estrutura proposta, registrar contagens, totais por período
e saldos como referência, confirmar um meio de recuperação, aplicar somente a
migração revisada e conferir a preservação do histórico e as permissões. A nova
interface pode então ser validada no preview antes de qualquer publicação.

A classificação do histórico deve ser revisada, registro por registro ou por
critérios aprovados. Não fazer classificação em massa por inferência de descrição.

Ao recuar uma versão de interface, conservar os campos adicionais no banco.
Remover a coluna depois de haver registros classificados apagaria a classificação
e não deve ser um procedimento automático de reversão.
