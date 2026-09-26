/**
 * STEP 12-J.5 — The harness reporter. Aggregates the HTTP results and writes a summary.
 * Does NOT query rbac_decision_logs (that is the go/no-go via SQL, a separate step).
 */
import * as fs from 'fs';
import * as path from 'path';
import type { loadHarnessConfig, HarnessRole } from './rbac-shadow-harness.config';
import type { ActionKind } from './rbac-shadow-harness.matrix';

export interface RequestRecord {
  role: HarnessRole;
  tenantId: string;
  controller: string;
  resource: string;
  action: ActionKind;
  method: string;
  path: string;
  status: number;
  expectedAllow: boolean;
  rbacPass: boolean; // does the observed RBAC decision match the expected one?
  error?: string;
}

export interface HarnessReportInput {
  runId: string;
  cfg: ReturnType<typeof loadHarnessConfig>;
  records: RequestRecord[];
  createdCount: number;
  cleaned: number;
  cleanupBlocked: number;
}

export async function reportHarness(input: HarnessReportInput): Promise<void> {
  const { records } = input;
  const total = records.length;
  const endpoints = new Set(records.map((r) => `${r.method} ${r.controller}/${r.action}`)).size;
  const resources = new Set(records.map((r) => r.resource)).size;
  const roles = new Set(records.map((r) => r.role)).size;
  const tenants = new Set(records.map((r) => r.tenantId)).size;
  const rbacMismatch = records.filter((r) => !r.rbacPass);
  const byStatus: Record<string, number> = {};
  for (const r of records) byStatus[String(r.status)] = (byStatus[String(r.status)] ?? 0) + 1;

  const summary = {
    runId: input.runId,
    requests: total,
    endpoints, resources, roles, tenants,
    statusDistribution: byStatus,
    rbacMismatch: rbacMismatch.length,
    rbacMismatchSample: rbacMismatch.slice(0, 20),
    created: input.createdCount,
    cleaned: input.cleaned,
    cleanupBlocked: input.cleanupBlocked,
    targetsMet: {
      requests: total >= input.cfg.targets.requests,
      endpoints: endpoints >= input.cfg.targets.endpoints,
      resources: resources >= input.cfg.targets.resources,
      roles: roles >= input.cfg.targets.roles,
      tenants: tenants >= input.cfg.targets.tenants,
    },
  };

  const outDir = path.resolve(__dirname, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `harness-run-${input.runId}.json`);
  fs.writeFileSync(out, JSON.stringify({ summary, records }, null, 2));

  console.log('\n=== HARNESS RESULTADO ===');
  console.log(`requests=${total} endpoints=${endpoints} resources=${resources} roles=${roles} tenants=${tenants}`);
  console.log(`status: ${JSON.stringify(byStatus)}`);
  console.log(`rbac mismatch (status observado ≠ esperado): ${rbacMismatch.length}`);
  console.log(`criados=${input.createdCount} limpos=${input.cleaned} bloqueados_no_cleanup=${input.cleanupBlocked}`);
  console.log(`alvos atingidos: ${JSON.stringify(summary.targetsMet)}`);
  console.log(`relatório salvo: ${out}`);
  console.log('\n>> Próximo passo: rode `npm run rbac:shadow:go-no-go` (lê rbac_decision_logs populado pela API).');
}
