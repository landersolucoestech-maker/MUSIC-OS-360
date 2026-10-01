# Engineering documentation index

This is the entry point for engineering documentation. Per-area conventions below describe the
current stack, scripts and patterns.

## Language policy (stated once, linked from here)

- Technical and internal surfaces are **English**: engineering and developer docs, runbooks, code
  comments, scripts, CI metadata, test names, identifiers, and the machine values of fixtures
  (enum values, slugs, codes, keys).
- **PT-BR is for end-user UX only**: copy a customer sees in the frontend, plus genuine user or
  legal content and quoted external contracts (vendor payloads, legacy scenarios, DSP metadata).
- Which non-Portuguese terms are accepted in PT-BR copy, and the canonical PT-BR rendering of
  recurring technical concepts, live in [ux-language-glossary.md](./ux-language-glossary.md).
- PT-BR examples inside engineering docs are quoted UI copy and are marked as such.
- **Historical records** (dated audits, decision records, point-in-time snapshots) are kept as
  recorded, including their original language, and carry a top banner
  `> Historical record. Kept as recorded; not the current contract.` They are not the current
  contract. Status of `docs/backend-v2/**`:
  [../backend-v2/README.md](../backend-v2/README.md).

## Per-area conventions

| Area | Document |
|---|---|
| Architecture | [architecture.md](./architecture.md) |
| Backend (`apps/api`) | [backend.md](./backend.md) |
| Frontend (`apps/web`) | [frontend.md](./frontend.md) |
| Database and migrations | [database.md](./database.md) |
| Integrations | [integrations.md](./integrations.md) |
| Security | [security.md](./security.md) |
| Testing | [testing.md](./testing.md) |
| Git safety and branch policy | [git-safety.md](./git-safety.md) |
| Data governance | [data-governance.md](./data-governance.md) |
| Release and production | [release-production.md](./release-production.md) |
| Supply chain | [supply-chain.md](./supply-chain.md) |
| RBAC retirement plan | [rbac-retirement-plan.md](./rbac-retirement-plan.md) |
| UX language glossary (PT-BR copy) | [ux-language-glossary.md](./ux-language-glossary.md) |
