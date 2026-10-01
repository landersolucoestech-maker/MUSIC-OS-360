import { describe, expect, it } from "vitest";
import { canonicalSourceDepartment } from "./marketing-legacy-vocabulary";

describe("canonicalSourceDepartment (R3-09)", () => {
  it("maps the two legacy spellings and keeps everything else", () => {
    expect(canonicalSourceDepartment("conteudo")).toBe("content");
    expect(canonicalSourceDepartment("operacoes")).toBe("operations");
    expect(canonicalSourceDepartment("design")).toBe("design");
    expect(canonicalSourceDepartment("Departamento X")).toBe("Departamento X");
    expect(canonicalSourceDepartment("toString")).toBe("toString");
    expect(canonicalSourceDepartment(undefined)).toBeUndefined();
  });
});
