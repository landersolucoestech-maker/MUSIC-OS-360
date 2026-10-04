import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const contentsMock = vi.hoisted(() => ({ data: [] as unknown[] }));

vi.mock("../../hooks/useMarketingContents", () => ({ useMarketingContents: () => ({ data: contentsMock.data }) }));
vi.mock("../../hooks/useMarketingProjects", () => ({ useMarketingProjects: () => ({ data: [] }) }));
vi.mock("@/modules/settings/hooks/useUsers", () => ({ useUsers: () => ({ data: [] }) }));
vi.mock("@/shared/components/AsyncEntityCombobox", () => ({ AsyncEntityCombobox: () => null }));
vi.mock("./CampaignGeoMap", () => ({ CampaignGeoMap: () => null }));
vi.mock("./LocationCombobox", () => ({ LocationCombobox: () => null }));
vi.mock("@/shared/ui/select", async () => {
  const React = await import("react");
  const Ctx = React.createContext<(value: string) => void>(() => undefined);
  return {
    Select: ({ onValueChange, children }: { onValueChange?: (value: string) => void; children: React.ReactNode }) =>
      React.createElement(Ctx.Provider, { value: onValueChange ?? (() => undefined) }, children),
    SelectTrigger: ({ children }: { children?: React.ReactNode }) => React.createElement("span", null, children),
    SelectValue: () => null,
    SelectContent: ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children),
    SelectItem: ({ value, children }: { value: string; children?: React.ReactNode }) => {
      const onChange = React.useContext(Ctx);
      return React.createElement("button", { type: "button", "data-testid": `option-${value}`, onClick: () => onChange(value) }, children);
    },
  };
});

import {
  CampaignCreativesStep,
  CampaignPlacementsStep,
  CampaignPlatformsStep,
  CampaignPreviewStep,
  CampaignReviewStep,
} from "./steps";
import { createDefaultCampaignState } from "./campaign-builder.helpers";
import type { CampaignBuilderState, CampaignCreative } from "./campaign-builder.types";

function creative(over: Partial<CampaignCreative>): CampaignCreative {
  return {
    id: "c1", name: "Criativo 1", platform: "META_ADS", placement: "META_STORIES", type: "video",
    fileName: "a.mp4", fileSizeMb: 1, ratio: "9:16", primaryCopy: "copy", headline: "head", description: "", cta: "Saiba mais",
    destinationUrl: "https://loja.com/x", utmSource: "meta_ads", utmMedium: "paid", utmCampaign: "campaign", utmContent: "meta_stories",
    status: "draft", ...over,
  };
}

let latest: CampaignBuilderState;

type StepComponent = (props: { state: CampaignBuilderState; setState: (u: (c: CampaignBuilderState) => CampaignBuilderState) => void }) => JSX.Element;

function mountStep(Step: StepComponent, patch: Partial<CampaignBuilderState>) {
  function Harness() {
    const [state, setState] = useState<CampaignBuilderState>({ ...createDefaultCampaignState(), ...patch });
    latest = state;
    return <Step state={state} setState={setState} />;
  }
  return render(<Harness />);
}

describe("campaign builder steps helper wiring", () => {
  beforeEach(() => {
    contentsMock.data = [];
  });
  afterEach(() => cleanup());

  it("platforms step drops placements of a deselected platform and keeps the others", () => {
    mountStep(CampaignPlatformsStep, { platforms: ["META_ADS", "TIKTOK_ADS"], placements: ["META_FEED", "TIKTOK_FOR_YOU"] });
    fireEvent.click(screen.getByRole("button", { name: "TikTok Ads" }));
    expect(latest.platforms).toEqual(["META_ADS"]);
    expect(latest.placements).toEqual(["META_FEED"]);
  });

  it("platforms step keeps selected placements when a platform is added", () => {
    mountStep(CampaignPlatformsStep, { platforms: ["META_ADS"], placements: ["META_FEED", "META_STORIES"] });
    fireEvent.click(screen.getByRole("button", { name: "Spotify Ads" }));
    expect(latest.platforms).toEqual(["META_ADS", "SPOTIFY_ADS"]);
    expect(latest.placements).toEqual(["META_FEED", "META_STORIES"]);
  });

  it("placements step lists platform placements with owning platform label and expected ratio", () => {
    mountStep(CampaignPlacementsStep, { platforms: ["META_ADS", "GOOGLE_ADS", "YOUTUBE_ADS", "TIKTOK_ADS", "SPOTIFY_ADS"] });
    const expected = [
      "Meta Ads · Stories · 9:16",
      "Meta Ads · Feed · 1:1",
      "Google Ads · Search · n/a",
      "Google Ads · Display · 1:1",
      "YouTube Ads · In-stream · 16:9",
      "YouTube Ads · Shorts · 9:16",
      "TikTok Ads · For You · 9:16",
      "Spotify Ads · Audio · n/a",
      "Spotify Ads · Vídeo · 16:9",
    ];
    for (const label of expected) expect(screen.getByRole("button", { name: label })).toBeTruthy();
    // the shared In-stream placement is listed once only
    expect(screen.getAllByRole("button", { name: /In-stream/ })).toHaveLength(1);
  });

  it("placements step shows the hint instead of a list when no platform is selected", () => {
    mountStep(CampaignPlacementsStep, { platforms: [] });
    expect(screen.getByText("Selecione uma plataforma antes de escolher posicionamentos.")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("creatives step lists placement options with ratios and recomputes the ratio on change", () => {
    mountStep(CampaignCreativesStep, { platforms: ["META_ADS"], placements: ["META_STORIES"], creatives: [creative({ ratio: "9:16" })] });
    expect(screen.getByRole("button", { name: "Reels · 9:16" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Explore · 1:1" })).toBeTruthy();
    fireEvent.click(screen.getByTestId("option-META_FEED"));
    expect(latest.creatives[0].placement).toBe("META_FEED");
    expect(latest.creatives[0].ratio).toBe("1:1");
    fireEvent.click(screen.getByTestId("option-META_REELS"));
    expect(latest.creatives[0].ratio).toBe("9:16");
  });

  it("creatives step shows the final UTM url (absolute and relative destinations, empty when none)", () => {
    const { container } = mountStep(CampaignCreativesStep, {
      creatives: [
        creative({ id: "u1", destinationUrl: "https://loja.com/x" }),
        creative({ id: "u2", destinationUrl: "/lp" }),
        creative({ id: "u3", destinationUrl: "" }),
      ],
    });
    expect(screen.getByDisplayValue("https://loja.com/x?utm_source=meta_ads&utm_medium=paid&utm_campaign=campaign&utm_content=meta_stories")).toBeTruthy();
    expect(screen.getByDisplayValue("/lp?utm_source=meta_ads&utm_medium=paid&utm_campaign=campaign&utm_content=meta_stories")).toBeTruthy();
    const utmInputs = Array.from(container.querySelectorAll("input[readonly]")) as HTMLInputElement[];
    expect(utmInputs.map((input) => input.value)).toEqual([
      "https://loja.com/x?utm_source=meta_ads&utm_medium=paid&utm_campaign=campaign&utm_content=meta_stories",
      "/lp?utm_source=meta_ads&utm_medium=paid&utm_campaign=campaign&utm_content=meta_stories",
      "",
    ]);
  });

  it("creatives step fills the expected ratio on upload only when the creative has none", () => {
    URL.createObjectURL = vi.fn(() => "blob:preview");
    const { container } = mountStep(CampaignCreativesStep, {
      creatives: [creative({ id: "r1", ratio: "", placement: "META_STORIES" }), creative({ id: "r2", ratio: "4:5", placement: "META_STORIES", name: "Criativo 2" })],
    });
    const inputs = Array.from(container.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
    const file = new File(["x"], "clip.mp4", { type: "video/mp4" });
    fireEvent.change(inputs[0], { target: { files: [file] } });
    fireEvent.change(inputs[1], { target: { files: [file] } });
    expect(latest.creatives[0].ratio).toBe("9:16");
    expect(latest.creatives[1].ratio).toBe("4:5");
  });

  it("creatives step builds a new creative for a placement with its expected ratio", () => {
    mountStep(CampaignCreativesStep, { destinationUrl: "https://loja.com", placements: ["META_STORIES", "GOOGLE_SEARCH"] });
    fireEvent.click(screen.getByRole("button", { name: /Criativo para Stories/ }));
    fireEvent.click(screen.getByRole("button", { name: /Criativo para Search/ }));
    expect(latest.creatives.map((c) => [c.placement, c.ratio, c.platform])).toEqual([
      ["META_STORIES", "9:16", "META_ADS"],
      ["GOOGLE_SEARCH", "n/a", "GOOGLE_ADS"],
    ]);
  });

  it("creatives step builds a creative from an existing content with the ratio of its first placement", () => {
    contentsMock.data = [
      { id: "k1", title: "Clipe TikTok", channel: "tiktok", type: "video", status: "draft", files: [] },
      { id: "k2", title: "Post feed", channel: "instagram", type: "image", status: "draft", files: [] },
    ];
    mountStep(CampaignCreativesStep, {});
    const addButtons = screen.getAllByRole("button", { name: /Adicionar/ });
    fireEvent.click(addButtons[0]);
    fireEvent.click(addButtons[1]);
    expect(latest.creatives.map((c) => [c.contentId, c.placement, c.ratio])).toEqual([
      ["k1", "TIKTOK_FOR_YOU", "9:16"],
      ["k2", "META_FEED", "1:1"],
    ]);
  });

  it("review step lists blocking errors, warnings, UTM links and pending creatives", () => {
    mountStep(CampaignReviewStep, {
      name: "",
      creatives: [creative({ id: "v1", name: "Criativo A", ratio: "1:1", placement: "META_STORIES", status: "draft" }), creative({ id: "v2", name: "Criativo B", status: "approved", destinationUrl: "" })],
    });
    expect(screen.getByText("Nome da campanha obrigatório.")).toBeTruthy();
    expect(screen.getByText("Criativo A: proporção enviada 1:1, esperada 9:16.")).toBeTruthy();
    expect(screen.getByText("https://loja.com/x?utm_source=meta_ads&utm_medium=paid&utm_campaign=campaign&utm_content=meta_stories")).toBeTruthy();
    expect(screen.getByText("Criativo A")).toBeTruthy();
    expect(screen.queryByText("Criativo B")).toBeNull();
  });

  it("preview step frames each creative with its placement ratio", () => {
    mountStep(CampaignPreviewStep, {
      creatives: [
        creative({ id: "p1", placement: "META_STORIES" }),
        creative({ id: "p2", placement: "YOUTUBE_IN_STREAM", platform: "YOUTUBE_ADS" }),
        creative({ id: "p3", placement: "SPOTIFY_AUDIO", platform: "SPOTIFY_ADS", headline: "", primaryCopy: "" }),
      ],
    });
    expect(screen.getByText("· 9:16")).toBeTruthy();
    expect(screen.getByText("· 16:9")).toBeTruthy();
    expect(screen.getByText("· n/a")).toBeTruthy();
    expect(screen.getByText("Spotify Ad")).toBeTruthy();
  });
});
