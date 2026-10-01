> Historical record. Kept as recorded; not the current contract.

# 76 — Resolução da Exposição de `ENCRYPTION_IV_SECRET`

Investigação read-only (nenhum valor comprometido foi lido, recuperado ou impresso) sobre se o identificador `ENCRYPTION_IV_SECRET` — encontrado em histórico Git durante a auditoria do Prompt 87 (commit `2c215cb7`, arquivo `attached_assets/Pasted--PROMPT-MESTRE-DEFINITIVO-MUSIC-OS-360-ENTERPRISE-Stack_1778630533508.txt`) — ainda possui qualquer uso, dependência de runtime ou dependência de dados persistidos no MUSIC OS 360 atual. Nenhum banco foi alterado. Nenhuma migration foi executada. Nenhum `.env` foi alterado nesta etapa. DocuSign não foi tratado. Nenhum valor real (antigo ou atual) foi impresso em nenhum momento desta investigação.

---

## 1. Método (sem recuperar o valor)

```text
Nenhum comando executado nesta etapa leu o conteúdo do arquivo histórico
(attached_assets/Pasted--PROMPT-MESTRE-DEFINITIVO-...txt) nem de nenhum commit que o contenha.
Toda pesquisa foi por NOME/IDENTIFICADOR (ENCRYPTION_IV_SECRET, ENCRYPTION_IV, IV_SECRET, ENCRYPTION_KEY,
createCipheriv/createDecipheriv) e por PRESENÇA/AUSÊNCIA em arquivos de ambiente (nomes de variável
extraídos via grep -oE, nunca o valor após o "="). Nenhum valor comprometido foi usado como termo de
busca.
```

---

## 2. Auditoria do identificador atual

```text
Busca por "ENCRYPTION_IV_SECRET" / "ENCRYPTION_IV" / "IV_SECRET" em todo o código-fonte rastreado
(apps/, packages/, scripts/, docs/, infra/): 0 arquivos de código encontrados.

Busca por "createCipheriv"/"createDecipheriv" em todo o repositório: exatamente 1 arquivo —
apps/api/src/core/security/encryption.service.ts (+ seu próprio encryption.service.spec.ts).

CLASSIFICAÇÃO DAS OCORRÊNCIAS ENCONTRADAS:
- apps/api/src/core/security/encryption.service.ts → ACTIVE_RUNTIME (implementação de criptografia
  realmente em uso — mas usa ENCRYPTION_KEY, NUNCA ENCRYPTION_IV_SECRET; ver seção 3)
- .env.development, apps/api/.env (locais, NÃO versionados) → linha `ENCRYPTION_IV_SECRET=` ainda
  presente como entrada órfã — DEAD (nenhum código lê esta variável; ver seção 5)
- Nenhuma outra ocorrência do IDENTIFICADOR em nenhum lugar do repositório atual.
```

---

## 3. Implementação histórica — o que pôde ser determinado sem ler o valor

```text
CRYPTO_ALGORITHM:
UNKNOWN — nenhuma implementação de código correspondente a ENCRYPTION_IV_SECRET foi encontrada em
  NENHUM commit do histórico Git (ver seção 4). O identificador só aparece dentro de um arquivo de
  texto colado (attached_assets/Pasted-*.txt, um dump de prompt de planejamento/especificação), nunca
  em um arquivo .ts/.js/.mjs real. Não há, portanto, código a partir do qual inferir o algoritmo.

SECRET_PURPOSE:
IV (pelo NOME da variável) — mas não verificável além do nome, pela mesma razão acima: nunca houve uma
  implementação real que confirmasse esse uso.

STATIC_IV_USED:
UNKNOWN — ver seção 15 abaixo (HISTORICAL_STATIC_IV_DESIGN).

ENCRYPTION_KEY_SOURCE / IV_SOURCE / DATA_FORMAT / ENCRYPTED_DATA_TARGET:
NÃO DETERMINÁVEL para ENCRYPTION_IV_SECRET especificamente — nenhum código o utiliza ou jamais o
  utilizou de forma comprovável.
```

---

## 4. Renomeação ou reutilização (busca por equivalência estrutural, não por valor)

```text
git log --follow no único arquivo de criptografia real do repositório
(apps/api/src/core/security/encryption.service.ts) mostra exatamente 3 commits, o PRIMEIRO deles já
introduzindo a implementação atual (AES-256-GCM, chave de ENCRYPTION_KEY, IV aleatório por operação via
crypto.randomBytes(12)) — nunca existiu uma versão anterior deste arquivo com um design diferente
(ex.: IV estático). Nenhum outro arquivo de criptografia jamais existiu no histórico deste repositório
(busca por nome de arquivo contendo "crypto"/"encrypt"/"iv" em toda a história, sem abrir conteúdo).

Isso é evidência estrutural forte de que ENCRYPTION_IV_SECRET NUNCA foi de fato implementado em código —
existiu somente como um NOME mencionado dentro de um documento de planejamento colado no repositório
(attached_assets/), não como uma variável realmente consumida por uma aplicação em execução em nenhum
momento da história deste projeto.

SECRET_RENAMED_OR_REUSED:
NÃO (estruturalmente) — a implementação atual (ENCRYPTION_KEY, papel de CHAVE, não de IV; IV gerado
  aleatoriamente por operação, nunca armazenado como secret) tem um PAPEL criptográfico diferente do que
  o nome "ENCRYPTION_IV_SECRET" sugere. Não é uma renomeação da mesma peça de material criptográfico —
  é, na melhor leitura da evidência disponível, um nome que nunca chegou a virar implementação real.
  Equivalência de VALOR (bytes) não foi e não poderia ser testada sem comparar segredos — o que é
  proibido nesta etapa — portanto a equivalência de valor permanece, por definição, não verificada
  (não confundir com a conclusão estrutural acima, que é sobre PAPEL/design, não sobre bytes).
```

---

## 5. Environments — nomes de variável presentes (nenhum valor lido)

```text
.env.development (raiz, não versionado):        ENCRYPTION_KEY= , ENCRYPTION_IV_SECRET= (órfã)
.env.staging (raiz, versionado, placeholders):    nenhuma variável ENCRYPTION_*/CRYPTO_*/IV_* presente
.env.production (raiz, versionado, placeholders): ENCRYPTION_KEY=
apps/api/.env (local, não versionado):            ENCRYPTION_KEY= , ENCRYPTION_IV_SECRET= (órfã)
apps/api/.env.example (versionado):               ENCRYPTION_KEY=
apps/api/.env.production.template (versionado):   ENCRYPTION_KEY=
apps/api-v2 (.env.*.example + src/config):        nenhuma variável ENCRYPTION_*/CRYPTO_*/IV_* presente
  (nenhuma camada de criptografia foi implementada na apps/api-v2 ainda — fora de escopo desta etapa)
docker-compose.yml / docker-compose.prod-test.yml: referenciam ENCRYPTION_KEY (não ENCRYPTION_IV_SECRET)
.github/workflows/*.yml:                          nenhuma referência a ENCRYPTION_IV_SECRET

CURRENT_ENV_REFERENCES: 2 (linhas órfãs de ENCRYPTION_IV_SECRET= em .env.development e apps/api/.env —
  ambos arquivos locais, nunca versionados, e a variável não é lida por nenhum código atual)
```

---

## 6. Dados persistidos — dependência do EncryptionService atual (não do secret antigo)

```text
EncryptionService (ENCRYPTION_KEY, AES-256-GCM, IV aleatório por operação — encryption.service.ts) é
usado ativamente em ~30 arquivos de apps/api/src, cobrindo campos como:

TABLE_OR_ENTITY: artists / clients / leads / company-settings | COLUMN_OR_FIELD: PII (email/telefone/
  CPF, conforme comentário do próprio serviço) | ENCRYPTED: SIM | DECRYPTION_STILL_REQUIRED: SIM
TABLE_OR_ENTITY: integrations (spotify/instagram/tiktok/soundcloud/apple-music/google-ads/abramus/
  autentique) | COLUMN_OR_FIELD: credenciais/tokens de integração | ENCRYPTED: SIM |
  DECRYPTION_STILL_REQUIRED: SIM
TABLE_OR_ENTITY: invoices | COLUMN_OR_FIELD: dados de faturamento sensíveis | ENCRYPTED: SIM |
  DECRYPTION_STILL_REQUIRED: SIM

PERSISTED_ENCRYPTED_DATA_FOUND:
SIM — mas toda essa criptografia usa exclusivamente ENCRYPTION_KEY (a chave AES-256-GCM), NUNCA um IV
  vindo de variável de ambiente — o formato de armazenamento (`enc:v1:` + base64(iv[12] + tag[16] +
  ciphertext), encryption.service.ts:7,49-50) já EMBUTE o IV aleatório dentro do próprio ciphertext
  persistido, tornando estruturalmente impossível que a descriptografia atual dependa de um IV externo
  armazenado em env — o IV nunca é um segredo neste design, é gerado por operação e viaja junto com o
  dado cifrado.

CURRENT_DECRYPTION_DEPENDS_ON_OLD_SECRET:
NÃO — confirmado pela leitura do próprio código de decrypt() (linhas 56-71): os únicos dois insumos são
  `this.key` (de ENCRYPTION_KEY) e os bytes de IV/tag extraídos do próprio payload armazenado. Nenhuma
  leitura de ENCRYPTION_IV_SECRET ou equivalente ocorre em nenhum ponto do caminho de decrypt.
```

Nenhum dado foi lido, descriptografado ou exibido durante esta verificação — a conclusão acima vem exclusivamente da leitura do código-fonte do serviço, não de acesso a dados reais.

---

## 7. Implementação atual de criptografia (contexto, não redesenhada)

```text
CURRENT_CRYPTO_IMPLEMENTATION:
AES-256-GCM (apps/api/src/core/security/encryption.service.ts) — chave de 256 bits (64 hex chars) via
  ENCRYPTION_KEY; IV de 12 bytes gerado por crypto.randomBytes() a CADA operação de encrypt(); GCM auth
  tag (16 bytes) incluída e verificada no decrypt(); payload armazenado como `enc:v1:` + base64(iv + tag
  + ciphertext).

CURRENT_SECRET_SOURCE:
env (ENCRYPTION_KEY via NestJS ConfigService)

CURRENT_RANDOM_IV_PER_RECORD:
SIM (crypto.randomBytes(12) a cada chamada de encrypt(), nunca reaproveitado — exatamente o design
  correto que o Prompt 90 pede para não regredir)

CURRENT_AUTHENTICATED_ENCRYPTION:
SIM (AES-GCM, tag de autenticação de 16 bytes verificada em todo decrypt())

CURRENT_DECRYPTION_DEPENDS_ON_OLD_SECRET:
NÃO (ver seção 6)
```

Nenhuma alteração foi feita a esta implementação. Registrada aqui apenas para confirmar que ela já segue
o padrão correto (IV/nonce por operação, autenticada) — a mesma orientação que a futura apps/api-v2
deverá seguir quando implementar sua própria camada de criptografia (não implementado nesta etapa).

---

## 8. Histórico Git

```text
GIT_HISTORY_EXPOSURE:
SIM (commit 2c215cb7, arquivo attached_assets/Pasted--PROMPT-MESTRE-DEFINITIVO-...txt, linha 518 —
  achado original do Prompt 87)

GIT_HISTORY_REWRITTEN:
NÃO — nenhuma reescrita de histórico (filter-repo/BFG/force-push) foi executada nesta etapa, conforme
  proibição explícita. A necessidade de limpeza histórica é reavaliada abaixo, após a classificação
  operacional (seção 9), e não decidida nesta etapa.
```

---

## 9. Classificação final

```text
ENCRYPTION_IV_SECRET_CLASSIFICATION:
RETIRED_NO_RUNTIME_DEPENDENCY

Justificativa: nenhuma implementação de código jamais consumiu esta variável em toda a história do
repositório (seção 4) — a única implementação de criptografia real (encryption.service.ts) nasceu já
com o design correto (ENCRYPTION_KEY + IV aleatório por operação), sem nunca ter dependido de um IV
vindo de env. Os únicos 2 lugares onde o NOME da variável ainda existe são entradas órfãs em arquivos
locais não versionados (.env.development, apps/api/.env) — clutter de configuração, não uma dependência
operacional. Nenhum dado persistido depende deste secret para ser descriptografado (seção 6).

Atualização (Prompt 91): as 2 linhas órfãs foram removidas de .env.development e apps/api/.env — a
ressalva abaixo (histórico) foi resolvida.

ORPHAN_ENV_REFERENCES_REMOVED:
SIM

CURRENT_ENV_REFERENCES:
0

FINAL_STATUS:
RETIRED_NO_RUNTIME_DEPENDENCY

Ressalva original (histórico, já resolvida): CURRENT_ENV_REFERENCES estava em 2 (não 0) — as 2 linhas
órfãs existiam localmente e não podiam ser removidas naquela etapa (proibição explícita: "não alterar
.env nesta etapa"). Isso nunca reabriu a classificação (o valor não concedia nenhuma capacidade
operacional, pois nada o lia) — apenas registrava uma ação de limpeza pendente, agora concluída.
```

```text
ROTATION_REQUIRED:
NÃO

Não existe "rotação" aplicável a um valor que nenhum sistema atual consome — rotação pressupõe um
consumidor vivo a ser reapontado para um novo valor; aqui não há consumidor algum. A ação correta,
quando autorizada, é REMOÇÃO das 2 linhas órfãs (.env.development, apps/api/.env), não substituição.

OLD_SECRET_OPERATIONALLY_REVOKED:
SIM

O valor histórico não concede acesso nem capacidade operacional hoje — não porque foi trocado por um
novo valor (não é o caso de REPLACED_AND_NEW_SECRET_IN_USE), mas porque nunca existiu um caminho de
código que o tornasse operante.
```

---

## 10. Falha criptográfica histórica (IV estático)

```text
HISTORICAL_STATIC_IV_DESIGN:
UNKNOWN

O NOME "ENCRYPTION_IV_SECRET" sugere, por convenção, um IV tratado como segredo estático (padrão
reconhecidamente arriscado para o modo GCM/CTR se reutilizado entre operações) — mas, conforme a seção 4,
NENHUMA implementação de código correspondente foi encontrada em todo o histórico deste repositório para
comprovar que esse design chegou a ser efetivamente construído/executado. Não é possível, portanto,
declarar SIM com evidência real — apenas registrar o risco IMPLÍCITO pelo nome, nunca confirmado por
código. A apps/api-v2 não deve, de qualquer forma, adotar um IV estático vindo de variável de ambiente —
já reforçado como requisito para quando a criptografia for implementada lá (não implementado nesta
etapa) — independentemente de o padrão antigo ter sido de fato construído ou não.
```

---

## Resumo

```text
ENCRYPTION_IV_SECRET_CLASSIFICATION: RETIRED_NO_RUNTIME_DEPENDENCY
ROTATION_REQUIRED: NÃO
OLD_SECRET_OPERATIONALLY_REVOKED: SIM
PENDING_CLEANUP (fora de escopo desta etapa): remover as 2 linhas órfãs ENCRYPTION_IV_SECRET= de
  .env.development e apps/api/.env quando uma etapa futura autorizar edição desses arquivos.
```

## Cobertura

Identificador atual auditado em todo o código-fonte (0 referências), variável de ambiente auditada por
nome em todos os arquivos de ambiente relevantes (2 referências órfãs, locais, não versionadas, não
consumidas por código). Implementação histórica investigada por evidência estrutural de código (não por
valor) — nenhuma implementação real de ENCRYPTION_IV_SECRET encontrada em toda a história Git; a única
implementação de criptografia do repositório (AES-256-GCM, ENCRYPTION_KEY, IV aleatório por operação)
nasceu já com o design correto, sem histórico de uma versão anterior baseada em IV estático. Renomeação/
reutilização avaliada estruturalmente (papel criptográfico diferente: chave vs. IV) — equivalência de
valor deliberadamente não testada (proibido). Dados persistidos criptografados identificados em ~30
arquivos/3 categorias de dado, todos dependentes exclusivamente de ENCRYPTION_KEY, nunca do secret
retirado. Falha de IV estático registrada como UNKNOWN (risco implícito pelo nome, nunca confirmado por
código real). Histórico Git confirmado exposto, não reescrito. Nenhum banco, migration, Auth, Storage,
Realtime, frontend, código legacy ou apps/api-v2 funcional foi alterado. DocuSign não foi tratado. Nenhum
valor real (antigo ou atual) foi impresso em nenhum momento desta investigação.
