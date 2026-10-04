import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CampaignSummaryPanel } from "./CampaignSummaryPanel";
import { createDefaultCampaignState } from "./campaign-builder.helpers";
import type { MarketingCampaign } from "../../types/marketing.types";

const stateOf = (fields: Record<string, unknown>) =>
  createDefaultCampaignState({
    id: "c1",
    name: "Summary Campaign",
    objective: "alcance",
    budget: 1000,
    owner: "Owner",
    targetName: "Target Name",
    startDate: "2030-01-01",
    endDate: "2030-01-31",
    platforms: ["instagram"],
    ...fields,
  } as unknown as MarketingCampaign);

// Estimates and validation issues of the summary come from the helpers, for the state of a legacy campaign.
describe("CampaignSummaryPanel", () => {
  it("shows the estimates computed from the budget of the state", () => {
    render(<CampaignSummaryPanel state={stateOf({})} step={1} />);
    expect(screen.getByText(`Alcance: ${(85000).toLocaleString("pt-BR")}`)).toBeTruthy();
    expect(screen.getByText(`Cliques: ${(2800).toLocaleString("pt-BR")}`)).toBeTruthy();
    expect(screen.getByText(`Conversoes: ${(180).toLocaleString("pt-BR")}`)).toBeTruthy();
    expect(screen.getByText("Summary Campaign")).toBeTruthy();
  });

  it("lists the pending issues of the current step", () => {
    render(<CampaignSummaryPanel state={stateOf({ name: "" })} step={3} />);
    expect(screen.getByText("Pendencias")).toBeTruthy();
    expect(screen.getByText("Nome da campanha obrigatório.")).toBeTruthy();
  });

  it("lists no pending issue for a valid step and does not report issues of later steps", () => {
    render(<CampaignSummaryPanel state={stateOf({})} step={2} />);
    expect(screen.queryByText("Pendencias")).toBeNull();
    expect(screen.queryByText("Selecione ao menos uma plataforma.")).toBeNull();
  });

  it("reports the missing platforms once the platforms step is reached", () => {
    render(<CampaignSummaryPanel state={stateOf({})} step={5} />);
    expect(screen.getByText("Selecione ao menos uma plataforma.")).toBeTruthy();
  });
});
