import { describe, expect, it } from "vitest";
import { canonicalAutomationFlowId, canonicalMarketingSector } from "./marketing-legacy-vocabulary";
import { AUTOMATION_FLOWS } from "../services/marketing-automation.service";
import { CONTEXT_SECTOR_OPTIONS, CONTEXT_SECTOR_TYPE_OPTIONS, SECTOR_OPTIONS, marketingSectorLabel } from "../constants/marketing.constants";

describe("marketing sector + flow ids (AP3 R3-03)", () => {
  it("reads the legacy PT label as the canonical slug; a tenant-typed sector is user content and stays", () => {
    expect(canonicalMarketingSector("Administração Musical")).toBe("music_administration");
    expect(canonicalMarketingSector("Distribuição Digital")).toBe("digital_distribution");
    expect(canonicalMarketingSector("communication")).toBe("communication");
    expect(canonicalMarketingSector("Meu setor")).toBe("Meu setor");
    expect(canonicalMarketingSector(undefined)).toBe("");
  });

  it("canonical sector values are English slugs with PT-BR labels, and every context option has a type catalog", () => {
    for (const o of SECTOR_OPTIONS) expect(o.value).toMatch(/^[a-z_]+$/);
    expect(marketingSectorLabel("music_administration")).toBe("Administração Musical");
    expect(marketingSectorLabel("Meu setor")).toBe("Meu setor");
    for (const [ctx, options] of Object.entries(CONTEXT_SECTOR_OPTIONS)) {
      for (const o of options) expect(CONTEXT_SECTOR_TYPE_OPTIONS[ctx as keyof typeof CONTEXT_SECTOR_TYPE_OPTIONS][o.value]?.length).toBeGreaterThan(0);
    }
  });

  it("automation flows use canonical ids and canonical sectors; legacy flow ids read canonically", () => {
    const sectors = new Set(SECTOR_OPTIONS.map((o) => o.value));
    for (const flow of AUTOMATION_FLOWS) {
      expect(flow.id).toMatch(/^flow-[a-z-]+$/);
      for (const step of flow.steps) expect(sectors.has(step.sector)).toBe(true);
    }
    expect(AUTOMATION_FLOWS.map((f) => f.id)).toEqual(["flow-music-release", "flow-corporate-content", "flow-behind-the-scenes", "flow-event", "flow-product-saas"]);
    expect(canonicalAutomationFlowId("flow-lancamento")).toBe("flow-music-release");
    expect(canonicalAutomationFlowId("flow-event")).toBe("flow-event");
    expect(canonicalAutomationFlowId("")).toBeUndefined();
  });
});
