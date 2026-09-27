---
title: Fix org name + founder role
---
# Fix: Org Name + Founder Role at Boot

## What & Why

After a company signs up via Register.tsx, three problems appear in the real app (MOCK_MODE=false / Clerk active):

1. **Sidebar shows a fictitious name** — `TenantProvider` ignores `musicos360_current_tenant` from localStorage and always initializes with `MOCK_TENANT.name = "Gravadora Exemplo Ltda"`.
2. **Founder receives the "Visualizador" (Viewer) role** — `ClerkBridgeInner` in `AuthContext.tsx` has `role: "viewer"` hardcoded (line 125). Even if the JWT had a role field, `useCurrentRole()` would read from `user.user_metadata.role`, which is always `"viewer"`. `TenantProvider` also defaults to `ROLE_PERMISSIONS.viewer` in non-mock mode.
3. **Pages appear blank** — viewer has neither `write` nor `delete` permission; components with `RequirePermission` render empty; with no real data, the pages look frozen.

## Done looks like

- When entering the app after registration, the sidebar displays the name of the real registered company (e.g. "Minha Gravadora Ltda")
- The founding user (whoever registered the company) appears as **"Proprietário"** (Owner) in the sidebar and topbar, with full access to all pages and actions
- Users invited in the future receive lesser roles — the founder never goes below `owner`
- In MOCK_MODE the behavior remains identical to the current one (do not break it)

## Out of scope

- Role synchronization via a Clerk JWT Template (requires configuration in the Clerk dashboard — future task)
- Member invitations and assignment of different roles per user (future task)
- Any change to the NestJS backend

## Steps

1. **Read `musicos360_current_tenant` from localStorage at TenantProvider boot** — When `MOCK_MODE=false`, when initializing `TenantProvider`, try to read the object from localStorage. If it exists, use the `name`, `slug`, `industry`, `cnpj`, `phone`, `address` of the saved object to overwrite the fictitious values of `MOCK_TENANT`. The founder's role is always `owner`.

2. **Remove the hardcoded `role: "viewer"` from ClerkBridgeInner** — In `AuthContext.tsx`, replace the fixed `role: "viewer"` with a read from localStorage (`musicos360_current_tenant.adminEmail` compared to the clerkUser's email) to detect the founder and return `"owner"`. For any other user (no match), keep `"viewer"` as the safe default.

3. **Update `useSyncTenantFromJWT` to also hydrate from localStorage** — Besides reading the JWT (which may not have `role`), the hook must check whether there is data in `musicos360_current_tenant` and apply `name`, `slug`, and `permissions: ROLE_PERMISSIONS.owner` when the user's email matches the saved tenant's `adminEmail`.

4. **Ensure `TenantProvider` updates reactively** — After login with Clerk (the `isSignedIn` callback changes), the tenant must be re-hydrated from localStorage, not only on the initial mount.

5. **Visual smoke test** — Check in the preview that: (a) the org name appears correctly in the sidebar, (b) the topbar shows "Proprietário" or "Administrador" (Owner or Administrator), (c) create/edit buttons are visible, (d) MOCK_MODE still works without regression.

## Relevant files

- `client/src/app/providers/TenantContext.tsx:169-228`
- `client/src/app/providers/AuthContext.tsx:115-170`
- `client/src/app/providers/tenant-labels.ts:70-94`
- `client/src/modules/auth/pages/Register.tsx:203-207`
- `client/src/shared/components/layout/AppSidebar.tsx:373-411`
- `client/src/shared/hooks/useHasRole.ts:52-57`