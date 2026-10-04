import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import type { CampaignBuilderState } from "./campaign-builder.types";

type StepProps = { setState: (updater: (current: CampaignBuilderState) => CampaignBuilderState) => void };

const creative = {
  id: "cr1", name: "Clip", platform: "YOUTUBE_ADS", placement: "YOUTUBE_IN_STREAM", type: "video", fileName: "clip.mp4",
  fileSizeMb: 1, ratio: "16:9", primaryCopy: "", headline: "", description: "", cta: "Listen", destinationUrl: "",
  utmSource: "", utmMedium: "", utmCampaign: "", utmContent: "", status: "draft",
};

// Test-only step bodies: the real steps are out of scope, these only drive the shared builder state.
vi.mock("./steps", () => {
  const nothing = () => null;
  const FillPlatforms = ({ setState }: StepProps) => (
    <button onClick={() => setState((c) => ({ ...c, platforms: ["YOUTUBE_ADS"], placements: ["YOUTUBE_IN_STREAM"] }))}>fill-platforms</button>
  );
  const FillCreatives = ({ setState }: StepProps) => (
    <button onClick={() => setState((c) => ({ ...c, creatives: [creative as never] }))}>fill-creatives</button>
  );
  return {
    CampaignObjectiveStep: nothing,
    CampaignOutcomeStep: nothing,
    CampaignBasicInfoStep: nothing,
    CampaignAudienceStep: nothing,
    CampaignPlatformsStep: FillPlatforms,
    CampaignPlacementsStep: nothing,
    CampaignCreativesStep: FillCreatives,
    CampaignBudgetStep: nothing,
    CampaignReviewStep: nothing,
  };
});
vi.mock("../../hooks/useMarketingCampaigns", () => ({ useCampaignBuilderConfig: () => ({ data: {} }) }));
vi.mock("@/shared/ui/scroll-area", () => ({ ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

import { CampaignBuilderModal } from "./CampaignBuilderModal";
import type { MarketingCampaign } from "../../types/marketing.types";

const legacyCampaign = (fields: Record<string, unknown> = {}) =>
  ({
    id: "c1",
    name: "Legacy Campaign",
    objective: "alcance",
    budget: 1400,
    owner: "Owner",
    targetName: "Target Name",
    startDate: "2030-01-01",
    endDate: "2030-01-31",
    platforms: ["instagram"],
    notes: JSON.stringify({ phase: "not_a_phase", budget: { strategy: "not_a_strategy" } }),
    ...fields,
  }) as unknown as MarketingCampaign;

function open(campaign: MarketingCampaign | null, onSubmit = vi.fn()) {
  render(<CampaignBuilderModal open campaign={campaign} submitting={false} onOpenChange={() => undefined} onSubmit={onSubmit} />);
  return onSubmit;
}

const next = () => fireEvent.click(screen.getByRole("button", { name: "Próximo" }));

describe("CampaignBuilderModal state hydration and submit mapping", () => {
  it("opens a legacy saved campaign with canonical state and submits the mapped input", () => {
    const onSubmit = open(legacyCampaign());
    expect(screen.getByText("Editar campanha")).toBeTruthy();
    // The investment panel reflects the hydrated budget; the daily estimate is derived from it.
    expect((screen.getByDisplayValue("1400") as HTMLInputElement).type).toBe("number");
    fireEvent.click(screen.getByRole("button", { name: /Salvar rascunho/ }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const input = onSubmit.mock.calls[0][0];
    expect(input.name).toBe("Legacy Campaign");
    // Legacy objective is mapped to the canonical one; the unmapped input state is not sent as is.
    expect(input.objective).toBe("REACH");
    expect(input.status).toBe("draft");
    expect(input.targetName).toBe("Target Name");
    expect(input.platforms).toEqual(["instagram"]);
    expect(input.budget).toBe(1400);
    expect(input.metrics.isEstimated).toBe(true);
    const notes = JSON.parse(input.notes as string);
    expect(notes.phase).toBe("launch");
    expect(notes.budget.strategy).toBe("lowest_cost");
    expect(input.id).toBeUndefined();
  });

  it("opens a new campaign (no saved campaign) with default state", () => {
    const onSubmit = open(null);
    expect(screen.getAllByText("Nova campanha").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Salvar rascunho/ }));
    const input = onSubmit.mock.calls[0][0];
    expect(input.objective).toBe("TRAFFIC");
    expect(JSON.parse(input.notes as string).phase).toBe("launch");
  });
});

describe("CampaignBuilderModal step validation", () => {
  it("blocks Próximo on the data step while the campaign has no name, and shows the issue", () => {
    open(legacyCampaign({ name: "" }));
    next();
    next();
    expect(screen.getByRole("button", { name: "Próximo" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getAllByText("Nome da campanha obrigatório.").length).toBeGreaterThan(0);
  });

  it("lets a valid legacy campaign pass the first steps and blocks the platforms step until one is chosen", () => {
    open(legacyCampaign());
    next();
    next();
    next();
    next();
    expect(screen.getByRole("button", { name: "Próximo" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getAllByText("Selecione ao menos uma plataforma.").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("fill-platforms"));
    expect(screen.getByRole("button", { name: "Próximo" }).hasAttribute("disabled")).toBe(false);
  });

  it("blocks the creatives step until every placement has a creative, then the preview shows the placement ratio", () => {
    open(legacyCampaign());
    for (let i = 0; i < 4; i += 1) next();
    fireEvent.click(screen.getByText("fill-platforms"));
    next();
    next();
    // Step 7: a placement without creative blocks the way forward.
    expect(screen.getByRole("button", { name: "Próximo" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getAllByText("Cada posicionamento precisa de um criativo.").length).toBeGreaterThan(0);
    expect(screen.getByText("9:16")).toBeTruthy();
    fireEvent.click(screen.getByText("fill-creatives"));
    expect(screen.getByRole("button", { name: "Próximo" }).hasAttribute("disabled")).toBe(false);
    // In-stream video placements expect 16:9 and the default 9:16 preview is gone.
    expect(screen.getByText("16:9")).toBeTruthy();
    expect(screen.queryByText("9:16")).toBeNull();
  });

  it("finishes a valid campaign: the final button is enabled and submits the mapped input", () => {
    const onSubmit = open(legacyCampaign());
    for (let i = 0; i < 4; i += 1) next();
    fireEvent.click(screen.getByText("fill-platforms"));
    next();
    next();
    fireEvent.click(screen.getByText("fill-creatives"));
    next();
    next();
    const finish = screen.getByRole("button", { name: "Finalizar campanha" });
    expect(finish.hasAttribute("disabled")).toBe(false);
    fireEvent.click(finish);
    const input = onSubmit.mock.calls[0][0];
    expect(input.objective).toBe("REACH");
    expect(JSON.parse(input.notes as string).creatives).toHaveLength(1);
    expect(input.creativeAssetIds).toEqual(["cr1"]);
  });
});
