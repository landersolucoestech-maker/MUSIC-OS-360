import { describe, expect, it } from "vitest";
import { projectSchema } from "./project-schema";

const base = { releaseType: "single" };

describe("projectSchema notes", () => {
  it("accepts notes up to 2000 characters", () => {
    expect(projectSchema.safeParse({ ...base, notes: "a".repeat(2000) }).success).toBe(true);
  });

  it("rejects notes longer than 2000 characters with the PT-BR message", () => {
    const result = projectSchema.safeParse({ ...base, notes: "a".repeat(2001) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["notes"]);
      expect(result.error.issues[0].message).toBe("Observações deve ter no máximo 2000 caracteres");
    }
  });

  it("validates exactly the canonical form keys", () => {
    expect(Object.keys(projectSchema.shape).sort()).toEqual(["epName", "notes", "releaseType", "status"]);
  });
});
