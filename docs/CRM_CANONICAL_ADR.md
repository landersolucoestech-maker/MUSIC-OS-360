# ADR: Canonical Music CRM

## Status

Partially decided in code: Contact = Client. `contacts` and `clients` are the same physical entity (the `clients` table); `ContactsService` is a facade over `ClientsService` (`apps/api/src/modules/contacts/contacts.service.ts`) and new code uses `/clients`. The remaining entities below stay proposed for a future phase.

## Decision

Do not create a new CRM in Phase 0. The current `clients`, `leads` and `lead-interactions` base will be audited and then migrated to a canonical model of contacts, organizations, artists, opportunities and a timeline.

## Future entities

- contacts (decided: the existing `clients` table, no separate table)
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
