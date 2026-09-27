# Table com cabeçalhos em todas as listagens

## What & Why
O card "Todas as Licenças" (Licenciamento.tsx) usa o componente `<Table>` do shadcn com `<TableHeader>` e `<TableHead>` para cada coluna, criando labels visíveis acima dos dados. Todas as outras páginas de listagem do projecto usam layouts custom (card/row) sem labels de colunas. O objectivo é padronizar TODAS as listagens para o mesmo modelo de tabela formal — consistência visual e clareza para o utilizador saber o que está a ver em cada coluna.

## Done looks like
- Todas as páginas listadas abaixo mostram uma linha de cabeçalho com o nome de cada coluna, igual ao card "Todas as Licenças"
- Os dados existentes continuam iguais — apenas a estrutura visual muda (custom rows → Table com TableHeader)
- As acções por linha (botões, dropdowns) permanecem na última coluna "Ações"
- EmptyState continua a funcionar quando não há dados
- Filtros/search acima da tabela permanecem intactos
- Artistas.tsx fica INALTERADO

## Out of scope
- Artistas.tsx — explicitamente excluída pelo utilizador
- Páginas que já usam Table: Licenciamento.tsx (referência), Takedowns.tsx, GestaoShares.tsx, ExecucoesTable.tsx, NotaFiscal.tsx
- Mudanças de dados, hooks, mappers ou lógica de negócio
- Paginação ou ordenação por coluna (sort) — não pedido
- Modais internos (ViewModal, FormModal) — apenas as páginas de listagem

## Steps
1. **Contratos + TemplatesContratos** — Converter `Contratos.tsx` e `TemplatesContratos.tsx` para Table com colunas (ex: Nome, Artista, Tipo, Status, Validade, Ações); manter badges de status e dropdown de acções
2. **CRM** — Converter `CRM.tsx` para Table com colunas adequadas para leads/contactos (ex: Nome, Empresa, Tipo, Status, Último Contacto, Ações)
3. **Marketing (Campanhas + Tarefas + Briefing)** — Converter `Campanhas.tsx`, `Tarefas.tsx` e `Briefing.tsx` para Table com colunas relevantes para cada entidade; manter badges de status/prioridade
4. **Monitoring** — Converter `Monitoramento.tsx` para Table com colunas (ex: Título, Plataforma, Detecções, Status, Acções); Takedowns.tsx já usa Table, não alterar
5. **Projetos** — Converter `Projetos.tsx` para Table com colunas (ex: Nome, Artista, Status, Data, Acções); actualmente usa card grid
6. **Lançamentos** — Converter `Lancamentos.tsx` para Table com colunas (ex: Título, Artista, Tipo, Status, Data de Lançamento, Acções); manter o toggle grid/list mas fazer a view lista usar Table
7. **RH** — Converter `RH.tsx` para Table nas tabs de Funcionários, Folha de Pagamento e Férias/Afastamentos
8. **Inventário** — Converter `Inventario.tsx` para Table com colunas (ex: Nome, Categoria, Condição, Localização, Valor, Acções)
9. **Accounting (Financeiro + Contabilidade)** — Converter `Financeiro.tsx` (transacções) e `Contabilidade.tsx` para Table com colunas relevantes; NotaFiscal.tsx já usa DataTable, não alterar
10. **Configurações/Usuários + Suporte** — Converter `Usuarios.tsx` / `Configuracoes.tsx` e `SupportTickets.tsx` para Table com colunas adequadas

## Relevant files
- `client/src/modules/licensing/pages/Licenciamento.tsx` — referência do padrão Table a seguir
- `client/src/modules/contracts/pages/Contratos.tsx`
- `client/src/modules/contracts/pages/TemplatesContratos.tsx`
- `client/src/modules/crm/pages/CRM.tsx`
- `client/src/modules/marketing/pages/Campanhas.tsx`
- `client/src/modules/marketing/pages/Tarefas.tsx`
- `client/src/modules/marketing/pages/Briefing.tsx`
- `client/src/modules/monitoring/pages/Monitoramento.tsx`
- `client/src/modules/projects/pages/Projetos.tsx`
- `client/src/modules/releases/pages/Lancamentos.tsx`
- `client/src/modules/rh/pages/RH.tsx`
- `client/src/modules/inventory/pages/Inventario.tsx`
- `client/src/modules/accounting/pages/Financeiro.tsx`
- `client/src/modules/accounting/pages/Contabilidade.tsx`
- `client/src/modules/settings/pages/Usuarios.tsx`
- `client/src/modules/support/pages/SupportTickets.tsx`
- `client/src/shared/ui/table.tsx`
