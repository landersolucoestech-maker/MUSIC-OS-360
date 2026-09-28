import { describe, it, expect } from "vitest";
import { TakedownStatus } from "@music-os-360/types";
import { normalizeTakedown, priorityLabel, statusLabel, typeLabel } from "./takedown-format";

describe("takedown-format (CZ-034 canonical vocabulary)", () => {
  it("labels every TakedownStatus in PT-BR and never shows a raw value", () => {
    for (const status of Object.values(TakedownStatus)) {
      const label = statusLabel(status);
      expect(label).not.toBe(status);
      expect(label).not.toMatch(/_/);
    }
    expect(statusLabel("unknown_value")).toBe("Status não reconhecido");
    expect(statusLabel(null)).toBe("—");
  });

  it("labels the canonical type and priority values", () => {
    expect(typeLabel("sent")).toBe("Enviado por nós");
    expect(typeLabel("received")).toBe("Recebido (Claim)");
    expect(priorityLabel("high")).toBe("Alta");
    expect(priorityLabel("medium")).toBe("Média");
    expect(priorityLabel("low")).toBe("Baixa");
    expect(priorityLabel("urgent")).toBe("—");
  });

  it("normalizes the API row (infringing_url with the legacy url mirror as fallback)", () => {
    const n = normalizeTakedown({
      id: "t1", title: "T", affected_work: "Obra", artist_name: "Artista", platform: "YouTube",
      priority: "high", url: "https://x.test", reason: "Plágio", identified_at: "2026-09-01", evidence: "print",
    } as never);
    expect(n).toMatchObject({
      affectedWork: "Obra", artistName: "Artista", platform: "YouTube", priority: "high",
      infringingUrl: "https://x.test", reason: "Plágio", identifiedAt: "2026-09-01", evidence: "print",
    });
  });
});
