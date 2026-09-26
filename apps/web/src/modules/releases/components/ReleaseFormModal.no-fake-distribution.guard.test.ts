/**
 * find-ed7823e9 — permanent guard: creating a release must not simulate
 * distribution. The backend creates in DRAFT and only accepts
 * SCHEDULED -> DISTRIBUTED; the old post-create PATCH status:"distributed"
 * used to fail with 400 after a successful create. Also guarantees the page
 * does not write an automatic 100% share ("automatic distribution") on creation.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const MODAL = fs.readFileSync(path.resolve(__dirname, "ReleaseFormModal.tsx"), "utf8");
const PAGE = fs.readFileSync(path.resolve(__dirname, "../pages/Releases.tsx"), "utf8");

describe("ReleaseFormModal — no simulated distribution", () => {
  it("does not force status distributed or distributedAt in the creation flow", () => {
    expect(MODAL).not.toMatch(/status:\s*"distributed"/);
    expect(MODAL).not.toMatch(/distributionCompletedAt/);
    expect(MODAL).not.toMatch(/onCreatedAndDistributed/);
  });

  it("the page does not create an automatic share when creating a release", () => {
    expect(PAGE).not.toMatch(/ensureInitialShare/);
    expect(PAGE).not.toMatch(/distribuído com sucesso/);
    expect(PAGE).toMatch(/onCreated=\{handleReleaseCreated\}/);
  });
});
