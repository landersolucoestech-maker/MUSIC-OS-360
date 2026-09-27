import { describe, it, expect } from "vitest";
import { detectionTypeLabel } from "./detection-labels";

describe("detectionTypeLabel", () => {
  it("labels the canonical detection type in PT-BR", () => {
    expect(detectionTypeLabel("unauthorized_use")).toBe("Uso não autorizado");
  });

  it("never renders an unknown technical value raw", () => {
    expect(detectionTypeLabel("some_new_type")).toBe("Outro tipo de uso");
    expect(detectionTypeLabel(null)).toBe("Outro tipo de uso");
  });
});
