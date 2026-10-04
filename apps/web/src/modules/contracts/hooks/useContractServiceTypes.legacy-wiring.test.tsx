// Wiring test: rowToType must read rows written before the vocabulary rename (Portuguese ids in
// client_types / financial_model / payment frequency and in the participants/variables/music_work jsonb)
// and expose the canonical values; canonical rows and unknown values are left untouched.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { state } = vi.hoisted(() => ({ state: { rows: [] as any[] } }));

vi.mock("@/modules/contracts/services/contracts.service", () => ({
  contractsService: { listContractServiceTypes: async () => state.rows },
}));

import { useContractServiceTypes } from "@/modules/contracts/hooks/useContractServiceTypes";

const K = (...p: string[]) => p.join("");

async function load(rows: any[]) {
  state.rows = rows;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: any) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useContractServiceTypes(null), { wrapper });
  await waitFor(() => expect(result.current.allServiceTypes.length).toBe(rows.length));
  return result.current.allServiceTypes;
}

const legacyRow = () => ({
  id: "1",
  name: "Legacy",
  slug: "legacy",
  active: true,
  client_types: [K("art", "ista"), K("pessoa", "_fisica"), K("pessoa", "_juridica"), K("art", "ista")],
  financial_model: K("valor", "_fixo"),
  financial_payment_frequency: K("men", "sal"),
  participants: [
    {
      key: "p1",
      entityType: K("pessoa", "_fisica"),
      variables: [{ key: "v", category: K("finan", "ceiro") }],
    },
  ],
  variables: [{ key: "v1", category: K("particip", "antes") }, { key: "v2", category: K("assina", "tura") }],
  music_work: { distributionType: K("nao", "_exclusiva") },
});

describe("useContractServiceTypes legacy wiring (row -> canonical type)", () => {
  it("maps legacy client types, financial model and payment frequency to canonical ids", async () => {
    const [t] = await load([legacyRow()]);
    expect(t.client_types).toEqual(["artist", "individual", "company"]);
    expect(t.financial_model).toBe("fixed_value");
    expect(t.financial_payment_frequency).toBe("monthly");
  });

  it("maps legacy jsonb vocabulary of participants, variables and music_work", async () => {
    const [t] = await load([legacyRow()]);
    expect(t.participants[0].entityType).toBe("individual");
    expect(t.participants[0].variables[0].category).toBe("financial");
    expect(t.variables.map((v: any) => v.category)).toEqual(["participants", "signature"]);
    expect(t.music_work).toEqual({ distributionType: "non_exclusive" });
  });

  it("maps the legacy vocabulary when the jsonb columns arrive as JSON strings", async () => {
    const row: any = legacyRow();
    row.participants = JSON.stringify(row.participants);
    row.variables = JSON.stringify(row.variables);
    row.music_work = JSON.stringify(row.music_work);
    const [t] = await load([row]);
    expect(t.participants[0].entityType).toBe("individual");
    expect(t.variables[0].category).toBe("participants");
    expect(t.music_work?.distributionType).toBe("non_exclusive");
  });

  it("negative: canonical values pass through and unknown ones are not guessed", async () => {
    const [t] = await load([
      {
        id: "2",
        name: "Canon",
        slug: "canon",
        active: true,
        client_types: ["company", "mystery"],
        financial_model: "mixed",
        financial_payment_frequency: "yearly",
        participants: [{ key: "p", entityType: "company" }],
        variables: [{ key: "v", category: "custom" }, { key: "w", category: "categoria_desconhecida" }],
        music_work: { distributionType: "license" },
      },
    ]);
    expect(t.client_types).toEqual(["company", "mystery"]);
    expect(t.financial_model).toBe("mixed");
    expect(t.financial_payment_frequency).toBe("yearly");
    expect(t.participants[0].entityType).toBe("company");
    expect(t.variables.map((v: any) => v.category)).toEqual(["custom", "categoria_desconhecida"]);
    expect(t.music_work?.distributionType).toBe("license");
  });

  it("negative: missing columns fall back to the documented defaults", async () => {
    const [t] = await load([{ id: "3", name: "Bare", slug: "bare", active: true }]);
    expect(t.client_types).toEqual([]);
    expect(t.financial_model).toBe("fixed_value");
    expect(t.financial_payment_frequency).toBe("one_time");
    expect(t.participants).toEqual([]);
    expect(t.music_work).toBeNull();
  });
});
