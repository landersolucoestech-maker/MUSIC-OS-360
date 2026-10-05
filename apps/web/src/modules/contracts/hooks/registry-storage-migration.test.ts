import { beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useVariableRegistry } from "./useVariableRegistry";
import { useCategoryRegistry } from "./useCategoryRegistry";

const raw = (name: string) => window.localStorage.getItem(`musicos360:${name}`);

describe("registry localStorage key migration", () => {
  beforeEach(() => window.localStorage.clear());

  it("moves the legacy variable registry to the prefixed key without losing data", () => {
    const legacy = [{ id: "v1", name: "Meu campo", group: "X", field: "Y", placeholder: "{{X.Y}}", createdAt: "2024-01-01" }];
    window.localStorage.setItem("musicos360:variable_registry", JSON.stringify(legacy));
    const { result } = renderHook(() => useVariableRegistry());
    expect(result.current.variables).toEqual(legacy);
    expect(raw("variable_registry")).toBeNull();
    expect(JSON.parse(raw("musicos360_variable_registry")!)).toEqual(legacy);
  });

  it("moves the legacy contract categories to the prefixed key without losing data", () => {
    const legacy = [{ id: "c1", label: "My", value: "my", createdAt: "2024-01-01" }];
    window.localStorage.setItem("musicos360:contract_categories", JSON.stringify(legacy));
    const { result } = renderHook(() => useCategoryRegistry());
    expect(result.current.categories).toEqual(legacy);
    expect(raw("contract_categories")).toBeNull();
    expect(JSON.parse(raw("musicos360_contract_categories")!)).toEqual(legacy);
  });

  it("prefers the prefixed key when both exist and seeds when neither exists", () => {
    const current = [{ id: "c2", label: "New", value: "new", createdAt: "2024-01-01" }];
    window.localStorage.setItem("musicos360:musicos360_contract_categories", JSON.stringify(current));
    window.localStorage.setItem("musicos360:contract_categories", JSON.stringify([]));
    expect(renderHook(() => useCategoryRegistry()).result.current.categories).toEqual(current);
    window.localStorage.clear();
    expect(renderHook(() => useVariableRegistry()).result.current.variables.length).toBeGreaterThan(0);
  });
});
