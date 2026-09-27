import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  resolvePlatformMetrics,
  metricCapabilitiesOf,
  PLATFORM_METRIC_CAPABILITIES,
} from "./platform-metric-capabilities";
import { AdaptivePlatformMetrics } from "./AdaptivePlatformMetrics";

/**
 * SUBCLUSTER D — the registry describes each source's REAL contract.
 * If a backend provider starts supplying another metric, these tests diverge
 * from runtime — which is exactly the desired signal.
 */

describe("Capability registry — per-platform contract", () => {
  it("Apple Music declares NO audience metric (the source does not provide one)", () => {
    expect(metricCapabilitiesOf("apple_music")).toEqual([]);
    // Accepts both slug formats used in the project.
    expect(metricCapabilitiesOf("apple-music")).toEqual([]);
  });

  it("Apple Music never produces listeners — not 0, not N/A", () => {
    // Even with values, nothing is rendered as a metric.
    const out = resolvePlatformMetrics("apple_music", {
      monthly_listeners: 1234, followers: 99, subscribers: 5,
    });
    expect(out).toEqual([]);
  });

  it("Spotify supports monthly listeners and NOT followers", () => {
    const keys = metricCapabilitiesOf("spotify").map((d) => d.key);
    expect(keys).toEqual(["monthly_listeners"]);
    // followers comes null from the provider; even with a value, it is not supported.
    const out = resolvePlatformMetrics("spotify", { monthly_listeners: 10, followers: 500 });
    expect(out.map((m) => m.key)).toEqual(["monthly_listeners"]);
  });

  it("SoundCloud exposes only the fields it really supports", () => {
    expect(metricCapabilitiesOf("soundcloud").map((d) => d.key)).toEqual(["followers"]);
    const out = resolvePlatformMetrics("soundcloud", { followers: 42, monthly_listeners: 999 });
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe("followers");
  });

  it("YouTube uses subscribers, not followers", () => {
    expect(metricCapabilitiesOf("youtube").map((d) => d.key)).toEqual(["subscribers"]);
  });

  it("sorts by semantic priority, not arrival order", () => {
    // A synthetic platform with two distinct groups proves the ordering.
    PLATFORM_METRIC_CAPABILITIES["__test_multi"] = [
      { key: "followers", label: "Seguidores", semanticGroup: "followers", priority: 50 },
      { key: "monthly_listeners", label: "Ouvintes", semanticGroup: "audience", priority: 20 },
    ];
    const out = resolvePlatformMetrics("__test_multi", { followers: 1, monthly_listeners: 2 });
    expect(out.map((m) => m.key)).toEqual(["monthly_listeners", "followers"]);
    delete PLATFORM_METRIC_CAPABILITIES["__test_multi"];
  });
});

describe("Real zero vs missing metric", () => {
  it("a real 0 is DATA and is preserved", () => {
    const out = resolvePlatformMetrics("soundcloud", { followers: 0 });
    expect(out).toHaveLength(1);
    expect(out[0].value).toBe(0);
  });

  it("null/undefined NEVER becomes a fabricated 0", () => {
    expect(resolvePlatformMetrics("soundcloud", { followers: null })).toEqual([]);
    expect(resolvePlatformMetrics("soundcloud", { followers: undefined })).toEqual([]);
    expect(resolvePlatformMetrics("soundcloud", {})).toEqual([]);
  });

  it("NaN is not treated as a value", () => {
    expect(resolvePlatformMetrics("soundcloud", { followers: Number.NaN })).toEqual([]);
  });
});

describe("Adaptive renderer — platforms with different schemas", () => {
  it("Spotify renders listeners; SoundCloud renders followers", () => {
    const { unmount } = render(
      <AdaptivePlatformMetrics platform="spotify" values={{ monthly_listeners: 1500 }} />,
    );
    expect(screen.getByTestId("metric-spotify-monthly_listeners")).toBeInTheDocument();
    expect(screen.queryByTestId("metric-spotify-followers")).toBeNull();
    unmount();

    render(<AdaptivePlatformMetrics platform="soundcloud" values={{ followers: 2000 }} />);
    expect(screen.getByTestId("metric-soundcloud-followers")).toBeInTheDocument();
    expect(screen.queryByTestId("metric-soundcloud-monthly_listeners")).toBeNull();
  });

  it("Apple Music declares a missing metric without a fabricated card", () => {
    render(<AdaptivePlatformMetrics platform="apple_music" values={{ monthly_listeners: 10 }} />);
    expect(screen.getByTestId("metric-apple_music-unsupported")).toBeInTheDocument();
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.queryByText("N/A")).toBeNull();
  });

  it("a real 0 renders as 0; a missing metric renders as \"Indisponível\"", () => {
    const { unmount } = render(<AdaptivePlatformMetrics platform="soundcloud" values={{ followers: 0 }} />);
    expect(screen.getByTestId("metric-soundcloud-followers")).toHaveTextContent("0");
    unmount();

    render(<AdaptivePlatformMetrics platform="soundcloud" values={{ followers: null }} />);
    expect(screen.getByTestId("metric-soundcloud-followers")).toHaveTextContent("Indisponível");
  });

  it("introduces no connection/OAuth copy into public metrics", () => {
    render(<AdaptivePlatformMetrics platform="instagram" values={{ followers: null }} />);
    for (const forbidden of [/conecte/i, /vincular conta/i, /soundcharts/i]) {
      expect(screen.queryByText(forbidden)).toBeNull();
    }
  });
});
