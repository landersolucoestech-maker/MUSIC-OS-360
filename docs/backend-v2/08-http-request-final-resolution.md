> Historical record. Kept as recorded; not the current contract.

# 08 — Resolução Final dos 4 Requests Incertos (com evidência do backend legacy)

Continuação read-only de [`07-http-request-unknowns-resolution.md`](./07-http-request-unknowns-resolution.md). Escopo de consulta: `apps/web/**` (já coberto no Prompt 10) + `apps/api/**`, restrito exclusivamente aos endpoints/DTOs/schemas/controllers diretamente ligados aos 4 casos abaixo — nenhuma auditoria geral do backend foi feita. Nenhum arquivo foi alterado (nem `apps/web`, nem `apps/api`). Doc 07 não foi modificado.

Os 4 casos remanescentes do Prompt 10 eram, na prática, **3 sintomas de 1 mesma causa raiz** (o wrapper genérico `storage.ts` usado por 12 chamadores diferentes) mais **1 caso independente** (`financialCategoriesService.suggest`). Para fechar a causa raiz do wrapper genérico, usei como evidência os 2 chamadores concretos já citados no Prompt 10 (`accounting.service.ts` → tabelas `"transacoes"` e `"notas_fiscais"`) e busquei os endpoints reais correspondentes (`/transactions`, `/invoices`) no backend legacy.

---

## Caso 1 — `storage.create<T>` (UNKNOWN_FIELD #2 do doc 07)

```text
CALL_SITE:
modules/accounting/services/accounting.service.ts — createTransaction(data) → storage.create("transacoes", data as never)

ENDPOINT:
POST /transactions (TABLE_ENDPOINT["transacoes"] = "/transactions", ver api-client.ts)

INCERTEZA:
UNKNOWN_FIELD

EVIDÊNCIA_FRONTEND:
accounting.service.ts:12-13 — createTransaction(data: Record<string, unknown>) repassa cru para storage.create, sem validação/tipagem própria no frontend.

EVIDÊNCIA_LEGACY:
apps/api/src/modules/transactions/transactions.controller.ts — @Post() usa @Body(new ZodValidationPipe(createTransacaoSchema)) dto: CreateTransacaoDto.
apps/api/src/modules/transactions/validators/transacao.validator.ts — createTransacaoSchema (Zod).
apps/api/src/modules/transactions/entities/transaction.entity.ts — @Entity('transactions') confirma que "transacoes" (chave lógica do frontend) mapeia para a tabela real "transactions".

RESULTADO:
Campos aceitos por createTransacaoSchema:
- tipoTransacao: enum ["receita","despesa","investimento","imposto","transferencia"] — obrigatório
- descricao: string (min 1) — obrigatório
- valor: string|number (transformado para string) — obrigatório na prática (superRefine exige >0)
- dataTransacao: string — obrigatório
- status: enum ["pendente","aprovado","pago","cancelado","atrasado"] — opcional, default "pendente"
- tipoPagamento: enum ["avista","parcelado"] — opcional, default "avista"
- tipoCliente, categoria, subcategoria, formaPagamento (enum: pix|ted|boleto|cartao-credito|cartao-debito|dinheiro|cheque), quantidadeParcelas (string), intervaloParcelas (enum: mensal|quinzenal|semanal), dataPrimeiraParcela, artistaVinculado, projetoVinculado, contratoVinculado, eventoVinculado, fornecedorCliente, orgaoArrecadador, itemInvestimento, motivoViagem, nomePublicidade, observacao, anexoUrl, anexoNome — todos string, opcionais
- Regras condicionais via superRefine: formaPagamento obrigatório no create; tipoCliente/categoria/subcategoria/artistaVinculado/projetoVinculado/eventoVinculado exigidos condicionalmente conforme combinação de tipoTransacao/categoria/subcategoria.

CONFIANÇA:
CONFIRMED

JUSTIFICATIVA:
O frontend não declara nenhum shape próprio para este caller (`Record<string, unknown>` — compatível com qualquer objeto), portanto não há divergência a marcar como CONFLICTING: o backend é a única fonte real do contrato de campos aqui. Ressalva: isso resolve apenas ESTE chamador concreto de storage.create — o wrapper genérico em si (usado por outros 11 arquivos com outras tabelas: settings, licensing, projects, releases, contracts, catalog, rh, monitoring, inventory, events, domain-events/consistency) continua sem evidência própria; cada um mapearia para um endpoint/DTO backend diferente, não investigados aqui (fora do escopo — "consulte somente o endpoint diretamente relacionado a cada um dos 4 casos").
```

## Caso 2 — `storage.update<T>` (UNKNOWN_FIELD #3 do doc 07)

```text
CALL_SITE:
modules/accounting/services/accounting.service.ts — updateTransaction(id, patch) → storage.update("transacoes", id, patch)

ENDPOINT:
PATCH /transactions/:id

INCERTEZA:
UNKNOWN_FIELD

EVIDÊNCIA_FRONTEND:
accounting.service.ts:16-17 — updateTransaction(id, patch: Record<string, unknown>) repassa cru.

EVIDÊNCIA_LEGACY:
apps/api/src/modules/transactions/transactions.controller.ts — @Patch(':id') usa @Body(new ZodValidationPipe(patchTransacaoSchema)) dto: PatchTransacaoDto.
apps/api/src/modules/transactions/validators/transacao.validator.ts — patchTransacaoSchema.

RESULTADO:
Mesmo conjunto de campos do Caso 1 (createTransacaoSchema), mas patchTransacaoSchema torna TODOS opcionais — inclusive tipoTransacao — e remove os .default() de status/tipoPagamento (um PATCH não sobrescreve silenciosamente esses campos se omitidos). As regras condicionais (superRefine) só disparam se tipoTransacao estiver presente no payload enviado.

CONFIANÇA:
CONFIRMED

JUSTIFICATIVA:
Mesma lógica do Caso 1 — sem shape declarado no frontend para conflitar, backend é a fonte do contrato. Mesma ressalva sobre os outros 11 chamadores do wrapper genérico não estarem cobertos.
```

## Caso 3 — `financialCategoriesService.suggest(context)` (UNKNOWN_FIELD #12 do doc 07)

```text
CALL_SITE:
modules/accounting/services/financial-categories.service.ts — financialCategoriesService.suggest(context)

ENDPOINT:
POST /financial-categories/suggest (rota esperada pelo frontend — ver origem do path no próprio service)

INCERTEZA:
UNKNOWN_FIELD

EVIDÊNCIA_FRONTEND:
financial-categories.service.ts:47-48 — suggest: (context: Record<string, unknown>) => api.post<FinancialSuggestion[]>("/financial-categories/suggest", context). Nenhum caller localizado em todo apps/web/src (confirmado no Prompt 10).

EVIDÊNCIA_LEGACY:
apps/api/src/modules/financial-categories/financial-categories.controller.ts (@Controller('financial-categories')) — rotas existentes: GET / (list), GET /tree, GET /search, GET /:id, GET /:id/descendants, GET /:id/ancestors, POST / (create), PATCH /:id (update), PATCH /:id/move, PATCH /:id/reorder, PATCH /:id/archive, PATCH /:id/restore, DELETE /:id.
apps/api/src/modules/financial-categories/dto/financial-categories.dto.ts — classes existentes: CreateFinancialCategoryDto, UpdateFinancialCategoryDto (PartialType), QueryFinancialCategoryDto, MoveFinancialCategoryDto, ReorderFinancialCategoryDto. Nenhuma classe relacionada a "suggest".

RESULTADO:
NÃO EXISTE rota POST /financial-categories/suggest no controller do backend legacy, e não existe nenhum DTO de "suggest". O endpoint que o método do frontend chamaria simplesmente não está implementado no backend.

CONFIANÇA:
CONFIRMED

JUSTIFICATIVA:
Isto não é uma divergência de shape (não há nada para comparar campo-a-campo), é uma confirmação definitiva de que o método suggest() do serviço frontend é código morto/apontando para um endpoint inexistente — nem o formato do `context` nem o da resposta têm contrato algum no backend atual. Marcado CONFIRMED (fato definitivamente estabelecido), não CONFLICTING (não há dois contratos divergentes — há um contrato ausente) nem UNRESOLVED (a pergunta "existe backend para isto?" tem resposta definitiva: não).
```

## Caso 4 — `storage.create<T>`/`storage.update<T>` — tipo genérico `T` (UNKNOWN_TYPE #2 do doc 07)

```text
CALL_SITE:
shared/lib/storage.ts — create<T>/update<T> (mesmo wrapper dos Casos 1 e 2); instanciado concretamente por accounting.service.ts para "transacoes" (POST/PATCH /transactions) e "notas_fiscais" (POST/PATCH /invoices)

ENDPOINT:
POST/PATCH /transactions(/:id) e POST/PATCH /invoices(/:id)

INCERTEZA:
UNKNOWN_TYPE

EVIDÊNCIA_FRONTEND:
storage.ts:4 — StorageRow = Record<string, unknown> & {id: string}; T não fixado no wrapper. accounting.service.ts:12-17,44-49 — dois chamadores concretos (transacoes, notas_fiscais), ambos com data/patch tipados só como Record<string, unknown>.

EVIDÊNCIA_LEGACY (transacoes → /transactions):
Mesma do Caso 1/2 — createTransacaoSchema/patchTransacaoSchema (Zod), apps/api/src/modules/transactions/validators/transacao.validator.ts.

EVIDÊNCIA_LEGACY (notas_fiscais → /invoices):
apps/api/src/modules/invoices/invoices.controller.ts — @Post() usa @Body() dto: CreateInvoiceDto; @Patch(':id') usa @Body() dto: UpdateInvoiceDto.
apps/api/src/modules/invoices/dto/invoices.dto.ts — CreateInvoiceDto (class-validator), UpdateInvoiceDto = PartialType(CreateInvoiceDto).
apps/api/src/modules/invoices/entities/invoice.entity.ts — @Entity('invoices') confirma "notas_fiscais" (chave lógica do frontend) → tabela real "invoices".

RESULTADO:
Para a instanciação "transacoes": tipo efetivo = CreateTransacaoDto/PatchTransacaoDto (Zod, campos listados no Caso 1/2).
Para a instanciação "notas_fiscais": tipo efetivo = CreateInvoiceDto (class-validator) — campos: numero?, serie?, tipo_nota? (enum: nfse|nfe|nfce), cliente_id? (uuid), venda_id? (uuid), natureza_operacao?, codigo_servico_municipal?, codigo_municipio?, cfop?, descricao_servicos?, data_emissao?, vencimento?, status?, tomador_cnpj?, tomador_razao_social?, tomador_inscricao_estadual?, tomador_inscricao_municipal?, tomador_email? (email), tomador_endereco?, tomador_cidade?, tomador_uf?, tomador_cep?, valor? (number, campo legado espelhando valor_servicos), valor_servicos? (number), valor_deducoes? (number), base_calculo? (number), aliquota_iss? (number, 0-100), valor_iss? (number), iss_retido? (boolean), valor_pis? (number), valor_cofins? (number), valor_inss? (number), valor_ir? (number), valor_csll? (number), valor_liquido? (number), forma_pagamento?, condicao_pagamento?, url_pdf?, observacoes?, itens? (InvoiceItemDto[]: descricao!, codigo_servico?, quantidade! (min 1), valor_unitario! (min 0), valor_total! (min 0) — únicos campos obrigatórios de todo o DTO, dentro do array itens), metadata? (Record<string,unknown>). UpdateInvoiceDto = mesmos campos, todos opcionais (PartialType).
Um comentário no próprio DTO do backend documenta que ele substituiu uma versão anterior em inglês/formato Stripe (type, amount, issuerName, recipientDoc) que não batia com o payload real do formulário — reforça que os nomes pt-BR acima são a fonte de verdade atual.

CONFIANÇA:
CONFIRMED

JUSTIFICATIVA:
Sem shape declarado no frontend para nenhuma das duas instanciações, não há CONFLICTING possível — o backend fornece o único contrato de tipo existente. O tipo genérico T do wrapper em si permanece formalmente polimórfico (por design: mesma função serve tabelas completamente diferentes); o que se resolve aqui é a instanciação concreta de T para os 2 casos com evidência de uso real, não o wrapper como abstração.
```

---

## Observação de coerência entre `TABLE_ENDPOINT` (frontend) e entidades reais (backend)

Achado incidental que reforça a confiança nos dois mapeamentos acima: `api-client.ts` (`TABLE_ENDPOINT`) declara `transacoes: "/transactions"` e `notas_fiscais: "/invoices"`; o backend confirma independentemente, via `@Entity('transactions')` e `@Entity('invoices')`, que essas são de fato as tabelas/rotas reais — os dois lados (mapeamento do frontend e entidade do backend) concordam, sem qualquer sinal de divergência de nomenclatura nestes dois casos específicos.

## Resumo

```text
UNKNOWN_FIELDS_INITIAL_THIS_STEP: 3
UNKNOWN_FIELDS_RESOLVED: 3
UNKNOWN_FIELDS_CONFLICTING: 0
UNKNOWN_FIELDS_REMAINING: 0

UNKNOWN_TYPES_INITIAL_THIS_STEP: 1
UNKNOWN_TYPES_RESOLVED: 1
UNKNOWN_TYPES_CONFLICTING: 0
UNKNOWN_TYPES_REMAINING: 0
```

Ressalva importante (não é um "remaining" formal, mas deve ficar registrada): a resolução dos Casos 1, 2 e 4 fecha apenas as **duas instanciações concretas evidenciadas** do wrapper genérico `storage.create<T>`/`storage.update<T>` (tabelas `"transacoes"` e `"notas_fiscais"`). Os outros 11 arquivos que chamam esse mesmo wrapper (`settings.service.ts`, `licensing.service.ts`, `projects.service.ts`, `releases.service.ts`, `contracts.service.ts`, `catalog.service.ts`, `rh.service.ts`, `monitoring.service.ts`, `inventory.service.ts`, `events.service.ts`, `shared/domain-events/consistency.ts`) continuam sem contrato de campos resolvido — cada um exigiria repetir este mesmo processo (achar a tabela lógica usada, mapear via `TABLE_ENDPOINT`, localizar o controller/DTO correspondente em `apps/api`) para as tabelas que efetivamente usam. Isso está fora do escopo desta etapa, que pediu resolução exclusiva dos 4 casos específicos do doc 07.

## Cobertura

Consultei em `apps/api` apenas: `modules/transactions/{transactions.controller.ts, validators/transacao.validator.ts, entities/transaction.entity.ts}`, `modules/invoices/{invoices.controller.ts, dto/invoices.dto.ts, entities/invoice.entity.ts}`, `modules/financial-categories/{financial-categories.controller.ts, dto/financial-categories.dto.ts}`. Nenhum outro módulo do backend foi lido. Response bodies, permissões/guards e regras de negócio não foram analisados (fora do escopo, conforme instruído).
