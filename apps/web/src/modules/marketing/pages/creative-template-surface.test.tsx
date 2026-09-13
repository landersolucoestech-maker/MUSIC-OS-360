import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CreativeTemplateSurface } from "./creative-template-surface";
import { defaultCreativeConfig, type CreativeConfig } from "../types/creative.types";

const image = (url: string) => ({ assetUrl: url, kind: "image" as const });
const video = (url: string) => ({ assetUrl: url, kind: "video" as const });

function config(overrides: Partial<CreativeConfig> = {}): CreativeConfig {
  return { ...defaultCreativeConfig(), mode: "template", ...overrides };
}

describe("CreativeTemplateSurface — FULL layout", () => {
  it("renders exactly one media region, none for the secondary slot", () => {
    render(<CreativeTemplateSurface creative={config({ layout: "full", primarySlot: image("https://cdn/a.png") })} />);
    expect(screen.getByTestId("creative-media-primary")).toBeInTheDocument();
    expect(screen.queryByTestId("creative-media-secondary")).not.toBeInTheDocument();
  });

  it("renders an image asset", () => {
    render(<CreativeTemplateSurface creative={config({ layout: "full", primarySlot: image("https://cdn/photo.png") })} />);
    const img = screen.getByTestId("creative-media-primary").querySelector("img");
    expect(img).toHaveAttribute("src", "https://cdn/photo.png");
  });

  it("renders a video asset", () => {
    render(<CreativeTemplateSurface creative={config({ layout: "full", primarySlot: video("https://cdn/clip.mp4") })} />);
    const vid = screen.getByTestId("creative-media-primary").querySelector("video");
    expect(vid).toHaveAttribute("src", "https://cdn/clip.mp4");
  });

  it("secondarySlot content never renders in FULL, even when populated (no hidden split media leaking through)", () => {
    render(<CreativeTemplateSurface creative={config({
      layout: "full",
      primarySlot: image("https://cdn/full.png"),
      secondarySlot: image("https://cdn/should-not-appear.png"),
    })} />);
    expect(screen.queryByText(/should-not-appear/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("creative-media-secondary")).not.toBeInTheDocument();
  });
});

describe("CreativeTemplateSurface — SPLIT layout", () => {
  it("renders two independent media regions", () => {
    render(<CreativeTemplateSurface creative={config({
      layout: "split",
      primarySlot: image("https://cdn/left.png"),
      secondarySlot: video("https://cdn/right.mp4"),
    })} />);
    const left = screen.getByTestId("creative-media-primary");
    const right = screen.getByTestId("creative-media-secondary");
    expect(left.querySelector("img")).toHaveAttribute("src", "https://cdn/left.png");
    expect(right.querySelector("video")).toHaveAttribute("src", "https://cdn/right.mp4");
  });

  it("has zero gap/border/padding between the two panes — a single flex row with no gap-* class", () => {
    render(<CreativeTemplateSurface creative={config({
      layout: "split",
      primarySlot: image("https://cdn/left.png"),
      secondarySlot: image("https://cdn/right.png"),
    })} />);
    const row = screen.getByTestId("creative-media-primary").parentElement!;
    expect(row.className).not.toMatch(/gap-|divide-|border/);
    expect(row.children).toHaveLength(2);
  });

  it("changing the left slot never affects the right slot's rendered content", () => {
    const base = config({ layout: "split", primarySlot: image("https://cdn/left-v1.png"), secondarySlot: image("https://cdn/right.png") });
    const { rerender } = render(<CreativeTemplateSurface creative={base} />);
    rerender(<CreativeTemplateSurface creative={{ ...base, primarySlot: image("https://cdn/left-v2.png") }} />);
    expect(screen.getByTestId("creative-media-primary").querySelector("img")).toHaveAttribute("src", "https://cdn/left-v2.png");
    expect(screen.getByTestId("creative-media-secondary").querySelector("img")).toHaveAttribute("src", "https://cdn/right.png");
  });

  it("secondary slot is not required -- an empty right pane still renders its own placeholder, not a crash", () => {
    render(<CreativeTemplateSurface creative={config({ layout: "split", primarySlot: image("https://cdn/left.png"), secondarySlot: null })} />);
    expect(screen.getByTestId("creative-media-secondary")).toBeInTheDocument();
    expect(screen.getByTestId("creative-media-secondary").querySelector("img,video")).toBeNull();
  });
});

describe("CreativeTemplateSurface — watermark", () => {
  it("overlays the media region's own midpoint (a sibling of the media row, inside the same media-region container), not a per-panel position", () => {
    render(<CreativeTemplateSurface creative={config({
      layout: "split",
      primarySlot: image("https://cdn/left.png"),
      secondarySlot: image("https://cdn/right.png"),
      watermark: { enabled: true, assetUrl: "https://cdn/watermark.png", opacity: 1 },
    })} />);
    const watermark = screen.getByTestId("creative-watermark");
    const mediaRegion = screen.getByTestId("creative-media-region");
    expect(watermark.parentElement).toBe(mediaRegion);
    expect(watermark.className).toMatch(/left-1\/2/);
    expect(watermark.className).toMatch(/-translate-x-1\/2/);
  });

  it("does not render when disabled", () => {
    render(<CreativeTemplateSurface creative={config({ watermark: { enabled: false, assetUrl: "https://cdn/watermark.png", opacity: 1 } })} />);
    expect(screen.queryByTestId("creative-watermark")).not.toBeInTheDocument();
  });

  it("is independent from profileAvatar -- setting one never sets or clears the other", () => {
    render(<CreativeTemplateSurface creative={config({
      profileAvatar: image("https://cdn/avatar.png"),
      watermark: { enabled: true, assetUrl: "https://cdn/watermark.png", opacity: 1 },
    })} />);
    const avatarImg = screen.getByTestId("creative-watermark").previousElementSibling; // media row is before watermark; avatar lives in header
    expect(screen.getByTestId("creative-watermark").querySelector("img")).toHaveAttribute("src", "https://cdn/watermark.png");
    const headerAvatar = document.querySelector('img[alt=""]'); // first img in DOM order is the header avatar
    expect(headerAvatar).toHaveAttribute("src", "https://cdn/avatar.png");
    expect(avatarImg).not.toBeNull(); // media row exists as watermark's preceding sibling
  });
});

describe("CreativeTemplateSurface — identity and caption", () => {
  it("renders profile name and username independently, with @ applied only for display", () => {
    render(<CreativeTemplateSurface creative={config({ profileName: "Acme Records", username: "acmerecords" })} />);
    expect(screen.getByText("Acme Records")).toBeInTheDocument();
    expect(screen.getByText("@acmerecords")).toBeInTheDocument();
  });

  it("renders no hardcoded demo identity when fields are empty", () => {
    render(<CreativeTemplateSurface creative={config()} />);
    expect(screen.queryByText(/lander records/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/@landerrecords/i)).not.toBeInTheDocument();
  });

  it("renders the caption below the identity block, not merged into one row", () => {
    render(<CreativeTemplateSurface creative={config({ profileName: "Acme", caption: "Breaking news today" })} />);
    const caption = screen.getByText("Breaking news today");
    const identityRow = screen.getByText("Acme").closest("div")!.parentElement!;
    expect(identityRow.contains(caption)).toBe(false);
  });

  it("falls back to a plain avatar placeholder (no crash) when profileAvatar is not set", () => {
    render(<CreativeTemplateSurface creative={config({ profileName: "Acme" })} />);
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });
});
