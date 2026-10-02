# Operational AI

The 50 operational agents (kind `operational`, domain `operations`) and the 111 operational skills cover the music
business flows: Project, Work, Phonogram, Release, distribution, artists and participants, rights, shares,
credits, contracts and signatures, integrations and provider sync, notifications, tasks, company finance,
integrity, documents, import and export, reports, monitoring, exceptions, approvals and recovery.

## Invariants every operational agent keeps

- Project, Work, Phonogram and released music stay distinct. They do not share participants, rights, percentages,
  contracts or status automatically; each is validated separately and linked only by reference
  (`.claude/policies/domain-boundaries.json`). Completing a Project never registers a Work or a Phonogram.
- Company finance stays separate from external royalties and from society, association and distributor
  transfers (`.claude/policies/financial-boundaries.json`).
- Shares are computed with exact decimals and total exactly one hundred percent per right type: composition on the
  Work, master on the Phonogram (`.claude/policies/rights-shares-integrity.json`).
- Operational agents are read-only in the repository: they analyze, validate and prepare proposals. A change is made
  by a guarded product service, never by writing to the database directly.
- Unknown data is reported as unknown. Nothing is filled with an invented value, and no lyrics are produced when a
  transcription gives insufficient evidence.

## Capabilities that are unavailable today

| Skill | Reason | Behavior |
|---|---|---|
| `transcribe-audio` | no transcription provider configured | returns `CAPABILITY_UNAVAILABLE`; manual transcript is the fallback |
| `submit-distribution` | no distributor provider configured | returns `CAPABILITY_UNAVAILABLE`; the validated package and the approval request stay ready |
| `sync-distribution-status` | no distributor provider configured | returns `CAPABILITY_UNAVAILABLE`; the recorded status is kept |
| payment execution | no payout provider configured | `payment-operations-agent` prepares the dossier; execution is unavailable |

## High-impact actions

Rights, shares, percentages, merges, deletion, destructive changes, signature, legal action, payment, irreversible
external send or publication and automatic legal or financial corrections each map to an action class and need a
recorded human approval (see [approval-model.md](./approval-model.md)). The operational flows are the workflows
`project-operational-flow`, `work-registration-flow`, `phonogram-registration-flow`,
`contract-generation-and-signature-flow`, `release-readiness-flow`, `distribution-flow`,
`distribution-rejection-flow`, `provider-sync-flow`, `import-validation-flow`, `data-integrity-recovery-flow`,
`human-approval-flow` and `operational-recovery-flow`.
