import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { ContractStatus, CONTRACT_STATUS_LABELS_PT_BR } from "@music-os-360/types";
import {
  CONTRACT_STATUS_BUCKETS,
  CONTRACT_STATUS_OPTIONS,
  CONTRACT_STATUS_VALUES,
  contractStatusBucket,
} from "./contract-status";
import { contractSchema } from "../schemas/contract-schema";
import { contractSignedAt } from "./contract-signed-at";

// Values allowed by DB CHECK chk_contract_status (migration 20260910000010).
const DB_ALLOWED = [
  "draft", "under_review", "awaiting_signature", "signed", "active",
  "in_force", "expiring", "expired", "terminated", "cancelled",
];
const STALE_PT = ["pendente", "expirado", "rescindido"];
const MODULE_DIR = path.resolve(__dirname, "..");

describe("contract status vocabulary", () => {
  it("canonical enum equals the DB CHECK set", () => {
    expect([...CONTRACT_STATUS_VALUES].sort()).toEqual([...DB_ALLOWED].sort());
  });

  it("every ContractStatus lands in exactly one KPI bucket", () => {
    const all = Object.values(CONTRACT_STATUS_BUCKETS).flat();
    expect([...all].sort()).toEqual([...CONTRACT_STATUS_VALUES].sort());
    expect(new Set(all).size).toBe(all.length);
    for (const s of CONTRACT_STATUS_VALUES) {
      const owners = Object.entries(CONTRACT_STATUS_BUCKETS).filter(([, v]) => v.includes(s));
      expect(owners).toHaveLength(1);
      expect(contractStatusBucket(s)).toBe(owners[0][0]);
    }
  });

  it("expired contracts are closed, not 'em análise'", () => {
    expect(contractStatusBucket("expired")).toBe("closed");
    expect(contractStatusBucket("expiring")).toBe("in_force");
  });

  it("filter/select options are all valid DB statuses with non-empty PT-BR labels", () => {
    expect(CONTRACT_STATUS_OPTIONS.map(([v]) => v).sort()).toEqual([...DB_ALLOWED].sort());
    for (const [value, label] of CONTRACT_STATUS_OPTIONS) {
      expect(DB_ALLOWED).toContain(value);
      expect(label).toBe(CONTRACT_STATUS_LABELS_PT_BR[value as ContractStatus]);
      expect(label).toMatch(/^[A-ZÀ-Ú]/);
      expect(label).not.toMatch(/_/);
    }
  });

  it("zod status accepts every DB status and rejects the stale PT values", () => {
    const base = { title: "T", service_type: "x", start_date: new Date() };
    for (const status of DB_ALLOWED) {
      expect(contractSchema.safeParse({ ...base, status }).success).toBe(true);
    }
    for (const status of STALE_PT) {
      expect(contractSchema.safeParse({ ...base, status }).success).toBe(false);
    }
    expect(contractSchema.parse(base).status).toBe("draft");
  });

  it("no stale PT status token remains in contract module sources", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(e.name) && !/\.test\.ts$/.test(e.name)) files.push(full);
      }
    };
    walk(MODULE_DIR);
    const offenders = files.filter((f) => /["'`](pendente|expirado|rescindido)["'`]/.test(fs.readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("contractSignedAt (ViewModal 'Assinado em')", () => {
  it("reads metadata.signed_at, the only real store", () => {
    expect(contractSignedAt({ metadata: { signed_at: "2026-03-01T10:00:00.000Z" } })).toBe("2026-03-01T10:00:00.000Z");
  });
  it("returns null when absent or malformed (never the phantom assinado_em)", () => {
    expect(contractSignedAt(undefined)).toBeNull();
    expect(contractSignedAt({ metadata: null })).toBeNull();
    expect(contractSignedAt({ metadata: { signed_at: 5 } })).toBeNull();
    expect(contractSignedAt({ assinado_em: "2026-01-01" } as never)).toBeNull();
  });
  it("ContractViewModal uses it and no longer reads assinado_em", () => {
    const src = fs.readFileSync(path.join(MODULE_DIR, "components/ContractViewModal.tsx"), "utf8");
    expect(src).toMatch(/formatDateDashes\(contractSignedAt\(contract\)\)/);
    expect(src).not.toContain("assinado_em");
  });
});
