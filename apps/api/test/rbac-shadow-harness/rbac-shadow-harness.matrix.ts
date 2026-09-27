/**
 * STEP 12-J.5 — Matrix of controllers × actions × minimum role tier.
 *
 * `minLevel` = hierarchy level required by the route's @RequireRole/@RequirePermission
 * (mirrors the backend baseline: read→viewer(10), create/update→editor(60),
 *  delete/cancel/archive→manager(70); finance create/update→financial(60),
 *  financial_rule create/update→manager(70), financial_rule delete→admin(80)).
 * Used ONLY to predict the expected result (allow/deny) and validate parity.
 */

export type ActionKind =
  | 'list' | 'detail' | 'create' | 'update' | 'delete'
  | 'cancel' | 'archive' | 'reorder' | 'trigger';

export interface MatrixAction {
  kind: ActionKind;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  /** path suffix; `:id` replaced by a created/known id. */
  pathSuffix: string;
  minLevel: number; // minimum role level for ALLOW
  needsId?: boolean;
  body?: () => Record<string, unknown>;
}

export interface MatrixController {
  name: string;       // controller key
  basePath: string;   // ex.: '/api/v1/artists'
  resource: string;   // ex.: 'artist'
  actions: MatrixAction[];
}

const READ = (extra: MatrixAction[] = []): MatrixAction[] => [
  { kind: 'list', method: 'GET', pathSuffix: '', minLevel: 10 },
  { kind: 'detail', method: 'GET', pathSuffix: '/:id', minLevel: 10, needsId: true },
  ...extra,
];

const CRUD = (resource: string, extra: MatrixAction[] = []): MatrixAction[] => [
  ...READ(),
  { kind: 'create', method: 'POST', pathSuffix: '', minLevel: 60, body: () => marker(resource) },
  { kind: 'update', method: 'PATCH', pathSuffix: '/:id', minLevel: 60, needsId: true, body: () => marker(resource) },
  { kind: 'delete', method: 'DELETE', pathSuffix: '/:id', minLevel: 70, needsId: true },
  ...extra,
];

function marker(resource: string): Record<string, unknown> {
  return {
    __harness: true,
    metadata: { testRunId: process.env['RBAC_HARNESS_RUN_ID'] ?? 'unknown', createdBy: 'rbac-shadow-harness', resource },
  };
}

const V1 = '/api/v1';

export const MATRIX: MatrixController[] = [
  { name: 'artists', basePath: `${V1}/artists`, resource: 'artist', actions: CRUD('artist') },
  { name: 'projects', basePath: `${V1}/projects`, resource: 'project', actions: CRUD('project') },
  { name: 'works', basePath: `${V1}/works`, resource: 'work', actions: CRUD('work') },
  { name: 'phonograms', basePath: `${V1}/phonograms`, resource: 'phonogram', actions: CRUD('phonogram') },
  { name: 'shares', basePath: `${V1}/shares`, resource: 'share', actions: CRUD('share') },
  { name: 'contracts', basePath: `${V1}/contracts`, resource: 'contract', actions: [
    ...READ(), { kind: 'create', method: 'POST', pathSuffix: '', minLevel: 60, body: () => marker('contract') },
    { kind: 'update', method: 'PATCH', pathSuffix: '/:id', minLevel: 60, needsId: true, body: () => marker('contract') },
    { kind: 'cancel', method: 'POST', pathSuffix: '/:id/cancel', minLevel: 70, needsId: true },
  ] },
  { name: 'contract-templates', basePath: `${V1}/contract-templates`, resource: 'contract_template', actions: [
    ...READ(), { kind: 'create', method: 'POST', pathSuffix: '', minLevel: 60, body: () => marker('contract_template') },
    { kind: 'update', method: 'PATCH', pathSuffix: '/:id', minLevel: 60, needsId: true, body: () => marker('contract_template') },
    { kind: 'archive', method: 'POST', pathSuffix: '/:id/archive', minLevel: 70, needsId: true },
  ] },
  { name: 'transactions', basePath: `${V1}/transactions`, resource: 'transaction', actions: [
    ...READ(), { kind: 'create', method: 'POST', pathSuffix: '', minLevel: 60, body: () => marker('transaction') },
    { kind: 'update', method: 'PATCH', pathSuffix: '/:id', minLevel: 60, needsId: true, body: () => marker('transaction') },
    { kind: 'cancel', method: 'POST', pathSuffix: '/:id/cancel', minLevel: 70, needsId: true },
  ] },
  { name: 'invoices', basePath: `${V1}/invoices`, resource: 'invoice', actions: [
    ...READ(), { kind: 'create', method: 'POST', pathSuffix: '', minLevel: 60, body: () => marker('invoice') },
    { kind: 'update', method: 'PATCH', pathSuffix: '/:id', minLevel: 60, needsId: true, body: () => marker('invoice') },
    { kind: 'cancel', method: 'POST', pathSuffix: '/:id/cancel', minLevel: 70, needsId: true },
  ] },
  { name: 'clients', basePath: `${V1}/clients`, resource: 'client', actions: CRUD('client') },
  { name: 'contacts', basePath: `${V1}/contacts`, resource: 'contact', actions: [
    ...READ(), { kind: 'create', method: 'POST', pathSuffix: '', minLevel: 60, body: () => marker('contact') },
    { kind: 'update', method: 'PATCH', pathSuffix: '/:id', minLevel: 60, needsId: true, body: () => marker('contact') },
  ] },
  { name: 'leads', basePath: `${V1}/leads`, resource: 'lead', actions: CRUD('lead') },
  { name: 'lead-interactions', basePath: `${V1}/lead-interactions`, resource: 'lead_interaction', actions: [
    ...READ(), { kind: 'create', method: 'POST', pathSuffix: '', minLevel: 60, body: () => marker('lead_interaction') },
    { kind: 'delete', method: 'DELETE', pathSuffix: '/:id', minLevel: 70, needsId: true },
  ] },
  { name: 'licensing', basePath: `${V1}/licenses`, resource: 'license', actions: CRUD('license') },
  { name: 'artist-goals', basePath: `${V1}/artist-goals`, resource: 'artist_goal', actions: CRUD('artist_goal') },
  { name: 'events', basePath: `${V1}/events`, resource: 'event', actions: CRUD('event') },
  { name: 'financial-categories', basePath: `${V1}/financial-categories`, resource: 'financial_category', actions: [
    ...CRUD('financial_category'),
    { kind: 'reorder', method: 'POST', pathSuffix: '/reorder', minLevel: 60, body: () => ({ order: [] }) },
  ] },
  { name: 'financial-rules', basePath: `${V1}/financial-rules`, resource: 'financial_rule', actions: [
    ...READ(),
    { kind: 'create', method: 'POST', pathSuffix: '', minLevel: 70, body: () => marker('financial_rule') },
    { kind: 'update', method: 'PATCH', pathSuffix: '/:id', minLevel: 70, needsId: true, body: () => marker('financial_rule') },
    { kind: 'delete', method: 'DELETE', pathSuffix: '/:id', minLevel: 80, needsId: true },
    { kind: 'trigger', method: 'POST', pathSuffix: '/:id/trigger', minLevel: 60, needsId: true },
  ] },
];
