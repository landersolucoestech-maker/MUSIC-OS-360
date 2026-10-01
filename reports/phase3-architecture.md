> Historical record. Kept as recorded; not the current contract.

# Fase 3 — Auditoria Read-Only: Arquitetura e Monorepo

Auditoria conduzida sequencialmente (sem sub-agentes paralelos, após um lote anterior de 8 agentes paralelos ter esgotado o limite de sessão antes de persistir achados). Escopo: `pnpm-workspace.yaml`, `turbo.json`, `tsconfig*`, `apps/*`, `packages/*`, limites entre módulos, scripts de build.

## [ARCH-01] `pnpm build` / `pnpm typecheck` / `pnpm test` (scripts raiz não-turbo) quebram em clone limpo por dependerem de `dist/` não commitado de `packages/types` e `packages/ai-skills`

- Área: Arquitetura / Monorepo / DX de build
- Severidade: Medium
- Status: CONFIRMADO
- Arquivos/Componentes:
  - [package.json:14-19](package.json) — scripts raiz `build`, `typecheck`, `test` chamam `pnpm --filter @music-os-360/api ...` / `--filter @music-os-360/web ...` diretamente, sem passar por turbo.
  - [packages/types/package.json:6-24](packages/types/package.json) — `main`/`types`/`exports` apontam para `./dist/*`; só existe `build` (`tsc -p tsconfig.json`) e `typecheck`, sem `prepare`/`postinstall`.
  - [packages/ai-skills/package.json](packages/ai-skills/package.json) — mesmo padrão (`main`/`types` → `./dist/*`).
  - `.gitignore:2` — `dist/` é ignorado (não versionado).
  - [apps/api/package.json](apps/api/package.json) — depende de `@music-os-360/types` e `@music-os-360/ai-skills`; seu próprio `build`/`typecheck` roda `tsc` puro (`tsc -p tsconfig.build.json`), sem buildar dependências primeiro.
  - Contraste: [turbo.json:4-16](turbo.json) — `build`, `typecheck` e `test` declaram `"dependsOn": ["^build"]`, então os scripts `monorepo:build`/`monorepo:typecheck`/`monorepo:lint` (que usam `turbo run ...`) build as dependências primeiro. Os scripts simples (`build`/`typecheck`/`test`, sem prefixo `monorepo:`) NÃO usam turbo e portanto não builda `packages/types`/`packages/ai-skills` antes.
- Evidência:
  - `ls packages/types/dist` e `ls packages/ai-skills/dist` mostram artefatos presentes localmente (builds antigos ainda no disco), mas `git ls-files | grep "packages/(ai-skills|types)/dist"` não retorna nada — nada disso está versionado.
  - `.github/workflows/ci.yml` usa explicitamente `pnpm turbo typecheck` (linha 48) e `pnpm turbo build --filter='./packages/*'` (linhas 73, 272) antes de rodar testes/typecheck — ou seja, o CI está protegido porque usa os comandos turbo-aware, não os scripts simples do `package.json` raiz.
- Causa raiz: Dois conjuntos paralelos de scripts npm coexistem — um turbo-aware (`monorepo:*`) e um não-turbo (`build`/`typecheck`/`test`/`lint` simples) — sem que o segundo dependa do primeiro. Isso é consistente com o próprio README/QUICK_START_GUIDE apresentarem os comandos simples como principais.
- Impacto: Um desenvolvedor (ou qualquer processo) que clona o repositório do zero e roda `pnpm install && pnpm typecheck` (ou `build`/`test`) sem antes rodar `pnpm turbo build --filter='./packages/*'` ou `pnpm --filter packages/* build` receberá erros de módulo não encontrado (`Cannot find module '@music-os-360/types'` / `'@music-os-360/ai-skills'`) — falso-negativo de "projeto quebrado" quando na verdade é uma etapa de build ausente. Não afeta produção/CI (que usa turbo corretamente), mas é uma armadilha real de onboarding/DX e pode mascarar/atrasar diagnóstico de outros erros reais de typecheck.
- Dependências com outros achados: Relacionado à validação de build da Fase 1 (`reports/build-health.md`, que já registrou falhas de typecheck/build) — precisa ser diferenciado: parte das falhas históricas pode ser este problema de ordering, não bugs de código. Ver `reports/phase3-build-validation.md` (pendente) para confirmar se o ambiente de teste atual tem `dist/` pré-existente (mascarando o problema) e portanto não reproduziu.
- Correção recomendada (texto apenas — NÃO implementar): Adicionar `"prepare": "turbo run build --filter='./packages/*'"` no `package.json` raiz (roda automaticamente após `pnpm install`), OU migrar os scripts simples `build`/`typecheck`/`test`/`lint` para delegar a turbo (`turbo run build`, etc.) como já fazem os `monorepo:*`, eliminando a duplicidade de dois conjuntos de scripts. Preferível a segunda opção — reduz a superfície de manutenção e elimina a divergência CI vs local.
- Testes necessários após correção futura: Simular clone limpo (`git clone` para diretório novo, sem copiar `dist/`), rodar `pnpm install && pnpm typecheck && pnpm build && pnpm test` e confirmar sucesso sem etapas manuais adicionais.

## [ARCH-02] Nenhuma dependência cruzada entre `packages/*` — sem risco de ciclo, mas também sem reuso: `ai-skills` e `types` publicam via `dist/`, os demais (`auth`, `config`, `observability`, `schemas`, `ui`, `utils`) publicam via `src/` direto

- Área: Arquitetura / Monorepo
- Severidade: Info
- Status: CONFIRMADO
- Arquivos/Componentes: `packages/*/package.json` (todos os 8 pacotes)
- Evidência: `grep -o "@music-os-360/[a-z-]*" packages/*/package.json` só retorna o próprio nome de cada pacote — nenhum pacote declara depender de outro pacote do monorepo.
- Causa raiz: N/A (observação estrutural, não um bug).
- Impacto: Nenhum ciclo de dependência entre pacotes. Porém a inconsistência de padrão de publicação (`dist/` vs `src/` direto) entre pacotes do mesmo monorepo é uma fonte de confusão e explica por que só `types`/`ai-skills` sofrem do ARCH-01 — os demais pacotes (`main`/`types` apontando para `./src/index.ts`) não precisam de build prévio porque `tsc`/`vite` resolvem `.ts` diretamente via `moduleResolution`.
- Dependências com outros achados: ARCH-01.
- Correção recomendada (texto apenas — NÃO implementar): Padronizar todos os pacotes internos para publicar via `src/` direto (como `auth`/`config`/`observability`/`schemas`/`ui`/`utils` já fazem), eliminando a necessidade de build step para `types`/`ai-skills`, a menos que haja uma razão específica (ex: `ai-skills` conter lógica que precisa rodar fora do monorepo/via npm publish real) — nesse caso, documentar explicitamente por que esses dois são diferentes.
- Testes necessários após correção futura: `pnpm typecheck`/`pnpm build` continuam passando após a mudança de `exports`/`main`/`types` para apontar a `src/`.

## Cobertura

- Coberto: estrutura de workspaces (`pnpm-workspace.yaml`), `turbo.json`, scripts raiz vs scripts por app, dependências declaradas entre `packages/*` e `apps/*`, padrão de publicação de cada pacote, comparação CI vs scripts locais.
- NÃO coberto (por tempo, dado que a execução foi convertida de 8 agentes paralelos para 1 agente sequencial): revisão linha-a-linha de toda a documentação (`ARCHITECTURE_DECISION_RECORDS.md`, `STRUCTURAL_MAP.md`, `RESTRUCTURING_OPERATIONAL_ARCHITECTURE.md`) contra o código real; varredura completa de imports/exports não utilizados em `apps/web` e `apps/api` (parcialmente coberta pela Fase 1 — ver `reports/dead-code-report.md`); detecção de imports que cruzam a fronteira `apps/web` → `apps/api/src` (uma checagem pontual não encontrou nenhum, mas não foi exaustiva).
- Completude estimada: ~35% do escopo original planejado para este cluster. Pontos não cobertos ficam como `REQUER INVESTIGAÇÃO` em execução futura, sem redução unilateral do escopo — apenas não foram alcançados nesta sessão.
