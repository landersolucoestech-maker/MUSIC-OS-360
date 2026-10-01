> Historical record. Kept as recorded; not the current contract.

# 66 — Decisão Final: Stack de Auth/JWT da `apps/api-v2`

Definição read-only da implementação técnica de validação de JWT do Supabase Auth (provedor de identidade preservado, não alterado) para a futura `apps/api-v2`, com verificação em fontes oficiais/primárias atuais. Fluxo conceitual de auth/tenant (doc49), configuração/secrets (doc53) e regras de comportamento de negócio (doc62) não reabertos — apenas a biblioteca/implementação técnica de validação criptográfica do JWT é decidida aqui. Nenhum AuthGuard/middleware foi criado, nenhuma dependência foi instalada. `apps/api-v2` não foi criado. `apps/web`, `apps/api` (legacy), Supabase Auth, usuários e banco não foram alterados.

## Stack já fechada (contexto, não reaberta)

```text
Node.js 24 | TypeScript 6.0.3 | NestJS 11.1.28 | Express 5.2.1 | Zod 4.4.3 | PostgreSQL 17/Supabase |
Drizzle ORM 0.45.2 | pg 8.22.0 | drizzle-kit 0.31.10 | Long-running container
Provedor de identidade: Supabase Auth (não alterado)
```

## Estado atual (legacy, contexto)

```text
Supabase Auth | JWKS/ES256 (hardcoded) | jsonwebtoken 9.0.3 | jwks-rsa 4.0.1
```

---

## Verificação externa (fontes oficiais consultadas nesta etapa) — achado decisivo

```text
supabase.com/docs/guides/auth/jwts + supabase.com/docs/guides/auth/signing-keys (documentação oficial
  Supabase Auth, consultada nesta etapa):
  - Supabase Auth suporta assinatura SIMÉTRICA (HS256, modelo legado) e ASSIMÉTRICA (RS256, ES256,
    Ed25519) — "por padrão, chaves assimétricas são criadas com RS256", não ES256.
  - ACHADO CRÍTICO: o legacy (doc49) VALIDA O JWT COM UM ALGORITMO HARDCODED — literalmente
    "algorithms: ['ES256']" fixo no código (apps/api/src/core/guards/auth.guard.ts, já citado no
    doc49) — mas a documentação oficial atual do Supabase mostra que RS256 é o algoritmo DEFAULT para
    chaves assimétricas hoje, não ES256. Isso não significa necessariamente que o projeto Supabase
    real deste sistema esteja configurado incorretamente (pode ter sido criado antes dessa mudança de
    default, ou configurado explicitamente para ES256) — mas expõe uma fragilidade real de design:
    hardcodar um único algoritmo é uma prática frágil frente a um provedor que documenta oficialmente
    suportar 3 algoritmos assimétricos diferentes e pode alterná-los.
  - Endpoint JWKS: GET https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json — expõe
    somente as chaves PÚBLICAS (nunca a privada), com suporte documentado a múltiplos estados de chave
    (Active/Standby/Previously used/Revoked) para rotação sem exigir deploy de nova versão do backend.
  - Migração: segredo JWT legado pode coexistir com o novo sistema assimétrico durante uma transição —
    não aplicável ao desenho da v2 (nova, sem legado próprio a migrar), mas confirma que o modelo
    assimétrico é o caminho atual oficialmente suportado e recomendado.

registry.npmjs.org (versões consultadas nesta etapa):
  - jose: latest 6.2.8 — biblioteca TypeScript-nativa (tipos embutidos, sem @types separado),
    mantida por um único mantenedor de longa trajetória no ecossistema JOSE/Node.js, com
    createRemoteJWKSet() como helper nativo de alto nível que já resolve fetch + cache + rotação de
    JWKS numa única API, sem necessidade de nenhuma biblioteca adicional.
  - jsonwebtoken: latest 9.0.3 (mesma versão já usada no legacy — nenhuma mudança de versão disponível).
  - jwks-rsa: latest 4.1.0 (acima da 4.0.1 do legacy) — engines "^20.19.0 || ^22.12.0 || >=23.0.0":
    Node 24 satisfaz trivialmente a cláusula ">=23.0.0", compatível.
```

---

## Comparação nos 16 critérios pedidos

```text
1. ES256/JWKS
A (jose): suporta ES256/RS256/EdDSA nativamente via createRemoteJWKSet + jwtVerify, sem necessidade de
  fixar um único algoritmo no código — a lista de algoritmos aceitos é uma allowlist explícita
  (ex.: ['RS256','ES256']), não uma escolha única hardcoded.
B (jsonwebtoken+jwks-rsa): suporta os mesmos algoritmos, mas exige a mesma combinação manual já usada
  no legacy (getKey callback conectando jwks-rsa ao jsonwebtoken) — funcional, porém é exatamente o
  padrão que already hardcoded um único algoritmo (achado crítico acima).
C (Supabase SDK): não expõe uma API dedicada de verificação de JWT local via JWKS como funcionalidade
  de primeira classe do supabase-js para uso server-side neste padrão — o SDK é orientado a sessão/
  client, não a verificação criptográfica standalone de um token arbitrário recebido via header.
Diferenciador: A — não hardcoda algoritmo único, mais alinhado ao suporte multi-algoritmo documentado
  do Supabase.

2. Assinatura criptográfica local
A: SIM, via jwtVerify contra a chave pública do JWKS.
B: SIM, mesmo mecanismo via jwt.verify + callback de chave.
C: não aplicável da mesma forma (não é o padrão do SDK para este caso).
Diferenciador: nenhum entre A/B nesta capacidade bruta.

3. Validação de issuer
A: parâmetro nativo de jwtVerify (issuer).
B: parâmetro nativo de jwt.verify (issuer).
Diferenciador: nenhum.

4. Validação de audience
A: parâmetro nativo de jwtVerify (audience).
B: parâmetro nativo de jwt.verify (audience).
Diferenciador: nenhum.

5. Expiração
A: validada automaticamente por jwtVerify (claim exp), com erro tipado específico
  (JWTExpired) que a aplicação pode diferenciar de "assinatura inválida".
B: validada automaticamente por jwt.verify, com TokenExpiredError já usado hoje no legacy para essa
  distinção (doc49).
Diferenciador: nenhum funcional — ambos diferenciam expiração de assinatura inválida.

6. Clock tolerance
A: parâmetro nativo (clockTolerance) em jwtVerify.
B: parâmetro nativo (clockTolerance) em jwt.verify.
Diferenciador: nenhum.

7. Key rotation
A: createRemoteJWKSet re-busca o JWKS automaticamente ao encontrar um "kid" desconhecido — suporte
  nativo e automático ao modelo de rotação documentado do Supabase (Active/Standby/Previously used/
  Revoked).
B: jwks-rsa também suporta re-fetch, mas como uma configuração explícita separada (cache/rateLimit) a
  ser corretamente ajustada manualmente — mesma capacidade final, porém como 2 peças (jsonwebtoken +
  jwks-rsa) a manter coordenadas em vez de 1 função integrada.
Diferenciador: leve vantagem de A pela integração nativa numa única API, reduzindo código de
  acoplamento manual (o próprio getKey callback que o legacy precisa manter, doc49).

8. JWKS caching
A: cache em memória embutido em createRemoteJWKSet, configurável.
B: cache embutido no client do jwks-rsa (cache: true, cacheMaxAge), mesma capacidade.
Diferenciador: nenhum funcional, mesma vantagem de integração do item 7.

9. Falha segura
A: jwtVerify lança exceção tipada para qualquer falha (assinatura/issuer/audience/expiração/claim
  ausente) — nenhum caminho de sucesso silencioso.
B: mesmo comportamento via jwt.verify (rejeita com erro), já o padrão usado no legacy.
Diferenciador: nenhum.

10. Node.js 24
A: SIM, sem restrição conhecida.
B: SIM (jsonwebtoken sem restrição de engines; jwks-rsa 4.1.0 exige >=20.19/22.12/23 — Node 24
  satisfaz).
Diferenciador: nenhum.

11. TypeScript 6
A: tipos TypeScript embutidos no próprio pacote (sem @types separado) — 1 fonte de verdade de tipo,
  sem risco de desalinhamento entre versão do pacote e versão dos tipos.
B: jsonwebtoken depende de @types/jsonwebtoken (pacote de tipos separado, mantido pela comunidade,
  risco de defasagem de versão) — jwks-rsa já publica seus próprios tipos.
Diferenciador: A — 1 fonte de verdade de tipo, sem dependência de tipos comunitários separados.

12. NestJS 11
A: integração via provider customizado simples (mesmo padrão já usado para Drizzle, doc58/65) — sem
  fricção estrutural.
B: mesma integração via provider customizado.
Diferenciador: nenhum.

13. Performance
A: implementação moderna, sem dependências pesadas — biblioteca com pegada mínima (poucas ou nenhuma
  dependência transitiva).
B: jsonwebtoken + jwks-rsa juntos trazem mais superfície de dependência transitiva combinada.
Diferenciador: leve vantagem de A, não decisiva isoladamente.

14. Dependências necessárias
A: 1 pacote (jose) resolve verificação de assinatura E fetch/cache/rotação de JWKS.
B: 2 pacotes (jsonwebtoken + jwks-rsa) + 1 pacote de tipos separado (@types/jsonwebtoken) = 3 pacotes
  para a mesma cobertura funcional.
Diferenciador: A — menos peças a manter coordenadas (menos superfície para desalinhamento de versão).

15. Manutenção
A: mantenedor único, mas com histórico de longa data e alta confiança no ecossistema JOSE/Node.js;
  API estável e moderna.
B: jsonwebtoken é um projeto maduro e amplamente adotado, porém com ritmo de evolução mais lento;
  jwks-rsa é um pacote satélite menor, mantido separadamente.
Diferenciador: leve vantagem de A por consolidar a responsabilidade numa única biblioteca ativamente
  evoluída, reduzindo o número de projetos independentes dos quais a apps/api-v2 depende para uma
  única responsabilidade (verificação de JWT).

16. Segurança
A: não hardcoda algoritmo único (achado crítico da seção Verificação Externa) — allowlist explícita de
  algoritmos aceitos, alinhada ao suporte multi-algoritmo real e documentado do Supabase.
B: replica o padrão do legacy, que hardcoda ES256 — um risco real e concreto se o projeto Supabase
  real algum dia rotacionar para RS256 (o default documentado hoje) ou Ed25519 sem que o código da API
  seja atualizado em conjunto — uma falha de configuração cruzada silenciosa (o token deixaria de
  validar, não um risco de token forjado, mas ainda assim uma fragilidade operacional real).
Diferenciador: A — mitiga um risco concreto e específico já identificado nesta própria verificação.
```

---

## Síntese

Dos 16 critérios, a maioria é equivalente entre A e B em capacidade bruta (ambos fazem verificação
criptográfica real, validam issuer/audience/expiração/clock tolerance, suportam rotação e cache) — a
diferença decisiva está nos critérios 1, 11, 14, 15 e 16: jose consolida em 1 pacote TypeScript-nativo
o que jsonwebtoken+jwks-rsa exige em 3 (incluindo um pacote de tipos comunitário separado), e — o ponto
mais concreto desta reavaliação — não reproduz o hardcode de algoritmo único que a verificação externa
identificou como uma fragilidade real do padrão já usado no legacy, frente à documentação oficial atual
do Supabase confirmando suporte a 3 algoritmos assimétricos distintos.

---

## Regra crítica (reafirmada)

```text
JWT_SIGNATURE_VERIFIED:
SIM

A apps/api-v2 nunca aceita um JWT via decode() simples (leitura sem verificação) — toda validação passa
por verificação criptográfica real da assinatura contra a chave pública publicada no JWKS oficial do
Supabase, mais validação das claims obrigatórias (seção Claims abaixo). Nenhum caminho de autenticação
aceita um token só porque ele "parece" um JWT bem formado.
```

---

## JWKS

```text
JWKS_SOURCE:
Endpoint oficial do Supabase Auth — https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json
  (mesmo padrão de URL já usado no legacy, doc49 — "${SUPABASE_URL}/auth/v1/.well-known/jwks.json" —
  não alterado, apenas a biblioteca que o consome muda)

JWKS_CACHE:
SIM (nativo em jose, via createRemoteJWKSet)

JWKS_ROTATION_SUPPORTED:
SIM (re-fetch automático ao encontrar um "kid" desconhecido — suporta nativamente o modelo de rotação
  Active/Standby/Previously used/Revoked documentado pelo Supabase, sem exigir deploy de nova versão da
  API quando o Supabase rotacionar chaves)

Nenhuma chave pública é hardcoded no código — sempre resolvida dinamicamente via o endpoint JWKS
oficial, exatamente porque o mecanismo oficial já suporta rotação.
```

---

## Claims

```text
VALIDATED_CLAIMS:
- iss (issuer — deve corresponder a "${SUPABASE_URL}/auth/v1", mesmo valor já usado no legacy, doc49)
- sub (subject — identidade externa Supabase, nunca usada como identidade final por si só, ver seção
  Identidade Interna)
- exp (expiração — validada automaticamente pela biblioteca, token expirado é sempre rejeitado)
- aud (audience — "authenticated", claim padrão do Supabase Auth para usuários autenticados)

user_metadata NÃO é usado para autorização (regra explícita do prompt, reafirmada) — é um campo
editável pelo próprio usuário no modelo do Supabase Auth, portanto nunca uma fonte confiável de decisão
de acesso. app_metadata (distinto de user_metadata — controlado por regras/admin, não pelo usuário)
continua sendo lido apenas como HINT de tenant (org_id), nunca como prova de autorização — mesma
distinção já fixada e não reaberta no doc49 (o hint é sempre conferido contra a resolução server-side
real de tenant/membership).
```

---

## Identidade interna (fluxo reafirmado, doc49 não reaberto)

```text
Supabase subject (claim "sub", identidade externa)
↓
internal user (resolução por auth_user_id, doc49)
↓
tenant membership (resolução server-side, nunca do header/claim isolado, doc49)
↓
role/permissions (da membership resolvida, nunca do JWT diretamente, doc49)
```

---

## Authorization

```text
JWT_ROLE_TRUSTED_AS_BUSINESS_AUTHORIZATION:
NÃO

Reafirmado sem alteração: role/permissions de negócio vêm exclusivamente do modelo interno já aprovado
(membership resolvida server-side, doc49), nunca de uma claim do JWT diretamente — mesmo que o JWT
carregue app_metadata.role como hint (mesma lógica de "hint, nunca prova" já aplicada ao tenant).
```

---

## Service role

```text
SUPABASE_SERVICE_ROLE_REQUIRED_FOR_JWT_VALIDATION:
NÃO

Verificação de assinatura de JWT contra o JWKS público é, por design do próprio modelo assimétrico
documentado pelo Supabase, uma operação que usa exclusivamente a CHAVE PÚBLICA (irreversível, segura
para publicação) — não exige, e não deve trafegar, a Service Role Key em nenhum momento desse fluxo.
A Service Role Key permanece reservada para operações administrativas já registradas em etapas
anteriores (reset de senha, provisionamento de workspace, doc42/53) — nunca para o caminho comum de
validação de token de toda requisição, reduzindo a superfície de exposição desse segredo ao mínimo
necessário (princípio de menor privilégio).
```

---

## Token revocation / session state

```text
REMOTE_AUTH_LOOKUP_EVERY_REQUEST:
NÃO

A verificação assinatura+expiração local (stateless) é suficiente para a esmagadora maioria das
requisições — é justamente a vantagem do modelo assimétrico (evita uma chamada de rede ao Supabase a
cada requisição só para validar identidade, mesmo padrão já em uso e não reaberto, doc49).

SENSITIVE_OPERATION_SESSION_RECHECK:
SIM

Para operações genuinamente sensíveis (ex.: mudança de credenciais, ações administrativas de alto
impacto, operações financeiras críticas already sinalizadas como exigindo rastreabilidade no doc62),
uma verificação adicional de estado de sessão pode ser justificada além da verificação criptográfica
padrão — registrado aqui como PRINCÍPIO, não como mecanismo implementado (qual operação exatamente
exige recheck, e como esse recheck funciona tecnicamente, é uma decisão futura específica de cada caso,
não desta etapa).
```

---

## Decisão final

```text
SELECTED:
JOSE

SELECTED_AUTH_LIBRARY:
jose

SELECTED_AUTH_LIBRARY_VERSION:
6.2.8

ADDITIONAL_JWKS_LIBRARY:
NONE — createRemoteJWKSet (parte do próprio pacote jose) cobre fetch/cache/rotação de JWKS sem
  necessidade de um pacote satélite separado.

JSONWEBTOKEN_IN_API_V2:
NÃO

JWKS_RSA_IN_API_V2:
NÃO
```

Justificativa: entre as 16 dimensões avaliadas, jose e jsonwebtoken+jwks-rsa empatam na maioria das
capacidades funcionais brutas (ambos fazem verificação criptográfica real, sem cair na regra crítica de
nunca aceitar decode() simples) — a decisão foi por jose especificamente por 2 motivos concretos e não
genéricos: (1) consolida em 1 pacote TypeScript-nativo o que a combinação anterior exige em 3 pacotes
(jsonwebtoken + jwks-rsa + @types/jsonwebtoken), reduzindo superfície de dependência para a mesma
responsabilidade; (2) não reproduz o hardcode de um único algoritmo (ES256) que esta própria
verificação externa identificou como uma fragilidade real do padrão do legacy, frente à documentação
oficial atual do Supabase que declara suporte a 3 algoritmos assimétricos distintos com RS256 como
default hoje — um risco concreto de quebra silenciosa que jose evita estruturalmente ao trabalhar com
uma allowlist de algoritmos, não uma escolha única fixa no código.

---

## Supabase JS

```text
SUPABASE_JS_REQUIRED_FOR_JWT_VALIDATION:
NÃO

A validação de JWT em si (verificação de assinatura contra o JWKS público) não exige o SDK completo
@supabase/supabase-js — o endpoint JWKS é um endpoint HTTPS/REST comum, consumido diretamente por
createRemoteJWKSet (jose) via fetch nativo, sem necessidade da camada de sessão/client do SDK. Isso NÃO
decide se @supabase/supabase-js será necessário para OUTROS propósitos futuros da apps/api-v2 (ex.:
publicar em Supabase Realtime a partir do backend, como já ocorre no legacy, doc54/57; operações
administrativas via Service Role) — esses usos são explicitamente fora do escopo desta etapa, que trata
somente da validação de JWT.
```

---

## Resumo

```text
UNRESOLVED_AUTH_STACK_DECISIONS:
0
```

## Cobertura

16 critérios pedidos comparados entre jose, jsonwebtoken+jwks-rsa e SDK Supabase, com verificação em
documentação oficial atual do Supabase Auth (achado decisivo: RS256 é o algoritmo default documentado
hoje para chaves assimétricas, expondo o hardcode de ES256 único do legacy como uma fragilidade real, não
teórica) e versões exatas confirmadas via registry.npmjs.org. JWKS (fonte, cache, rotação), claims
obrigatórias (iss/sub/exp/aud, com user_metadata explicitamente excluído de autorização), fluxo de
identidade interna reafirmado sem alteração (doc49), regra de que role/permission do JWT nunca é
autorização de negócio reafirmada, uso de Service Role Key explicitamente descartado para este fluxo
específico (princípio de menor privilégio), política de revogação/estado de sessão diferenciando
operações normais (verificação local stateless) de operações sensíveis (recheck adicional, como
princípio, não implementado), e necessidade de @supabase/supabase-js para este propósito específico
(não necessário) — todos definidos. Nenhum AuthGuard/middleware foi criado, nenhuma dependência foi
instalada. `apps/api-v2` não foi criado. `apps/web`, `apps/api` (legacy), Supabase Auth, usuários e
banco não foram alterados. Tenant/RBAC não foram reavaliados nesta etapa. Nenhum documento anterior foi
modificado.
