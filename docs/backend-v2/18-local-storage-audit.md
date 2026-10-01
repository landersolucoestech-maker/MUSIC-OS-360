> Historical record. Kept as recorded; not the current contract.

# 18 — Classificação do Uso de Storage Local do Frontend

Continuação read-only de [`03-frontend-data-access-surface.md`](./03-frontend-data-access-surface.md) (lista `STORAGE_LOCAL`, 36 arquivos). Nenhum arquivo foi alterado. Nenhum doc anterior foi modificado. `apps/api` não foi consultado. Nenhum `localStorage`/`sessionStorage` foi removido ou corrigido.

## Metodologia e achado metodológico prévio

Os 36 arquivos foram lidos por completo. Para entender valores concretos (chave real, dado real armazenado), 6 arquivos exigiram ler um caller/dependência direta fora da lista de 36 (sempre dentro de `apps/web/**`, nunca `apps/api`): `useDeezer.ts`, `useSpotify.ts` e `useYouTube.ts` (dependências diretas de `DeezerConfigDialog.tsx`/`SpotifyConfigDialog.tsx`/`YouTubeConfigDialog.tsx`).

**Achado relevante para a interpretação de todo o resto deste documento:** o grep original (doc03) casa a string literal `localStorage`/`sessionStorage` em qualquer lugar do arquivo — incluindo comentários e strings de teste, não apenas chamadas reais de API. Da leitura completa dos 36 arquivos, **24 deles não contêm nenhuma chamada real** a `localStorage.*`/`sessionStorage.*` — o casamento veio de um comentário (ex.: "MOCK: localStorage", "Chave de localStorage para...") ou de uma string de teste (ex.: `expect(source).not.toContain("sessionStorage")`). Isso é registrado explicitamente em cada caso abaixo, não é tratado como omissão.

Dois casos de comentário desatualizado/incorreto foram confirmados por leitura das dependências diretas: `SpotifyConfigDialog.tsx` e `YouTubeConfigDialog.tsx` dizem "credenciais persistidas em localStorage", mas o fluxo real (`useSpotify.ts`/`useYouTube.ts`) não usa storage local nenhum — Spotify usa OAuth real via backend e o formulário da dialog é ignorado; YouTube é configurado por variável de ambiente do servidor e as mutations são stubs `@deprecated` vazios.

---

## Usos REAIS (chamada direta a `localStorage`/`sessionStorage` confirmada, no arquivo ou em dependência direta)

### 1 — `apps/web/src/lib/supabase.ts`

```text
ARQUIVO: apps/web/src/lib/supabase.ts
STORAGE: localStorage
CHAVE: "musicos360_auth" (storageKey passado ao createClient do supabase-js; window.localStorage passado como `storage`)
OPERAÇÃO: OUTRO (delegada — o SDK do Supabase Auth é quem lê/escreve, não uma chamada explícita neste arquivo)
DADO_ARMAZENADO: sessão do Supabase Auth (access_token, refresh_token, expires_at, user) — gerida inteiramente pelo SDK
FINALIDADE: persistir a sessão de autenticação entre reloads (persistSession/autoRefreshToken), conforme já documentado em detalhe no doc17
CLASSIFICAÇÃO: AUTH_SESSION
BACKEND_REQUIRED: NÃO
JUSTIFICATIVA: é o mecanismo padrão do provedor de Auth escolhido (Supabase Auth) — já classificado como AUTH_REQUIRED_DIRECT_ACCESS no doc17; não é um "uso de storage local" no sentido de dado de aplicação, é a implementação do próprio SDK de sessão.
```

### 2 — `apps/web/src/modules/accounting/components/transacao-form/hooks/useRuleOverrides.ts`

```text
ARQUIVO: apps/web/src/modules/accounting/components/transacao-form/hooks/useRuleOverrides.ts
STORAGE: localStorage
CHAVE: "musicos360_rule_overrides"
OPERAÇÃO: READ (load, no mount) + WRITE (save, a cada mudança) + CLEAR (clearOverrides)
DADO_ARMAZENADO: Record<string,boolean> — override manual do usuário para uma regra automática de categorização de transação, chave composta "<tipoTransacao>:<tipoCliente>:<categoria>:<ruleKey>"
FINALIDADE: permitir que o usuário sobrescreva o resultado computado de uma regra de categorização de transações financeiras (accounting), persistindo a escolha entre sessões
CLASSIFICAÇÃO: BUSINESS_DATA
BACKEND_REQUIRED: INCERTO
JUSTIFICATIVA: afeta o resultado real de categorização de transações financeiras (não é preferência decorativa), mas o arquivo não expõe nenhum tenant_id/user_id na chave — é um único blob global por navegador, sem isolamento por tenant (ver `tenant-isolation.ts`, caso 33, que oferece `tenantStorageKey()` mas não é usado aqui). Destacado por ATENÇÃO ESPECIAL: sem endpoint, é o único lugar onde este override existe.
```

### 3 — `apps/web/src/modules/accounting/hooks/useFinancialCategoryRulesStore.ts`

```text
ARQUIVO: apps/web/src/modules/accounting/hooks/useFinancialCategoryRulesStore.ts
STORAGE: localStorage
CHAVE: "musicos360_financial_category_rules"
OPERAÇÃO: READ (loadRules, com fallback para `financialCategoryRulesSeed`) + WRITE (persistRules, a cada mudança) + OUTRO (resetRules restaura o seed)
DADO_ARMAZENADO: array completo de `FinancialCategoryRuleEntity` — o próprio conjunto de regras de categorização automática de transações (não overrides pontuais; é o ruleset inteiro)
FINALIDADE: ser a fonte de dados do motor de categorização automática de transações financeiras do módulo accounting
CLASSIFICAÇÃO: BUSINESS_DATA
BACKEND_REQUIRED: SIM
JUSTIFICATIVA: ATENÇÃO ESPECIAL — este é literalmente "fonte principal de dados de negócio": não existe nenhum endpoint de backend para o ruleset de categorização financeira nesta parte do código; localStorage é a única fonte de verdade, sem isolamento por tenant/usuário.
```

### 4 — `apps/web/src/modules/contracts/hooks/useVariableRegistry.ts`

```text
ARQUIVO: apps/web/src/modules/contracts/hooks/useVariableRegistry.ts
STORAGE: localStorage (via wrapper `localStore`, prefixo "musicos360:")
CHAVE: "musicos360:variable_registry"
OPERAÇÃO: READ (load, com seed de variáveis padrão se a chave nunca foi escrita) + WRITE (save a cada mudança) + OUTRO (addVariable/updateVariable/removeVariable(s)/importVariables — CRUD completo em memória, persistido a cada alteração)
DADO_ARMAZENADO: array de `RegistryVariable` — o registro de variáveis/placeholders de templates de contrato (ex.: {{ARTISTA.NAME}}), usado pelo módulo Contracts para geração de documentos
FINALIDADE: ser a fonte de dados do registro de variáveis de templates de contrato — CRUD completo (criar, editar, remover, importar) roda inteiramente client-side
CLASSIFICAÇÃO: BUSINESS_DATA
BACKEND_REQUIRED: SIM
JUSTIFICATIVA: ATENÇÃO ESPECIAL — "persistência de CRUD" sem endpoint: create/update/delete/import de um registro de negócio (variáveis de contrato) inteiramente em localStorage, sem tenant/user scoping.
```

### 5 — `apps/web/src/modules/integrations/components/DeezerConfigDialog.tsx` (implementação real em `useDeezer.ts`, dependência direta)

```text
ARQUIVO: apps/web/src/modules/integrations/components/DeezerConfigDialog.tsx (chamada real em apps/web/src/modules/integrations/hooks/useDeezer.ts:41,83,102 — dependência direta importada pela dialog)
STORAGE: sessionStorage
CHAVE: "musicos360_deezer_credentials" (LS_KEY)
OPERAÇÃO: READ (readCredentials) + WRITE (saveMutation, sessionStorage.setItem bruto, sem stripping) + REMOVE (deleteMutation)
DADO_ARMAZENADO: { app_id, secret_key, artist_id? } — inclui secret_key em texto plano, sem qualquer redaction
FINALIDADE: segundo comentário do próprio arquivo (useDeezer.ts:6-12), é "apenas uma preferência cosmética de UI" — a API pública do Deezer usada pelo backend não exige credenciais (isConfigured() sempre true); os endpoints reais (useDeezerArtistMetrics/useDeezerTopTracks) não usam esses dados
CLASSIFICAÇÃO: INTEGRATION_STATE
BACKEND_REQUIRED: NÃO
JUSTIFICATIVA: o próprio código documenta que o dado guardado não é funcionalmente necessário (API pública, sem auth real) — mas é um achado de ATENÇÃO ESPECIAL à parte: secret_key é persistido em texto plano em sessionStorage sem usar `safeSessionSet`/`withoutSecrets` (shared/lib/safe-storage.ts), violando a própria política CWE-312 documentada nesse utilitário do mesmo repositório (contrastar com o Caso 8 — useClicksign.ts — que faz o strip corretamente).
```

### 6 — `apps/web/src/modules/integrations/hooks/useClicksign.ts`

```text
ARQUIVO: apps/web/src/modules/integrations/hooks/useClicksign.ts
STORAGE: sessionStorage (via safeSessionSet)
CHAVE: "musicos360_clicksign_credentials" (CRED_KEY)
OPERAÇÃO: READ (readCreds) + WRITE (writeCreds → safeSessionSet, com stripping) + REMOVE (clearCreds)
DADO_ARMAZENADO: { account_email?, saved_at } — api_key é explicitamente excluído antes de persistir (comentário no código + safeSessionSet strips sensitive keys)
FINALIDADE: cache local do status "conectado" da integração Clicksign para a UI (useSigningProviders também lê esta mesma chave, ver Caso 9)
CLASSIFICAÇÃO: INTEGRATION_STATE
BACKEND_REQUIRED: INCERTO
JUSTIFICATIVA: o metadado local (email/data) é aceitável ficar client-side; o api_key real precisaria viver num backend/vault, mas esse armazenamento real não está neste arquivo (fora do escopo dos 36). Exemplo correto de uso: usa `safeSessionSet` para nunca persistir o segredo, ao contrário do Caso 5 (Deezer) e do Caso 7 (NF-e) abaixo.
```

### 7 — `apps/web/src/modules/integrations/hooks/useNfe.ts`

```text
ARQUIVO: apps/web/src/modules/integrations/hooks/useNfe.ts
STORAGE: sessionStorage
CHAVE: "musicos360_nfe_credentials" (STORAGE_KEY)
OPERAÇÃO: READ (loadCredentials) + WRITE (useNfeSaveCredentials, sessionStorage.setItem bruto) + REMOVE (useNfeDeleteCredentials)
DADO_ARMAZENADO: NfeCredentials completo — cnpj, ie, regime_tributario, ambiente, certificado_tipo, certificado_serial, token_provedor, provedor, saved_at. token_provedor é um segredo de autenticação do provedor fiscal (Focus NFe/NFe.io/eMites/PlugNotas), armazenado em texto plano.
FINALIDADE: configuração local de emissão de NF-e (Nota Fiscal Eletrônica) por empresa
CLASSIFICAÇÃO: INTEGRATION_STATE
BACKEND_REQUIRED: SIM
JUSTIFICATIVA: ATENÇÃO ESPECIAL — token_provedor é um segredo de integração fiscal persistido sem nenhuma proteção (nem `safeSessionSet`), o mesmo padrão de risco do Caso 5, mas aqui envolvendo credenciais fiscais reais (não uma API pública). Deveria mover para backend/vault conforme a própria política declarada em safe-storage.ts.
```

### 8 — `apps/web/src/modules/integrations/hooks/useSigningProviders.ts`

```text
ARQUIVO: apps/web/src/modules/integrations/hooks/useSigningProviders.ts
STORAGE: sessionStorage
CHAVE: "musicos360_clicksign_credentials" + "musicos360_docusign_credentials" (leitura apenas, existência da chave)
OPERAÇÃO: READ (readClicksignCreds/readDocuSignCreds — apenas checagem de presença, `!== null`)
DADO_ARMAZENADO: nenhum dado próprio — deriva um booleano `connected` a partir da presença das chaves escritas pelos Casos 6/DocuSign (DocuSign não está nos 36 arquivos analisados)
FINALIDADE: agregar o status de conexão de todos os provedores de assinatura digital para a UI (Autentique sempre true, Clicksign/DocuSign conforme sessionStorage)
CLASSIFICAÇÃO: INTEGRATION_STATE
BACKEND_REQUIRED: NÃO
JUSTIFICATIVA: leitura derivada e read-only, não é fonte primária de dado — a fonte primária é o Caso 6 (e o hook do DocuSign, fora de escopo).
```

### 9 — `apps/web/src/modules/releases/services/distribution-platforms.ts`

```text
ARQUIVO: apps/web/src/modules/releases/services/distribution-platforms.ts
STORAGE: localStorage
CHAVE: "musicos360_distributor_connections" (DISTRIBUTOR_CONNECTIONS_KEY, "compartilhada com Configurações" segundo comentário do arquivo)
OPERAÇÃO: READ (readConnections)
DADO_ARMAZENADO: Record<platformId, {username?}> — quais distribuidoras digitais (ONErpm, DistroKid, Symphonic, SoundOn, MusicPro, SomVibe) estão conectadas
FINALIDADE: determinar quais plataformas de distribuição aparecem como selecionáveis no fluxo de criação de lançamento (releases) — segundo o comentário do próprio arquivo, "é o estado REAL do app — nada é simulado aqui"
CLASSIFICAÇÃO: BUSINESS_DATA
BACKEND_REQUIRED: SIM
JUSTIFICATIVA: ATENÇÃO ESPECIAL — "fonte principal de dados de negócio": decide diretamente quais distribuidoras um usuário pode escolher ao lançar uma música, sem endpoint de backend e sem isolamento por tenant nesta chave.
```

### 10 — `apps/web/src/modules/settings/hooks/useUserSettings.ts`

```text
ARQUIVO: apps/web/src/modules/settings/hooks/useUserSettings.ts
STORAGE: localStorage
CHAVE: "musicos360_user_settings:<user.id>" (userKey)
OPERAÇÃO: READ (readJSON, on mount/user change) + WRITE (writeJSON, em saveUserSettings)
DADO_ARMAZENADO: UserSettings completo — full_name, phone, cargo, setor, avatar_url (string base64 completa da imagem, via FileReader.readAsDataURL em Perfil.tsx), 6 flags notify_*, 5 flags auto_*, automation_preferences
FINALIDADE: preferências pessoais do usuário (notificações, automações) e dados de perfil exibidos em Perfil.tsx; full_name/avatar_url/phone também são espelhados no Supabase Auth user_metadata (já documentado no doc17)
CLASSIFICAÇÃO: USER_PREFERENCE
BACKEND_REQUIRED: INCERTO
JUSTIFICATIVA: as flags de notificação/automação são preferências legítimas de ficarem client-side; mas avatar_url guarda a imagem inteira como base64 em localStorage (sem limite de tamanho tratado além de "ignora falha de quota") quando o app já tem infraestrutura de upload real (useUploadToR2.ts, fora deste escopo) — ATENÇÃO ESPECIAL como possível substituto de um endpoint de upload que já existe para outros fins.
```

### 11 — `apps/web/src/modules/settings/hooks/useUserSettings.ts` (segunda chave)

```text
ARQUIVO: apps/web/src/modules/settings/hooks/useUserSettings.ts
STORAGE: localStorage
CHAVE: "musicos360_org_slug:<user.id>" (orgSlugKey)
OPERAÇÃO: READ (loadSettings) + WRITE (saveOrgSlug, com validação de formato antes de persistir)
DADO_ARMAZENADO: string — slug de cadastro público da organização
FINALIDADE: guardar o slug usado no link de cadastro público da organização, por usuário
CLASSIFICAÇÃO: USER_PREFERENCE
BACKEND_REQUIRED: INCERTO
JUSTIFICATIVA: um "slug de cadastro público da organização" soa como dado a nível de tenant/organização, não por usuário-no-navegador — mas o arquivo não expõe nenhuma chamada de API alternativa para isto, então não há evidência suficiente para classificar como BUSINESS_DATA com certeza.
```

### 12 — `apps/web/src/modules/integrations/hooks/useChat.ts` (uso apenas planejado, sem chamada real)

```text
ARQUIVO: apps/web/src/modules/integrations/hooks/useChat.ts
STORAGE: localStorage (mencionado em comentário; NENHUMA chamada real encontrada no arquivo)
CHAVE: N/A — nenhuma chave é lida ou escrita
OPERAÇÃO: OUTRO (nenhuma operação real; useChatChannel/useChatChannels/useChatNotifications retornam stubs estáticos e chamam disabledIntegration())
DADO_ARMAZENADO: nenhum
FINALIDADE: comentário do código diz "MIGRAÇÃO FUTURA: ... Em modo standalone: dados do localStorage substituem o canal real" — mas isso não está implementado; a implementação atual é 100% desabilitada
CLASSIFICAÇÃO: MOCK_OR_FALLBACK
BACKEND_REQUIRED: SIM
JUSTIFICATIVA: ATENÇÃO ESPECIAL — comentário descreve um comportamento de fallback em localStorage que o código não implementa; a feature está honestamente desabilitada (disabledIntegration), não simula dados falsos. Registrado como MOCK_OR_FALLBACK pela intenção documentada, não pelo comportamento atual (que é "nada acontece").
```

### 13 — `apps/web/src/modules/monitoring/rights/services/catalog-lookup.ts` (comentário desatualizado + stub morto)

```text
ARQUIVO: apps/web/src/modules/monitoring/rights/services/catalog-lookup.ts
STORAGE: localStorage (mencionado em comentário; NENHUMA chamada real neste arquivo)
CHAVE: N/A
OPERAÇÃO: OUTRO — getCatalogObras()/getCatalogArtistas() retornam array vazio hard-coded ([]), não leem localStorage nem MOCK_DATA algum, apesar do comentário do arquivo dizer "Reads obras from MOCK_DATA (which itself reads localStorage...)"
DADO_ARMAZENADO: nenhum (stub sempre vazio)
FINALIDADE: seria enriquecer execuções de monitoramento (Rights Monitoring) com dados reais do catálogo via índice ISRC → obra; na prática, computeEcadMatchRate/findOrphanIsrcs sempre operam sobre um índice vazio
CLASSIFICAÇÃO: MOCK_OR_FALLBACK
BACKEND_REQUIRED: SIM
JUSTIFICATIVA: ATENÇÃO ESPECIAL — comentário e implementação divergem: o comentário promete leitura de localStorage/MOCK_DATA, mas o código é um stub morto que sempre devolve vazio, tornando as métricas de match rate/ISRCs órfãos do módulo de Rights Monitoring permanentemente calculadas sobre catálogo zero.
```

---

## Usos SEM chamada real de storage no arquivo (match apenas em comentário/string de teste — 24 arquivos)

Para os 24 arquivos abaixo, o grep do doc03 casou a palavra `localStorage`/`sessionStorage` apenas dentro de um comentário, docstring ou literal de teste — confirmado por leitura completa de cada arquivo. Nenhum executa `localStorage.*`/`sessionStorage.*` diretamente. Registrados individualmente conforme pedido pelo prompt, em formato compacto:

```text
ARQUIVO: apps/web/src/modules/admin/components/knowledge/KnowledgeBaseManager.tsx
STORAGE: localStorage (apenas em comentário: "CRUD em mock (localStorage via useKnowledgeArticles)")
CHAVE: N/A neste arquivo — chave real pertence a useKnowledgeArticles() (apps/web/src/modules/support/hooks/useSupport.ts), fora dos 36 arquivos e não lida nesta etapa
OPERAÇÃO: OUTRO
DADO_ARMAZENADO: N/A neste arquivo
FINALIDADE: painel de CRUD de artigos/FAQs da Base de Conhecimento; a persistência real ocorre no hook consumido, não aqui
CLASSIFICAÇÃO: OTHER
BACKEND_REQUIRED: NÃO (não há chamada neste arquivo para avaliar)
JUSTIFICATIVA: nenhuma chamada de storage neste arquivo; ver AdminKnowledge.tsx (próximo) para o gate de produção desta feature.
```

```text
ARQUIVO: apps/web/src/modules/admin/pages/AdminKnowledge.tsx
STORAGE: localStorage (apenas em comentário)
CHAVE: N/A
OPERAÇÃO: OUTRO
DADO_ARMAZENADO: N/A
FINALIDADE: rota admin que renderiza KnowledgeBaseManager (Caso anterior) somente fora de produção — em produção (IS_PROD) mostra "Funcionalidade indisponível" e não renderiza nenhum componente ligado a localStorage
CLASSIFICAÇÃO: OTHER
BACKEND_REQUIRED: NÃO
JUSTIFICATIVA: o próprio arquivo documenta e aplica o gate correto (nenhum mock aparece em prod) — um exemplo positivo, não um achado de risco.
```

```text
ARQUIVO: apps/web/src/modules/auth/pages/Register.tsx
STORAGE: localStorage (apenas em comentário obsoleto: "Persiste tenant no localStorage")
CHAVE: N/A
OPERAÇÃO: OUTRO
DADO_ARMAZENADO: N/A
FINALIDADE: o fluxo real de cadastro chama signUp() (Supabase Auth, já documentado no doc17), não localStorage
CLASSIFICAÇÃO: OTHER
BACKEND_REQUIRED: NÃO
JUSTIFICATIVA: comentário desatualizado em relação à implementação atual.
```

```text
ARQUIVO: apps/web/src/modules/contracts/hooks/useDocuments.ts
STORAGE: localStorage (apenas em comentário: "é proibido simular o backend em localStorage")
CHAVE: N/A
OPERAÇÃO: OUTRO — queryFn sempre devolve [] e a mutation sempre lança um erro explícito ("...operação indisponível")
DADO_ARMAZENADO: nenhum
FINALIDADE: documentos vinculados a contratos não têm endpoint real ainda; o código escolhe explicitamente reportar o estado vazio real em vez de simular dados
CLASSIFICAÇÃO: OTHER
BACKEND_REQUIRED: SIM
JUSTIFICATIVA: comportamento correto e honesto (reporta indisponibilidade em vez de mockar), mas confirma que a feature aguarda um endpoint real.
```

```text
ARQUIVO: apps/web/src/modules/integrations/components/SpotifyConfigDialog.tsx
STORAGE: localStorage (apenas em comentário desatualizado: "Credenciais são persistidas em localStorage")
CHAVE: N/A
OPERAÇÃO: OUTRO
DADO_ARMAZENADO: nenhum — confirmado em useSpotify.ts: o fluxo real é OAuth via backend (GET /integrations/spotify/auth); o input do formulário da dialog (client_id/client_secret/artist_id) é recebido pela mutation como `_input` e nunca usado
CLASSIFICAÇÃO: OTHER
BACKEND_REQUIRED: NÃO
JUSTIFICATIVA: achado de UI morta — o formulário coleta dados que não vão a lugar nenhum (nem localStorage, nem backend); comentário do arquivo está incorreto quanto ao mecanismo real.
```

```text
ARQUIVO: apps/web/src/modules/integrations/components/YouTubeConfigDialog.tsx
STORAGE: localStorage (apenas em comentário desatualizado: "Credenciais são persistidas em localStorage")
CHAVE: N/A
OPERAÇÃO: OUTRO
DADO_ARMAZENADO: nenhum — confirmado em useYouTube.ts: useYouTubeSaveCredentials/useYouTubeDeleteCredentials são stubs `@deprecated` com corpo vazio; YouTube é configurado via variável de ambiente do servidor
CLASSIFICAÇÃO: OTHER
BACKEND_REQUIRED: NÃO
JUSTIFICATIVA: achado de UI morta — formulário inteiro é vestigial, mantido só por retrocompatibilidade com o componente da dialog; nada é persistido em lugar nenhum.
```

```text
ARQUIVO: apps/web/src/modules/integrations/pages/oauth-token-boundary.test.ts
STORAGE: sessionStorage (apenas em asserção de teste — verifica AUSÊNCIA)
CHAVE: N/A
OPERAÇÃO: OUTRO
DADO_ARMAZENADO: N/A
FINALIDADE: teste de governança que garante que useMarketingOAuth.ts NÃO usa sessionStorage nem safeSessionSet
CLASSIFICAÇÃO: OTHER
BACKEND_REQUIRED: NÃO
JUSTIFICATIVA: sinal positivo de governança (teste anti-regressão), não um uso de storage.
```

```text
ARQUIVO: apps/web/src/modules/settings/components/LogoUploader.tsx
STORAGE: localStorage (apenas em comentário: "Carrega a logo persistida (MOCK: localStorage)")
CHAVE: N/A neste arquivo — persistência real delegada a companyLogoService (fora dos 36 arquivos, não lido nesta etapa)
OPERAÇÃO: OUTRO
DADO_ARMAZENADO: N/A neste arquivo
FINALIDADE: upload/remoção de logo da empresa, via companyLogoService isolado por workspaceId
CLASSIFICAÇÃO: OTHER
BACKEND_REQUIRED: NÃO AVALIÁVEL (fora de escopo — a chamada real está em companyLogoService, não nos 36 arquivos)
JUSTIFICATIVA: o próprio comentário já sinaliza "MOCK" — consistente com o padrão observado noutros módulos, mas não verificável aqui sem sair do escopo autorizado.
```

```text
ARQUIVO: apps/web/src/modules/settings/pages/Perfil.tsx
STORAGE: localStorage (apenas em comentário: "quando userSettings carrega do localStorage")
CHAVE: N/A neste arquivo — delega inteiramente a useUserSettings() (Casos 10/11)
OPERAÇÃO: OUTRO
DADO_ARMAZENADO: N/A neste arquivo
FINALIDADE: tela de perfil do usuário; toda leitura/escrita passa pelo hook useUserSettings
CLASSIFICAÇÃO: OTHER
BACKEND_REQUIRED: NÃO (ver Casos 10/11 para a avaliação real)
JUSTIFICATIVA: nenhuma chamada direta neste arquivo.
```

```text
ARQUIVO: apps/web/src/modules/settings/services/settings.service.test.ts
STORAGE: localStorage (apenas em comentário)
CHAVE: N/A
OPERAÇÃO: OUTRO — o teste mocka storage.getRaw/setRaw (de shared/lib/storage.ts, fora dos 36 arquivos) como funções que SEMPRE lançam, e verifica que settingsService nunca propaga esse erro
DADO_ARMAZENADO: N/A
FINALIDADE: garantir que a árvore React não quebra quando getOperationalLists()/getCompanyProfile()/getNotificationPrefs() são chamados
CLASSIFICAÇÃO: OTHER
BACKEND_REQUIRED: SIM (indiretamente confirmado)
JUSTIFICATIVA: o comentário do teste (linha 6-8) afirma que storage.getRaw/setRaw "nunca [foram] migrados de localStorage para um endpoint real" — ou seja, esse caminho de settings.service.ts está permanentemente sem persistência real (nem localStorage, nem backend), apenas blindado contra crash. Achado indireto relevante, fora do arquivo de implementação (não incluído nos 36).
```

```text
ARQUIVO: apps/web/src/shared/constants/index.ts
STORAGE: localStorage (apenas em comentário de documentação: "localStorage prefix: musicos360_")
CHAVE: N/A — STORAGE_PREFIX é uma constante de convenção, não uma chave usada diretamente
OPERAÇÃO: OUTRO
DADO_ARMAZENADO: N/A
FINALIDADE: documentar a convenção de prefixo usada por outros arquivos
CLASSIFICAÇÃO: OTHER
BACKEND_REQUIRED: NÃO
JUSTIFICATIVA: arquivo de constantes puras, zero chamadas.
```

```text
ARQUIVO: apps/web/src/shared/governance/permissions.ts
STORAGE: localStorage (apenas em comentários de documentação sobre convenção de chaves de credenciais e cookie de auth)
CHAVE: N/A
OPERAÇÃO: OUTRO
DADO_ARMAZENADO: N/A
FINALIDADE: documentar o modelo de RBAC e políticas de dados sensíveis (não implementa nada)
CLASSIFICAÇÃO: OTHER
BACKEND_REQUIRED: NÃO
JUSTIFICATIVA: arquivo 100% documentacional (papéis, matriz de permissões, políticas), zero código de storage.
```

```text
ARQUIVO: apps/web/src/shared/integrations/contracts/chat.contract.ts
STORAGE: localStorage (apenas em comentário: "MockChatProvider (standalone — localStorage + MOCK_DATA)")
CHAVE: N/A
OPERAÇÃO: OUTRO
DADO_ARMAZENADO: N/A
FINALIDADE: definição de tipos/contrato IChatProvider — nenhuma implementação neste arquivo
CLASSIFICAÇÃO: OTHER
BACKEND_REQUIRED: NÃO
JUSTIFICATIVA: arquivo de tipos puro.
```

```text
ARQUIVO: apps/web/src/shared/integrations/contracts/music-monitoring.contract.ts
STORAGE: localStorage (funções construtoras de chave: playReportsStorageKey(), MONITORING_PROJECTS_KEY, MONITORING_ALERTS_KEY — nenhuma chamada real a localStorage.* neste arquivo)
CHAVE: N/A (apenas geração de nomes de chave, ex.: "musicos360_acrcloud_plays_<isrc>")
OPERAÇÃO: OUTRO
DADO_ARMAZENADO: N/A neste arquivo — os consumidores reais (ex. useACRCloud.ts) estão fora dos 36 arquivos
CLASSIFICAÇÃO: OTHER
BACKEND_REQUIRED: NÃO AVALIÁVEL (fora de escopo)
JUSTIFICATIVA: fonte de convenção de nomes, não um uso em si.
```

```text
ARQUIVO: apps/web/src/shared/integrations/contracts/rights.contract.ts
STORAGE: localStorage (função construtora de chave: arrecadacaoStorageKey() — nenhuma chamada real)
CHAVE: N/A (gera "musicos360_<entity>_arrecadacao_<periodo>")
OPERAÇÃO: OUTRO
DADO_ARMAZENADO: N/A neste arquivo
CLASSIFICAÇÃO: OTHER
BACKEND_REQUIRED: NÃO AVALIÁVEL (fora de escopo)
JUSTIFICATIVA: fonte de convenção de nomes; também contém generateMockISWC/generateMockISRC, explicitamente rotulados "apenas para MOCK" (não são storage).
```

```text
ARQUIVO: apps/web/src/shared/integrations/registry.ts
STORAGE: localStorage (credentialsStorageKey() gera "musicos360_<id>_credentials"; nenhuma chamada real)
CHAVE: N/A (fonte canônica das convenções de chave usadas nos Casos 5/6/7)
OPERAÇÃO: OUTRO
DADO_ARMAZENADO: N/A
CLASSIFICAÇÃO: OTHER
BACKEND_REQUIRED: NÃO
JUSTIFICATIVA: registro central de metadados de integrações, não executa storage.
```

```text
ARQUIVO: apps/web/src/shared/integrations/types.ts
STORAGE: localStorage (apenas em JSDoc do campo credentialsKey)
CHAVE: N/A
OPERAÇÃO: OUTRO
DADO_ARMAZENADO: N/A
CLASSIFICAÇÃO: OTHER
BACKEND_REQUIRED: NÃO
JUSTIFICATIVA: arquivo de tipos puro.
```

```text
ARQUIVO: apps/web/src/shared/lib/local-store.ts
STORAGE: localStorage (REAL, mas é o wrapper genérico em si — get/set/remove/clear com prefixo "musicos360:"; usado pelo Caso 4 e potencialmente outros fora do escopo)
CHAVE: N/A (namespace genérico, não uma chave específica)
OPERAÇÃO: OUTRO (infraestrutura — a operação concreta pertence a cada chamador)
DADO_ARMAZENADO: N/A neste arquivo
FINALIDADE: wrapper tipado e namespaced sobre localStorage; comentário do próprio arquivo proíbe guardar tokens/sessão/segredos aqui
CLASSIFICAÇÃO: OTHER
BACKEND_REQUIRED: NÃO
JUSTIFICATIVA: utilitário de infraestrutura, não um "uso" de dado específico — os usos concretos já aparecem nos Casos correspondentes (ex.: Caso 4).
```

```text
ARQUIVO: apps/web/src/shared/lib/migrations.ts
STORAGE: sessionStorage + localStorage (REAL)
CHAVE: flags "musicos360_migration_v<N>_done" (sessionStorage) + remoção de 7 chaves legadas *_credentials (localStorage E sessionStorage)
OPERAÇÃO: READ (checa flag) + REMOVE (limpa chaves legadas de credenciais de spotify/soundcloud/apple_music/tiktok_ads/google_ads/youtube/abramus) + WRITE (marca flag concluída)
DADO_ARMAZENADO: nenhum dado de negócio — apenas flags de controle de migração one-off
FINALIDADE: rotina de limpeza executada uma vez por versão, para remover chaves de credenciais antigas do storage do navegador
CLASSIFICAÇÃO: OTHER
BACKEND_REQUIRED: NÃO
JUSTIFICATIVA: mecanismo de infraestrutura (migração/limpeza), não se encaixa em nenhuma das 8 categorias de dado de aplicação.
```

```text
ARQUIVO: apps/web/src/shared/lib/safe-storage.ts
STORAGE: sessionStorage (REAL — safeSessionSet())
CHAVE: N/A (função genérica, chave é passada pelo chamador — ver Caso 6)
OPERAÇÃO: WRITE (genérica, após stripSensitive())
DADO_ARMAZENADO: N/A neste arquivo — depende do chamador
FINALIDADE: utilitário de segurança que impede persistência de segredos (CWE-312) — usado corretamente pelo Caso 6, ignorado pelos Casos 5 e 7
CLASSIFICAÇÃO: OTHER
BACKEND_REQUIRED: NÃO
JUSTIFICATIVA: utilitário de infraestrutura/segurança, não um uso de dado específico.
```

```text
ARQUIVO: apps/web/src/shared/lib/tenant-isolation.ts
STORAGE: localStorage (apenas em comentário/JSDoc de tenantStorageKey(); nenhuma chamada real)
CHAVE: N/A (função geradora "musicos360_<tenantId>_<baseKey>", não usada por nenhum dos Casos 2/3/9 que guardam dado de negócio sem isolamento)
OPERAÇÃO: OUTRO
DADO_ARMAZENADO: N/A
CLASSIFICAÇÃO: OTHER
BACKEND_REQUIRED: NÃO
JUSTIFICATIVA: ATENÇÃO ESPECIAL indireta — o helper de isolamento por tenant existe no repositório mas não é consumido pelos Casos 2 (useRuleOverrides), 3 (useFinancialCategoryRulesStore) nem 9 (distribution-platforms), que guardam dado de negócio em chaves globais não isoladas.
```

```text
ARQUIVO: apps/web/src/shared/types/database.ts
STORAGE: localStorage (apenas em comentário: "O app opera 100% com MOCK_DATA (localStorage)")
CHAVE: N/A
OPERAÇÃO: OUTRO
DADO_ARMAZENADO: N/A
CLASSIFICAÇÃO: OTHER
BACKEND_REQUIRED: NÃO
JUSTIFICATIVA: arquivo de tipos puro (Json, Tables<T>, MockRow).
```

```text
ARQUIVO: apps/web/src/test/safe-storage.test.ts
STORAGE: sessionStorage (REAL — sessionStorage.clear()/getItem(), mas é o teste do próprio Caso "safe-storage.ts")
CHAVE: "k" (chave de teste arbitrária)
OPERAÇÃO: READ + WRITE (via safeSessionSet, dentro do teste) + CLEAR (beforeEach)
DADO_ARMAZENADO: dados de teste sintéticos, valida que segredos (access_token, api_key etc.) nunca aparecem no valor persistido
CLASSIFICAÇÃO: OTHER
BACKEND_REQUIRED: NÃO
JUSTIFICATIVA: infraestrutura de teste, não uso de aplicação.
```

```text
ARQUIVO: apps/web/src/test/tenant-labels.test.ts
STORAGE: localStorage (apenas no título de um teste: "uses getAccessToken (not localStorage) to read token")
CHAVE: N/A
OPERAÇÃO: OUTRO
DADO_ARMAZENADO: N/A
FINALIDADE: teste de governança que confirma que getPermissionsFromToken() lê o JWT via getAccessToken() (memória/api-client.ts), não via localStorage
CLASSIFICAÇÃO: OTHER
BACKEND_REQUIRED: NÃO
JUSTIFICATIVA: sinal positivo de governança (teste anti-regressão), não um uso de storage.
```

---

## Resumo

```text
STORAGE_LOCAL_FILES_ANALYZED:
36

AUTH_SESSION_USAGES:
1

USER_PREFERENCE_USAGES:
2

UI_STATE_USAGES:
0

CACHE_USAGES:
0

DRAFT_USAGES:
0

BUSINESS_DATA_USAGES:
4

MOCK_OR_FALLBACK_USAGES:
2

INTEGRATION_STATE_USAGES:
4

OTHER_USAGES:
24

UNRESOLVED_USAGES:
0

BACKEND_REQUIRED_USAGES:
6
```

Os 10 valores acima somam 37 usos identificados (1+2+4+2+4+24), a granularidade real usada nesta etapa (mais fina que os 36 arquivos, pois `useUserSettings.ts` contribui 2 usos distintos). `BACKEND_REQUIRED_USAGES` conta os usos marcados `SIM` de forma inequívoca entre esses 37: Caso 3 (useFinancialCategoryRulesStore), Caso 4 (useVariableRegistry), Caso 7 (useNfe), Caso 9 (distribution-platforms), Caso 12 (useChat), Caso 13 (catalog-lookup) — 6 usos. O achado indireto de `settings.service.test.ts` sobre `shared/lib/storage.ts` (fora dos 36 arquivos) não é somado a este total. Casos marcados `INCERTO` (Casos 2, 6, 10, 11) ou "NÃO AVALIÁVEL" (LogoUploader, music-monitoring.contract.ts, rights.contract.ts) também não são somados.

## Cobertura

36/36 arquivos da lista `STORAGE_LOCAL` (doc03) lidos por completo. 6 dependências diretas fora da lista foram lidas apenas para resolver o valor concreto de uma chave/comportamento (useDeezer.ts, useSpotify.ts, useYouTube.ts e trechos de useNfe.ts/useClicksign.ts/useSigningProviders.ts, todos já dentro dos 36). `apps/api` não foi consultado. Nenhum `localStorage`/`sessionStorage`/IndexedDB foi alterado, removido ou corrigido — apenas classificado.
