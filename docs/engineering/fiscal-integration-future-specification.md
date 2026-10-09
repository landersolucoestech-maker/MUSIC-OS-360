# Future Fiscal Integration Specification — Music OS 360

> **Status: FUTURE / BLOCKED FOR IMPLEMENTATION**
>
> This document records the mandatory context, research scope, architecture concerns, validation requirements, specialized agent/skill strategy, and execution gates for the future refactor/implementation of the Music OS 360 fiscal invoice module.
>
> **The existence of this document does not authorize implementation.** Do not refactor, migrate, replace, extend, or otherwise modify the current fiscal/Nota Fiscal module until the development queue explicitly reaches this work and a human gives a new implementation order.

## 1. Purpose

The purpose of this specification is to prevent loss of context before the fiscal work reaches the front of the development queue. When that time arrives, the team/agents must not reconstruct the problem from memory or start coding from partial assumptions. They must use this document as the starting context, then re-research the current official fiscal documentation, establish the applicable fiscal scope, produce an approved implementation plan, and only then modify the module.

This is intentionally a **research-and-execution specification**, not an implementation patch.

## 2. Non-negotiable execution rule

Until a future explicit implementation order is given:

- Do not change the Nota Fiscal/Fiscal module.
- Do not add database migrations for fiscal functionality.
- Do not alter fiscal APIs, queues, entities, DTOs, UI, certificates, providers, schemas, workers, or integrations.
- Do not silently “prepare” production code for the future work.
- Do not create a parallel fiscal implementation.
- Do not create another Git branch. The repository policy remains **dev-only**.
- Documentation-only work is allowed only when explicitly requested.

When the queue reaches this work, the first phase is **discovery and specification refresh**, not coding.

---

## 3. Core fiscal scope to determine before implementation

The future implementation must begin by determining which Brazilian electronic fiscal documents are actually required by Music OS 360 business flows.

The team must not treat the terms NF-e, NFC-e, and NFS-e as interchangeable.

### 3.1 NFS-e — service invoices

For **prestação de serviços**, the primary study target is the Brazilian **NFS-e (Nota Fiscal de Serviço eletrônica)** ecosystem, especially the NFS-e Padrão Nacional, its API contracts, DPS/NFS-e model, events, schemas, national environment, municipal parameters, municipal adhesion/compatibility rules, taxation data, and current technical notes.

The implementation must verify, at execution time, whether each supported municipality can use the national standard directly or requires a municipal/provider-specific adapter.

The architecture must therefore assume that a national provider may not be the only provider required forever.

### 3.2 NF-e — model 55

If Music OS 360 business flows require invoicing of goods/products or another operation legally represented by NF-e model 55, study and implement NF-e separately using the official Portal Nacional da NF-e documentation, MOC, XSDs, Web Services, events, DANFE, contingency, authorization rules, and current Notes Técnicas.

### 3.3 NFC-e — model 65

If retail/consumer operations require NFC-e model 65, treat NFC-e as its own applicable document type and use the official documentation, including QR Code/DANFE NFC-e requirements and contingency rules.

### 3.4 Never infer document type from UI wording

A frontend label such as “Nota Fiscal” does not define the legal document model. Before implementation, map each business operation to its fiscal document type and legal/technical requirements.

---

## 4. Official sources are mandatory

At implementation time, all material fiscal behavior must be derived from **official, current sources**, not model memory, blog posts, third-party SDK assumptions, forum answers, or outdated cached documentation.

Third-party material may be used only as secondary explanatory material and never as the authority for fiscal rules.

### 4.1 Official NF-e/NFC-e sources

Primary source:

- Portal Nacional da Nota Fiscal Eletrônica: https://www.nfe.fazenda.gov.br/

Research, at minimum:

- MOC — Manual de Orientação ao Contribuinte, currently known as version 7.0 at the time this document was created.
- MOC — Visão Geral.
- Anexo I — Leiaute NF-e/NFC-e e Regras de Validação.
- DANFE specifications.
- NF-e contingency manual.
- NFC-e contingency manual.
- NFC-e DANFE/QR Code manual where applicable.
- Web Service documentation and current endpoint tables.
- Official XML schemas/XSD packages.
- Event specifications.
- Current Notes Técnicas and their effective dates.
- Rejection codes and validation rules.
- Certificate/signature/security requirements.
- Homologation versus production requirements.

**Do not assume MOC 7.0 alone is sufficient.** Notes Técnicas can alter layout, fields, schemas, validation rules, deadlines, tax handling, and operational behavior without replacing the entire MOC.

### 4.2 Official NFS-e sources

Primary source:

- Portal Nacional da NFS-e / gov.br: https://www.gov.br/nfse/

Research, at minimum:

- Current technical documentation.
- Current production and restricted-production API specifications.
- DPS and NFS-e layouts.
- Current XSD packages.
- National service list and NBS-related annexes where applicable.
- Municipal parameter APIs.
- Event APIs.
- Cancellation and replacement behavior.
- ADN/National Environment responsibilities where applicable.
- DANFSe representation requirements.
- Current rejection/validation rules.
- Certificate/mTLS/XML signature requirements.
- Current tax reform documentation affecting NFS-e.
- All current NFS-e Notes Técnicas and effective dates.

At the time this document was created, 2026 documentation includes active changes related to the consumption tax reform and IBS/CBS. **These versions must be revalidated when implementation actually starts.**

### 4.3 Other authorities/sources when applicable

Depending on the final scope, research may also need to include:

- Receita Federal do Brasil.
- SPED documentation.
- SEFAZ portals for applicable states.
- Municipal tax authority documentation.
- ABRASF or municipality-specific specifications where legally/technically applicable.
- Legislation/regulations relevant to service taxation and the tax regime supported by Music OS 360.

The system must never silently extrapolate a rule from one municipality/state to another without official support.

---

## 5. Mandatory documentation capture before coding

Before implementation begins, create a versioned **Fiscal Source Registry** inside project documentation.

For every authoritative input, capture at least:

- document name;
- authority/source;
- canonical URL;
- publication date;
- version;
- effective date;
- end-of-validity date if known;
- document hash/checksum where practical;
- document type (manual, XSD, NT, annex, endpoint table, legislation, etc.);
- affected fiscal document types;
- affected environments;
- implementation impact;
- superseded documents;
- open ambiguities/questions.

No critical fiscal rule may exist only as “knowledge in an agent prompt”. It must be traceable to a source registry entry.

---

## 6. Required research deliverables before implementation

Before any code change, produce and review all of the following:

1. **Current-state audit** of the existing Nota Fiscal module.
2. **Business-operation → fiscal-document matrix**.
3. **Official documentation inventory**.
4. **Version/effective-date matrix**.
5. **Municipality/state/provider compatibility matrix**.
6. **Current architecture diagram**.
7. **Target architecture proposal**.
8. **Data model proposal**.
9. **Provider/adapters strategy**.
10. **Certificate and secret-management design**.
11. **XML/XSD/signature pipeline design**.
12. **Tax calculation/versioning design**.
13. **Event/state-machine design**.
14. **Idempotency/retry/reconciliation design**.
15. **Contingency strategy** for each applicable fiscal document model.
16. **Homologation plan**.
17. **Security threat model**.
18. **Observability/audit plan**.
19. **Test strategy**.
20. **Production rollout/rollback plan**.
21. **Human approval gate** before implementation.

---

## 7. Target architecture principles

The future fiscal architecture should be designed as a bounded domain, not as scattered API calls.

A likely high-level model is:

```text
Music OS 360
    |
    v
Fiscal Domain
    |
    v
Fiscal Provider Contract
    |
    +--> National NFS-e Provider
    +--> Municipal NFS-e Provider(s)
    +--> NF-e Provider / SEFAZ integration, if required
    +--> NFC-e Provider / SEFAZ integration, if required
    +--> Future fiscal providers
```

The exact interfaces and modules must be derived from the codebase audit and official specifications at implementation time.

### 7.1 Provider abstraction

Avoid coupling domain logic directly to one municipality, one SEFAZ endpoint, or one national API.

The provider boundary should isolate at least:

- endpoint selection;
- transport;
- mTLS;
- request serialization;
- XML generation;
- XML signature;
- response parsing;
- provider rejection mapping;
- protocol/access-key extraction;
- event submission;
- consultation/reconciliation;
- provider-specific capabilities.

### 7.2 Version-aware integration

The architecture must explicitly represent versions of:

- fiscal layout;
- XML schema;
- ruleset;
- Note Técnica;
- service/tax reference tables;
- provider API contract;
- tax engine rules.

Do not create an implementation where a future Note Técnica requires editing dozens of unrelated conditionals across the codebase.

---

## 8. NFS-e future flow to research and validate

For service invoicing, validate the exact current official flow at implementation time. A likely conceptual flow includes:

```text
Business operation
    -> fiscal eligibility
    -> fiscal profile / issuer validation
    -> municipality parameters
    -> service classification
    -> tax classification
    -> Service Invoice Draft
    -> DPS generation
    -> XML construction
    -> XSD validation
    -> digital signature where required
    -> mTLS transport
    -> national/municipal API
    -> validation/rejection or authorization
    -> persist authoritative XML/protocol/access key
    -> DANFSe representation
    -> events / cancellation / replacement
    -> reconciliation
```

The exact steps must follow the current official NFS-e documentation, not this conceptual sequence if the official model changes.

---

## 9. NF-e/NFC-e future flow to research and validate

If NF-e/NFC-e becomes part of the supported scope, research and implement the official process including, as applicable:

- XML construction from current layout;
- current XSD validation;
- digital signature;
- lote/authorization service behavior;
- receipt/protocol behavior;
- authorization response;
- access key generation/validation;
- DANFE generation;
- NFC-e QR Code behavior;
- events;
- cancellation;
- correction letter where applicable;
- inutilização where applicable;
- cadastro/status services where applicable;
- contingency;
- reconciliation after ambiguous network outcomes.

Do not copy an old NF-e integration pattern without checking current Web Services and Notes Técnicas.

---

## 10. XML, XSD, canonicalization, and schemas

XML handling must be treated as a first-class fiscal subsystem.

Mandatory concerns:

- official namespace handling;
- encoding requirements;
- field ordering;
- element cardinality;
- mandatory/optional fields;
- type restrictions;
- minimum/maximum lengths;
- decimal precision and rounding;
- date/time formats and timezone rules;
- enumerations;
- canonicalization;
- whitespace-sensitive behavior where relevant;
- schema includes/imports;
- signed element IDs;
- schema versioning;
- provider-specific extensions only where officially supported.

### 10.1 XSD policy

Official schemas should be stored/versioned in a controlled project package or artifact store so each issued document can be traced to the schema used at issuance.

Do not depend on downloading a live government XSD at request runtime.

Maintain a schema manifest with source, version, checksum, publication/effective dates, and applicable document types.

### 10.2 Validation order

The future pipeline should distinguish:

1. domain validation;
2. fiscal/business-rule validation;
3. XML serialization validation;
4. XSD validation;
5. signature validation;
6. transport/protocol validation;
7. authority/provider validation;
8. post-authorization consistency validation.

Errors from these layers must not be collapsed into one generic “erro ao emitir nota”.

---

## 11. Digital certificates, signatures, mTLS, and cryptography

Before implementation, research the current certificate requirements for each fiscal document/provider.

The design must cover:

- ICP-Brasil requirements;
- A1 versus A3 support strategy;
- whether the first supported version will intentionally support only A1;
- certificate subject/taxpayer binding;
- certificate validity and expiration;
- certificate chain validation;
- revocation considerations;
- PKCS#12/PFX parsing;
- secure secret storage;
- envelope encryption/KMS or equivalent;
- password protection;
- zeroization/short-lived memory handling where practical;
- TLS client certificate use;
- XMLDSig algorithms;
- canonicalization algorithms;
- digest/signature verification;
- certificate rotation;
- audit logs of certificate use without leaking secrets.

Never store raw PFX bytes, private keys, or passwords in logs.

Never hardcode certificates or certificate passwords in source code or repository files.

---

## 12. Web Services / APIs / transport

For every applicable provider/service, capture:

- production base URL;
- restricted-production/homologation base URL;
- service operation;
- method;
- content type;
- authentication;
- mTLS requirement;
- request schema;
- response schema;
- timeout policy;
- retry policy;
- idempotency model;
- rate limits if published;
- HTTP/application error model;
- fiscal rejection codes;
- service availability/status endpoints;
- event endpoints;
- consultation endpoints;
- reconciliation endpoints.

Environment separation must be explicit and fail closed. Production must never silently fall back to homologation, and homologation must never be mistaken for production.

---

## 13. State machines and immutable fiscal history

The future module must model fiscal lifecycle explicitly.

Potential states may include, depending on document type:

- DRAFT;
- VALIDATING;
- READY;
- QUEUED;
- TRANSMITTING;
- PROCESSING;
- AUTHORIZED;
- REJECTED;
- DENIED where legally applicable;
- CANCEL_REQUESTED;
- CANCELLED;
- REPLACED;
- CONTINGENCY;
- RECONCILIATION_REQUIRED;
- PROCESSING_ERROR.

The final state list must be derived from official models and existing business rules.

An authorized fiscal document must not be treated like a normal editable CRUD record. Corrections must occur only through officially supported events/processes.

Keep an append-only or otherwise tamper-evident history of fiscal transitions/events.

---

## 14. Events

Events must be first-class objects, not a side effect hidden in an invoice status update.

Research all officially applicable events for each document type, including where applicable:

- cancellation;
- cancellation by replacement;
- replacement;
- correction letter;
- inutilização;
- acknowledgments/manifestation events;
- provider/customer confirmations;
- other national/municipal events introduced by current documentation.

For each event, define:

- eligibility rules;
- allowed prior states;
- deadline/time window;
- XML/API layout;
- signature requirements;
- idempotency;
- response/protocol persistence;
- rejection handling;
- audit requirements.

---

## 15. Contingency

Contingency must be researched independently per fiscal document type.

Do not invent a generic “offline mode”.

For NF-e/NFC-e, use the current official contingency manuals and Notes Técnicas.

For NFS-e, verify the currently supported national/municipal behavior and whether an applicable contingency mechanism exists for the provider/municipality.

The design must explicitly answer:

- when contingency is legally/technically permitted;
- who activates it;
- what mode is used;
- how numbering behaves;
- how printing/representation behaves;
- how later transmission/reconciliation occurs;
- how duplicate authorization is prevented;
- how ambiguous outcomes are recovered.

---

## 16. DANFE, DANFSe, QR Code, and printable representations

Treat printable representations as derived artifacts, not the authoritative fiscal record.

Research current official requirements for:

- DANFE for NF-e;
- DANFE NFC-e and QR Code for NFC-e;
- DANFSe or equivalent visual representation for NFS-e;
- barcode/QR Code rules;
- required text/fields;
- page/layout rules;
- contingency markings;
- access-key/protocol display;
- print/PDF requirements.

The authoritative signed/authorized XML and protocol must be preserved independently of generated PDF/print output.

---

## 17. IBS/CBS and tax reform

The future fiscal work must include explicit research of the tax reform rules in force at implementation time.

At minimum, determine the then-current requirements for:

- IBS;
- CBS;
- transitional rules;
- cClassTrib or equivalent tax classification fields;
- cIndOp or equivalent operation indicators;
- NBS/service classification impacts;
- bases, rates, reductions, credits, deferment, withholding, and other applicable components;
- coexistence with ISS/PIS/COFINS or other legacy taxes during transition;
- mandatory versus optional fields by effective date;
- validation rules introduced by Notes Técnicas;
- changes to XML/XSD;
- changes to API contracts and rejection codes.

### 17.1 Do not hardcode tax reform assumptions

Implement tax rules in a versioned tax rule engine or equivalent structured model.

Every computed fiscal component should be traceable to:

- rule version;
- legal/technical source;
- effective date;
- input values;
- calculation base;
- rate;
- rounding rule;
- final amount.

A current rule must not overwrite the historical interpretation used for previously authorized documents.

---

## 18. Taxpayer and fiscal profile model

Research and define the minimum correct fiscal profile for an issuer and recipient.

Potential concerns include:

- CNPJ/CPF or future tax identifier formats;
- municipal registration;
- state registration where applicable;
- CNAE where relevant;
- tax regime;
- Simples Nacional flags/regimes where applicable;
- municipality/IBGE code;
- addresses;
- service activity codes;
- tax withholding settings;
- special tax regimes;
- certificate ownership;
- provider enrollment/authorization.

Do not model tax identifiers as numeric database types. Treat them as validated domain strings so formatting/leading zeros and future alphanumeric formats are not structurally impossible.

---

## 19. Reference data and taxonomies

Fiscal reference data must be versioned and updateable independently of arbitrary business code where practical.

Possible reference datasets include:

- service codes;
- national service list;
- municipal service codes;
- NBS;
- tax classifications;
- operation indicators;
- municipalities/IBGE data;
- rejection-code catalogs;
- tax regime codes;
- event codes;
- endpoint/service catalogs.

Build an import/version strategy with source provenance and effective dates.

Never overwrite old reference data in a way that makes historical invoices uninterpretable.

---

## 20. Idempotency, retries, and ambiguous outcomes

Fiscal issuance is highly sensitive to duplicate submissions.

The future implementation must distinguish:

- safe transport retries;
- provider idempotency;
- business idempotency;
- duplicate DPS/document identifiers;
- timeout after provider acceptance;
- timeout before provider acceptance;
- provider 5xx with unknown processing state;
- network disconnect after submission;
- repeated worker execution.

Before reissuing after an ambiguous result, consult/reconcile the authoritative provider when the protocol permits it.

Use stable fiscal operation identifiers and locks/deduplication appropriate to the document model.

Never solve timeout handling with “send again and hope”.

---

## 21. Persistence and evidence

For each fiscal operation, preserve enough evidence to reconstruct what happened.

Depending on legal/security constraints, consider persisting:

- normalized business request;
- fiscal draft;
- generated XML;
- signed XML;
- submitted payload hash;
- authoritative response XML/body;
- response hash;
- access key;
- protocol number;
- event XML/protocols;
- schema version;
- ruleset version;
- provider version;
- tax-rule version;
- environment;
- endpoint/service identifier;
- certificate fingerprint/serial reference, not secret material;
- timestamps;
- rejection codes/messages;
- trace/correlation IDs;
- actor/system origin.

Define retention and access controls according to legal, accounting, privacy, and security requirements.

---

## 22. Multi-tenancy and tenant isolation

Music OS 360 is multi-tenant. Fiscal integrations must preserve strict tenant isolation.

At implementation time, follow the repository's current RLS/session-context rules. Workers, schedulers, public callbacks, and integrations may not automatically inherit request tenant context.

The fiscal implementation must therefore prove:

- certificate belongs to the correct tenant;
- issuer fiscal profile belongs to the correct tenant;
- fiscal documents cannot cross tenants;
- provider-side identifiers resolve uniquely to a tenant;
- background jobs enter the correct tenant DB context;
- administrative/reconciliation paths cannot bypass isolation improperly;
- logs/traces do not leak one tenant's fiscal data into another tenant's context.

Create explicit cross-tenant negative tests.

---

## 23. Security requirements

Before coding, perform a fiscal-specific threat model.

Review at least:

- private-key theft;
- certificate exfiltration;
- password leakage;
- XML signature wrapping or canonicalization mistakes;
- XXE/external entity handling;
- malicious XML/response parsing;
- SSRF through configurable endpoints;
- endpoint substitution/MITM risks;
- insecure TLS settings;
- secret exposure in logs/traces/errors;
- tenant confusion;
- replay attacks;
- duplicate issuance;
- unauthorized cancellation/replacement;
- privilege escalation;
- forged webhook/callback payloads if any provider uses callbacks;
- supply-chain risk in XML/signature libraries;
- unsafe temporary files;
- backups containing raw secrets;
- excessive access to fiscal artifacts.

Default to fail closed.

---

## 24. Observability and auditability

Implement fiscal observability separately from ordinary application logging.

Required dimensions should include, without exposing protected data:

- tenant ID/internal fiscal account ID;
- fiscal operation ID;
- document type;
- provider;
- environment;
- operation type;
- state transition;
- endpoint/service;
- latency;
- retry count;
- rejection/error code;
- schema/ruleset version;
- correlation/trace ID.

Create metrics/alerts for:

- issuance success rate;
- rejection rate by code;
- provider latency;
- timeouts;
- reconciliation backlog;
- event failures;
- certificate expiration;
- certificate validation failures;
- schema validation failures;
- sudden spikes in provider rejection;
- queue age/backlog;
- production calls from unexpected environments.

Logs must redact taxpayer data, secrets, certificate material, private keys, and sensitive XML fields according to policy.

---

## 25. Queue/worker strategy

Music OS 360 already uses BullMQ. When implementation starts, decide which fiscal operations should be synchronous versus asynchronous based on official protocol behavior and user experience.

Likely worker categories to evaluate:

- issuance;
- fiscal events;
- reconciliation;
- reference-data synchronization;
- municipality-parameter refresh;
- certificate validation/expiration monitoring;
- retry/recovery;
- generated representation/PDF tasks.

Even when a government API operation itself is synchronous, the product may still choose asynchronous orchestration to improve resilience and prevent HTTP request lifetimes from controlling fiscal state.

All worker behavior must be idempotent and tenant-safe.

---

## 26. Testing strategy

No fiscal implementation is complete with unit tests only.

### 26.1 Unit tests

Cover:

- tax calculations;
- rounding;
- identifiers;
- state transitions;
- field validation;
- XML builders;
- response parsers;
- rejection mapping;
- reference-data interpretation.

### 26.2 Schema/contract tests

Cover:

- official XSD validation;
- valid official examples;
- invalid boundary cases;
- field ordering;
- enumerations;
- namespace handling;
- schema-version changes.

### 26.3 Cryptographic tests

Cover:

- certificate parsing;
- certificate/issuer identity validation;
- signature generation;
- signature verification;
- canonicalization;
- digest algorithms;
- invalid/expired certificates;
- incorrect passwords;
- mTLS handshake failures.

### 26.4 Integration tests

Use official restricted-production/homologation environments where available.

Cover at minimum:

- successful issuance;
- rejection;
- duplicate/idempotency scenarios;
- timeout/reconciliation;
- consultation;
- cancellation;
- replacement;
- event rejection;
- malformed XML;
- invalid signature;
- expired certificate;
- provider downtime;
- environment separation.

### 26.5 Security tests

Cover:

- cross-tenant access;
- secret redaction;
- XML parser hardening;
- endpoint validation;
- privilege checks;
- replay/duplicate attempts;
- malicious provider response fixtures.

### 26.6 Regression fixtures

Keep versioned, sanitized fixtures for important accepted/rejected fiscal scenarios, including historical schema versions when they remain relevant to stored documents.

---

## 27. Homologation and production readiness

A future implementation must not enter production merely because requests work locally.

Before production, require:

- successful official restricted-production/homologation scenarios;
- valid XSD validation;
- valid signatures;
- mTLS verification;
- provider endpoint verification;
- event/cancellation/replacement verification;
- retry/reconciliation verification;
- tenant isolation verification;
- certificate security review;
- fiscal compliance review;
- observability dashboards/alerts;
- operational runbook;
- incident/recovery runbook;
- backup/retention review;
- rollout plan;
- rollback/feature-disable strategy;
- explicit human production approval.

---

## 28. Agent, subagent, skill, and tool strategy

Before implementation, the project must define and activate a specialized execution pack for fiscal work.

Do not delegate the entire fiscal implementation to one generic coding agent.

### 28.1 Required specialized agents/subagents

The exact names may follow current repository conventions, but coverage must include these responsibilities:

#### A. Fiscal Research / Source Authority Agent

Responsibilities:

- research official federal/state/municipal fiscal documentation;
- build/update the Fiscal Source Registry;
- identify superseded/current documents;
- compare Notes Técnicas;
- track effective dates;
- flag conflicts/ambiguities;
- never create a tax rule without an official source.

#### B. Brazilian Tax Domain Agent

Responsibilities:

- model fiscal concepts;
- analyze ISS and other applicable service taxes;
- analyze IBS/CBS transition/current rules;
- analyze PIS/COFINS/legacy coexistence where applicable;
- analyze tax regimes and withholding where in scope;
- map business operations to tax/document requirements;
- produce traceable rules, not legal guesses.

#### C. Fiscal Architecture Agent

Responsibilities:

- bounded context design;
- provider abstraction;
- state machine;
- idempotency/reconciliation;
- queue design;
- data model;
- versioning strategy;
- multi-tenant integration;
- migration strategy.

#### D. NFS-e Integration Agent

Responsibilities:

- NFS-e Padrão Nacional research;
- DPS/NFS-e flows;
- national APIs;
- municipality parameters;
- municipal provider compatibility;
- events;
- cancellation/replacement;
- DANFSe;
- homologation.

#### E. NF-e/NFC-e Integration Agent

Activate only if those document types are confirmed in scope.

Responsibilities:

- MOC;
- NF-e/NFC-e layouts;
- SEFAZ Web Services;
- authorization/protocol flows;
- events;
- contingency;
- DANFE/QR Code;
- inutilização/correction mechanisms where applicable;
- homologation.

#### F. Fiscal XML/XSD Engineer

Responsibilities:

- XML builder/parser design;
- namespace correctness;
- official XSD ingestion/versioning;
- XSD validation;
- canonicalization-sensitive serialization;
- schema diff analysis;
- regression fixtures.

#### G. Certificate / Cryptography Engineer

Responsibilities:

- ICP-Brasil certificate handling;
- A1/A3 strategy;
- PFX/PKCS#12;
- KMS/envelope encryption;
- mTLS;
- XMLDSig;
- certificate verification/rotation;
- cryptographic library review.

#### H. Fiscal Security Reviewer

Responsibilities:

- threat model;
- certificate/secret security;
- XML parser security;
- SSRF/TLS controls;
- tenant isolation;
- replay/duplicate protection;
- log redaction;
- authorization for fiscal events;
- supply-chain/security regression review.

#### I. Fiscal Test / Conformance Engineer

Responsibilities:

- official fixture testing;
- XSD tests;
- homologation scenarios;
- contract tests;
- rejection-code coverage;
- timeout/reconciliation tests;
- event tests;
- historical version regression.

#### J. Observability / Reliability Engineer

Responsibilities:

- metrics;
- traces;
- audit logs;
- provider health monitoring;
- queue health;
- reconciliation alerts;
- certificate-expiry alerts;
- runbooks;
- incident scenarios.

#### K. Fiscal Compliance Reviewer / Final Gate

Responsibilities:

- verify every material fiscal behavior has an official source;
- verify source/version/effective date traceability;
- verify no unsupported assumptions are embedded;
- verify production-readiness evidence;
- block release if documentation, validation, security, or conformance evidence is incomplete.

### 28.2 Required skills

Before coding, create or confirm project skills covering at least:

- `brazil-fiscal-source-research`
- `nfse-national-standard`
- `nfe-nfce-moc`
- `fiscal-nota-tecnica-diffing`
- `brazil-tax-rule-modeling`
- `ibs-cbs-fiscal-modeling`
- `fiscal-xml-xsd`
- `xml-digital-signature`
- `icp-brasil-certificate-management`
- `fiscal-mtls`
- `fiscal-provider-adapters`
- `fiscal-idempotency-reconciliation`
- `fiscal-homologation-testing`
- `fiscal-security-review`
- `fiscal-observability-audit`
- `fiscal-release-readiness`

Skill content must cite the authoritative source/version and must be updated when Notes Técnicas or schemas change.

### 28.3 Tools the future workflow must have available

Use appropriate tools rather than reasoning from memory alone. The exact stack can change, but capabilities must include:

- official web/PDF research;
- PDF page inspection for technical manuals;
- source URL/version capture;
- document hashing/checksums;
- XML parser/builder;
- XSD validator;
- XML canonicalization and signature verification tooling;
- OpenSSL or equivalent certificate inspection;
- PKCS#12 inspection in safe/non-production fixtures;
- HTTPS/mTLS test client;
- schema/XML diff tooling;
- API contract/HTTP test tooling;
- official homologation environment access;
- secure secret/KMS tooling;
- database migration/test tooling;
- BullMQ/worker test tooling;
- tracing/metrics/log tooling;
- security scanners/dependency auditing;
- reproducible test fixtures.

Do not upload real production private keys/certificates to generic external analysis tools.

---

## 29. Workflow required before implementation

Create or update a repository workflow dedicated to fiscal integration. It should roughly enforce these phases:

```text
01_DISCOVERY
02_EXISTING_MODULE_AUDIT
03_OFFICIAL_SOURCE_REFRESH
04_SCOPE_AND_DOCUMENT_TYPE_DECISION
05_FISCAL_SOURCE_REGISTRY
06_ARCHITECTURE_AND_DOMAIN_MODEL
07_SECURITY_AND_CERTIFICATE_DESIGN
08_XML_XSD_SIGNATURE_DESIGN
09_TAX_RULE_VERSIONING_DESIGN
10_PROVIDER_AND_TRANSPORT_DESIGN
11_STATE_EVENTS_CONTINGENCY_DESIGN
12_TEST_AND_HOMOLOGATION_PLAN
13_HUMAN_PLAN_APPROVAL
14_IMPLEMENTATION
15_INTEGRATION_TESTING
16_OFFICIAL_HOMOLOGATION
17_SECURITY_REVIEW
18_FISCAL_COMPLIANCE_REVIEW
19_OBSERVABILITY_AND_RUNBOOKS
20_PRODUCTION_APPROVAL
```

The repository's existing workflow-first orchestration rules remain applicable. Do not bypass them by constructing an ad-hoc task graph if the project requires a matched workflow.

---

## 30. Mandatory gates

No fiscal production deployment until all applicable gates pass:

- official source inventory complete;
- current Notes Técnicas reviewed;
- current XSDs locked/versioned;
- document-type scope approved;
- municipality/state/provider compatibility known;
- architecture approved;
- tax rules source-traceable;
- XML validates against official schemas;
- signatures validate independently;
- mTLS tested;
- certificate storage reviewed;
- cross-tenant negative tests pass;
- issuance tests pass;
- rejection tests pass;
- event/cancellation/replacement tests pass;
- contingency tests pass where applicable;
- timeout/idempotency/reconciliation tests pass;
- homologation evidence captured;
- observability ready;
- runbooks ready;
- security review passes;
- fiscal compliance review passes;
- explicit human production approval granted.

No agent may self-grant a human approval gate.

---

## 31. Anti-patterns explicitly prohibited

When implementation starts, reject the following:

- treating NF-e, NFC-e, and NFS-e as the same integration;
- using MOC alone for service NFS-e requirements;
- building from an outdated 2026 snapshot without revalidation;
- using blogs as fiscal authority;
- hardcoding current Notes Técnicas into unversioned conditionals;
- downloading XSDs dynamically for every issuance;
- modeling CNPJ/CPF as numeric database fields;
- storing raw PFX/private keys/passwords insecurely;
- logging private keys/certificates/passwords/full sensitive XML;
- editing an authorized fiscal document as ordinary CRUD;
- retrying ambiguous issuance by blindly resending;
- bypassing tenant context in workers;
- mixing homologation and production;
- generating DANFE/DANFSe as the only stored fiscal evidence;
- discarding signed/authorized XML or protocols;
- relying on a single provider implementation with no abstraction where multiple authorities may apply;
- implementing tax calculations without source/effective-date traceability;
- assuming a municipality follows the same rules as another municipality;
- allowing an AI agent to invent a missing fiscal rule.

---

## 32. Questions that must be answered when the queue reaches this work

Before coding, explicitly answer:

1. Which Music OS 360 business operations need fiscal documents?
2. Which document types are legally/technically required for each operation?
3. Is the immediate scope NFS-e only, or also NF-e/NFC-e?
4. Which issuers/tenants will use the feature?
5. Which municipalities/states must be supported first?
6. Which of those use NFS-e Padrão Nacional versus municipal providers?
7. Which tax regimes must be supported?
8. Are Simples Nacional issuers in scope?
9. Are withholding scenarios in scope?
10. What IBS/CBS rules are effective on the implementation date?
11. What legacy taxes coexist in the supported period?
12. Which certificates are supported initially (A1 only or A1/A3)?
13. Who owns/uploads/rotates certificates?
14. What fiscal data retention period is required?
15. What operational SLA is required?
16. What exact homologation credentials/environments are available?
17. What current fiscal functionality already exists and must be migrated/preserved?
18. How will historical invoices remain readable after schema/tax-rule changes?
19. What user permissions are required to issue/cancel/replace invoices?
20. Who gives final fiscal/legal acceptance before production?

---

## 33. Master execution prompt for the future phase

When the development queue finally reaches this work, the following prompt can be used as the starting instruction for the project agents. It must be supplemented by current project context and freshly verified official documentation.

> You are beginning the authorized fiscal integration/refactor phase for Music OS 360. Read `docs/engineering/fiscal-integration-future-specification.md` first. Do not code immediately.
>
> Start with repository/workflow discovery, audit the existing Nota Fiscal/Fiscal implementation, and use the project's workflow-first orchestration. Remain on the single allowed `dev` branch; do not create or switch to another branch.
>
> Before implementation, create/update the specialized fiscal agents, subagents, skills, workflow, and source registry required by the specification. Assign separate responsibilities for official fiscal research, Brazilian tax-domain analysis, fiscal architecture, NFS-e integration, NF-e/NFC-e integration if in scope, XML/XSD, digital certificates/mTLS/XMLDSig, security, testing/homologation, observability/reliability, and final fiscal compliance review.
>
> Research the **current** official Brazilian fiscal documentation. For service invoicing, prioritize the NFS-e Padrão Nacional and applicable municipal documentation. For NF-e/NFC-e, if confirmed in scope, use the current Portal Nacional da NF-e MOC, annexes, schemas, Web Services, contingency manuals, DANFE/QR Code specifications, events, and all applicable Notes Técnicas. Revalidate every version and effective date; do not assume documents referenced in 2026 are still current.
>
> Build a Fiscal Source Registry and version/effective-date matrix before translating any fiscal requirement into code. Every material fiscal rule, XML field, validation, event, tax calculation, endpoint behavior, and security requirement must be traceable to an official source.
>
> Produce and obtain human approval for: scope/document-type matrix, current-state audit, target architecture, provider strategy, data model, certificate security design, XML/XSD/signature pipeline, tax-rule versioning model including current IBS/CBS rules, state machine/events, idempotency/reconciliation, contingency behavior, observability, testing, homologation, rollout, and production gates.
>
> Architect the integration as a version-aware Fiscal bounded context with provider adapters rather than scattered government API calls. Preserve multi-tenant isolation and the repository's DB tenant-context rules, especially in workers/schedulers/integration callbacks.
>
> Treat XML/XSD, digital signatures, ICP-Brasil certificates, mTLS, official rejection codes, events, signed/authorized XML, protocols, DANFE/DANFSe/QR representations, contingency, Notes Técnicas, and tax reform changes such as IBS/CBS as first-class implementation concerns.
>
> Use versioned official XSDs and reference datasets; never invent a fiscal rule. Use safe idempotency/reconciliation for ambiguous network outcomes. Authorized fiscal records are not ordinary editable CRUD records. Preserve authoritative evidence and immutable/tamper-evident history.
>
> Run unit, XSD/contract, cryptographic, integration, security, multi-tenant, failure/retry, event, contingency, and official homologation tests. Do not enable production until the security reviewer, fiscal compliance reviewer, required automated gates, official homologation evidence, observability/runbooks, and explicit human production approval are complete.

---

## 34. Snapshot of documentation known when this record was created

This section is informational only and **must not be treated as current at future implementation time**.

At the time this specification was created (October 2026):

- the Portal Nacional da NF-e still publishes MOC 7.0 for NF-e/NFC-e, with layout/validation, DANFE, and contingency documentation;
- the NFS-e national portal publishes current technical documentation and production/restricted-production API materials;
- NFS-e technical documentation has been undergoing updates related to the Brazilian consumption tax reform and IBS/CBS;
- Notes Técnicas in 2026 have changed fiscal layouts/rules, reinforcing the need for version/effective-date tracking instead of coding from a static manual snapshot.

Again: **re-check everything when implementation is authorized.**

---

## 35. Completion definition for the future fiscal phase

The future phase is not “done” when an API returns an authorized invoice once.

It is done only when the supported fiscal operations are:

- legally/technically scoped;
- source-traceable;
- version-aware;
- tenant-safe;
- cryptographically correct;
- schema-valid;
- idempotent;
- recoverable after ambiguous failures;
- event-aware;
- contingency-aware where applicable;
- tested in official homologation;
- observable;
- auditable;
- documented;
- operationally supportable;
- approved for production by the required human and automated gates.

Until the development queue explicitly reaches this work, this document remains a **future execution specification only**.