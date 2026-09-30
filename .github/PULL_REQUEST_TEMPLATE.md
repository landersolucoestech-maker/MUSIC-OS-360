## Description

<!-- WHAT this PR changes and WHY. Do not describe what the code does; describe the motivation. -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor (no behavior change)
- [ ] Breaking change
- [ ] Documentation / configuration

## Required checklist

### Quality
- [ ] `pnpm typecheck` passes without errors
- [ ] `pnpm lint` passes without errors
- [ ] Relevant tests added or updated
- [ ] No debug `console.log` left in the code

### Security
- [ ] No hardcoded key, token, or secret
- [ ] Inputs validated with Zod at the endpoint (backend) or in the form (frontend)
- [ ] RBAC permissions checked (which role may access this resource?)
- [ ] Sensitive data (CPF, CNPJ, PIX, bank accounts) handled with care

### Multi-tenancy
- [ ] Every query filters by `tenant_id` (never returns cross-tenant data)
- [ ] `TenantGuard` or equivalent applied on the affected controllers

### Package manager
- [ ] Only `pnpm` used: no `npm install` or `yarn add` executed
- [ ] No `package-lock.json` or `yarn.lock` added/modified

### Database (if applicable)
- [ ] Migration created for any schema change
- [ ] Migration is reversible (has `down`)
- [ ] No existing data broken

### Documentation
- [ ] `docs/GOVERNANCE.md` updated if a new entity or module was created
- [ ] New fields documented in the matching DTO

## How to test

<!-- Steps for the reviewer to reproduce and manually validate. -->

1. 
2. 
3. 

## Related branches / backlog

<!-- If this PR implements an item from docs/BACKLOG.md, reference its ID here (e.g. BACKLOG-007). -->
