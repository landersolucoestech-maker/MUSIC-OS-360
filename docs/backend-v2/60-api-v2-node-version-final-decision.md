> Historical record. Kept as recorded; not the current contract.

# 60 — Decisão Final: Versão do Node.js para a `apps/api-v2`

Definição read-only da versão de Node.js da futura `apps/api-v2`, reavaliando genuinamente entre manter Node 20 (versão do projeto atual, doc57) ou adotar uma LTS mais recente, com verificação em fontes oficiais atuais (nodejs.org, Vercel). Nenhum `.nvmrc`/`package.json`/`engines`/Dockerfile/GitHub Actions/config Vercel foi alterado. `apps/api-v2` não foi criado. `apps/web`, `apps/api` (legacy) e deployment não foram alterados.

## Estado atual (contexto, não reaberto)

```text
Projeto atual: Node.js 20
API v2 já definida: NestJS 11.1.28 + @nestjs/platform-express 11.1.28 + Express 5.2.1 + PostgreSQL 17 +
  Drizzle ORM + pnpm 10.11.0
```

## Verificação externa (fontes oficiais consultadas nesta etapa)

```text
nodejs.org/en/about/eol e nodejs.org/en/about/previous-releases (consultados diretamente):
- Node.js 20 (Iron): END-OF-LIFE — data de fim de suporte 30 de abril de 2026, JÁ PASSADA na data
  desta etapa. Nenhum patch de segurança é mais publicado para esta linha.
- Node.js 22 (Jod): em LTS, fase de Maintenance (janela final de suporte, sem novas features, só
  patches críticos) — suporte até ~abril de 2027 conforme o ciclo padrão de 12 meses de Maintenance
  após o fim da fase Active LTS.
- Node.js 24 (Krypton): "Current Latest LTS" — Active LTS vigente no momento desta consulta, suporte
  oficial confirmado até 30 de abril de 2028.
- Node.js 26: linha "Current" (não-LTS) desde maio de 2026, só entra em LTS em outubro de 2026 —
  explicitamente NÃO recomendada para produção enquanto estiver fora da fase LTS (política padrão do
  próprio projeto Node.js).

vercel.com/changelog/node-js-20-is-being-deprecated (Vercel, fonte oficial, achado decisivo):
- Node.js 20 será DESABILITADO para novos deployments na Vercel em 1º de outubro de 2026 — deployments
  já existentes continuam funcionando, mas nenhum NOVO deployment com Node 20 será aceito a partir
  dessa data (menos de 2 meses a partir da data desta etapa).
- Vercel recomenda explicitamente migrar para Node 22 ou Node 24 antes dessa data.
- Node 24 é selecionável na Vercel via "engines": {"node": "24.x"} em package.json (mecanismo já
  documentado oficialmente pela própria Vercel), sobrepondo a versão do Project Settings no próximo
  deployment.
```

Este achado da Vercel é decisivo para este projeto especificamente, porque o deployment serverless na
Vercel já é um dos 2 alvos de deployment reais e comprovados desta aplicação (doc42/43, não reaberto
aqui) — significa que, além de Node 20 já estar EOL do ponto de vista do próprio projeto Node.js,
também está a ~2 meses de parar de aceitar NOVOS deployments na própria plataforma onde a `apps/api-v2`
já está confirmada que vai rodar.

---

## Comparação nos 12 critérios pedidos

```text
1. Suporte oficial restante
Node 20: ZERO — já em End-of-Life, nenhum patch de segurança futuro.
Node 22: ~8-9 meses de Maintenance LTS restantes a partir de agora (até ~abril de 2027).
Node 24: ~21 meses de Active/Maintenance LTS combinados a partir de agora (até abril de 2028) — a
  maior janela de suporte entre as 3 opções avaliadas.
DIFERENCIADOR: Node 24.

2. Status LTS
Node 20: EOL (fora de qualquer fase de suporte).
Node 22: Maintenance LTS (suportado, mas já na fase final do seu ciclo).
Node 24: Active LTS (fase de maior estabilidade recomendada para adoção de projetos novos).
DIFERENCIADOR: Node 24 — é exatamente a fase que a documentação oficial do Node.js recomenda para
  novos projetos em produção.

3. Compatibilidade com NestJS 11.1.28
Node 20/22/24: TODAS compatíveis — @nestjs/core 11.1.28 declara "engines": Node.js >= 20 (piso mínimo,
  doc59), sem teto superior declarado; nenhuma das 3 versões é rejeitada pelo framework.
DIFERENCIADOR: NENHUM — mas Node 20 sendo o PISO mínimo declarado (não um alvo recomendado) reforça que
  a ferramenta foi desenhada considerando 20 como o mínimo aceitável, não como o alvo ideal atual.

4. Compatibilidade com Express 5.2.1
Todas as 3: compatíveis — Express 5 exige apenas Node >= 18, piso já superado por qualquer uma das 3
  opções.
DIFERENCIADOR: NENHUM.

5. Compatibilidade com Drizzle
Todas as 3: sem bloqueio conhecido — Drizzle ORM é uma biblioteca JS/TS pura sobre os drivers pg/
  postgres.js, sem pin de versão de Node.js específica além de suportar Node LTS moderno em geral.
DIFERENCIADOR: NENHUM.

6. Compatibilidade com pg
Todas as 3: sem bloqueio conhecido — driver node-postgres mantém compatibilidade ampla com as linhas
  LTS ativas/em manutenção do Node.js.
DIFERENCIADOR: NENHUM.

7. Compatibilidade com pnpm 10.11.0
Todas as 3: compatíveis — pnpm 10.x opera sobre um piso de Node bem anterior a 20 (~18.12+), nenhuma das
  3 opções fica abaixo desse piso.
DIFERENCIADOR: NENHUM.

8. Docker
Todas as 3: imagens oficiais node:20-alpine/22-alpine/24-alpine mantidas pelo projeto Node.js/Docker —
  disponibilidade de imagem não é um fator de exclusão de nenhuma das 3.
DIFERENCIADOR: NENHUM em disponibilidade — mas node:20-alpine corresponde a uma linha já EOL do ponto
  de vista de patch de segurança do PRÓPRIO Node.js (a imagem existe, mas o runtime dentro dela já não
  recebe mais correção), o que é uma desvantagem real de Node 20 mesmo dentro deste critério.

9. Vercel
Node 20: será BLOQUEADA para novos deployments a partir de 1º de outubro de 2026 (achado decisivo
  acima, fonte oficial Vercel) — escolher Node 20 agora significa uma troca forçada em semanas/poucos
  meses, não uma opção sustentável para "iniciar e sustentar a API v2" (critério pedido pela regra
  desta etapa).
Node 22: aceita e recomendada explicitamente pela Vercel.
Node 24: aceita e recomendada explicitamente pela Vercel, com mecanismo de seleção já documentado
  ("engines": {"node": "24.x"}).
DIFERENCIADOR: Node 24 (empatada com 22 aqui, mas 24 já vence nos critérios 1/2 acima) — Node 20 é
  DESQUALIFICADA por este critério isoladamente, dado que a Vercel é um dos 2 alvos de deployment já
  confirmados deste projeto.

10. GitHub Actions
Todas as 3: compatíveis — a action oficial actions/setup-node baixa e instala dinamicamente a versão de
  Node especificada no workflow, independentemente da imagem do runner, sem depender de a versão já vir
  pré-instalada.
DIFERENCIADOR: NENHUM.

11. Ecossistema de testes
Todas as 3: sem impacto — Jest/Vitest/Playwright/Supertest (doc57) não têm requisito de Node.js além do
  piso já superado por qualquer uma das 3 opções.
DIFERENCIADOR: NENHUM.

12. Necessidade de troca futura em curto prazo
Node 20: SIM, praticamente imediata — já EOL hoje do ponto de vista do Node.js, e bloqueada para novos
  deployments na Vercel em ~2 meses a partir de agora; escolher Node 20 para uma API que "precisa
  iniciar e se sustentar" significaria planejar uma migração de runtime antes mesmo do primeiro
  deployment em produção amadurecer.
Node 22: moderada — só ~8-9 meses de Maintenance LTS restantes, uma troca ainda seria necessária dentro
  de um horizonte relativamente curto para uma aplicação nova.
Node 24: baixa — maior janela de suporte entre as 3 opções (até abril de 2028), sem necessidade de
  troca previsível no horizonte próximo de vida da v2.
DIFERENCIADOR: Node 24.
```

---

## Decisão

```text
SELECTED:
NODE_24

SELECTED_NODE_MAJOR:
24

SELECTED_NODE_VERSION_POLICY:
Major fixa em 24, com patch/minor sempre atualizado dentro da própria linha LTS 24.x (mesma convenção
  de fixar major e seguir patches de segurança já usada implicitamente pelo projeto atual em Node 20,
  doc57 — sem pin de patch exato, que seria uma decisão de manutenção contínua, não desta etapa)

CURRENT_NODE_20_STATUS:
EOL (End-of-Life — data de fim de suporte 30 de abril de 2026, já passada; adicionalmente, bloqueada
  para novos deployments na Vercel a partir de 1º de outubro de 2026)

CHANGE_FROM_CURRENT_STACK_REQUIRED:
SIM — o projeto atual (legacy) usa Node 20; a apps/api-v2 usará Node 24. Isso não altera o legacy em si
  (não reaberto, não alterado nesta etapa) — é uma divergência deliberada entre o runtime do legacy e
  o da v2, tecnicamente justificada pelo estado de suporte de cada versão no momento em que a v2 está
  sendo desenhada, não por preferência.
```

Justificativa central: a regra desta etapa pede o "LTS mais adequado para INICIAR e SUSTENTAR a API
v2" — Node 20, apesar de ser a versão já usada no projeto, falha nesse critério da forma mais concreta
possível: já está EOL hoje e será ativamente bloqueada pela própria Vercel (um dos 2 alvos de
deployment já confirmados desta aplicação) em semanas/poucos meses a partir de agora. Node 22
resolveria o problema imediato mas ainda deixaria a v2 com uma janela de suporte relativamente curta
para uma aplicação nova. Node 24 é a Active LTS vigente, com a maior janela de suporte entre as opções
avaliadas, compatibilidade confirmada com toda a stack já decidida (NestJS 11.1.28, Express 5.2.1,
Drizzle, pg, pnpm 10.11.0) e nenhuma restrição encontrada nos 12 critérios pedidos — não foi escolhida
"por ser mais nova", foi escolhida porque é a única das 3 opções sem uma necessidade de troca já
visível no horizonte de vida da v2 (critério 12), e a única sem uma desqualificação concreta e datada
por uma fonte oficial (critério 9).

---

## Compatibilidade

```text
NESTJS_11_COMPATIBLE:
SIM

DRIZZLE_COMPATIBLE:
SIM

PG_COMPATIBLE:
SIM

PNPM_10_COMPATIBLE:
SIM

DOCKER_COMPATIBLE:
SIM

VERCEL_COMPATIBLE:
SIM

GITHUB_ACTIONS_COMPATIBLE:
SIM
```

---

## Resumo

```text
UNRESOLVED_NODE_DECISIONS:
0
```

## Cobertura

12 critérios pedidos comparados entre Node 20 (atual), Node 22 e Node 24, com verificação em 2 fontes
oficiais primárias (nodejs.org/en/about/eol, nodejs.org/en/about/previous-releases) e 1 fonte oficial
específica de plataforma (vercel.com/changelog — achado decisivo de bloqueio de Node 20 para novos
deployments a partir de outubro de 2026). Node 26 foi identificado e descartado por ainda não ser LTS
no momento desta consulta. Compatibilidade confirmada com toda a stack já decidida da v2 (NestJS 11,
Express 5.2.1, Drizzle, pg, pnpm 10.11.0, Docker, Vercel, GitHub Actions). Nenhum `.nvmrc`/
`package.json`/`engines`/Dockerfile/workflow/config Vercel foi alterado. `apps/api-v2` não foi criado.
`apps/web`, `apps/api` (legacy) e deployment não foram alterados. Nenhuma outra tecnologia da stack foi
reavaliada. Nenhum documento anterior foi modificado.
