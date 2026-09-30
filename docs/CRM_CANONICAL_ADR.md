# ADR: Canonical Music CRM

## Status

Proposed for a future phase.

## Decision

Do not create a new CRM in Phase 0. The current `clients`, `leads` and `lead-interactions` base will be audited and then migrated to a canonical model of contacts, organizations, artists, opportunities and a timeline.

## Future entities

- contacts
- companies
- artists
- opportunities
- pipelines
- pipeline_stages
- conversations
- messages
- tasks
- tags
- custom_fields
- activity_logs

## Rationale

The product needs to evolve into a music CRM without duplicating existing logic or breaking current modules.
