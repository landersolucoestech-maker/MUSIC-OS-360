// @ts-nocheck
// Wiring test: the contact detail shows PT-BR labels for the stored person type and profile
// (profile slugs persisted before the English vocabulary are read as canonical), never the raw value.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

vi.mock("../hooks/useClientTimeline", () => ({
  useClientTimeline: () => ({ entries: [], isLoading: false, error: null, addEntry: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/shared/hooks/useSkillRun", () => ({
  useSkillRun: () => ({ run: vi.fn(), isRunning: false, result: null, error: null, data: null, isLoading: false, reset: vi.fn() }),
}));
vi.mock("@/shared/components/SkillRunPanel", () => ({ SkillRunPanel: () => null }));

import { ContactViewModal } from "./ContactViewModal";

const K = (...p: string[]) => p.join("");

const baseContact = (over: any = {}) => ({
  id: "c1",
  name: "Fulano",
  personType: "individual",
  category: "CORPORATE_CLIENT",
  profile: "artist_or_band",
  status: "active",
  priority: "medium",
  interactions: [],
  attachments: [],
  ...over,
});

const valueOf = (label: string) => screen.getByText(label, { selector: "p" }).nextElementSibling as HTMLElement;

function show(over: any) {
  return render(<ContactViewModal open onOpenChange={() => {}} contact={baseContact(over)} />);
}

describe("ContactViewModal legacy wiring (classification labels)", () => {
  it.each([
    [K("artista", "_banda"), "Artista/Banda"],
    ["artist_or_band", "Artista/Banda"],
    [K("empresario", "_artistico"), "Empresário Artístico"],
    [K("contratante", "_show"), "Contratante de Show"],
  ])("stored profile %s is shown as %s", (stored, label) => {
    const { unmount } = show({ profile: stored });
    expect(valueOf("Perfil")).toHaveTextContent(new RegExp(`^${label}$`));
    unmount();
  });

  it("a legacy profile saved under another category keeps its real label (never the raw slug)", () => {
    const { unmount } = show({ profile: K("fotogr", "afo"), category: "CORPORATE_CLIENT" });
    expect(valueOf("Perfil")).toHaveTextContent(/^Fotógrafo$/);
    unmount();
  });

  it("negative: an unknown profile shows the generic label, not the raw slug", () => {
    const { unmount } = show({ profile: "perfil_desconhecido" });
    expect(valueOf("Perfil")).toHaveTextContent(/^Perfil não cadastrado$/);
    unmount();
  });

  it.each([
    ["individual", "Pessoa Física"],
    ["company", "Pessoa Jurídica"],
  ])("person type %s is shown as %s", (stored, label) => {
    const { unmount } = show({ personType: stored, profile: "other" });
    expect(valueOf("Tipo de Contato")).toHaveTextContent(new RegExp(`^${label}$`));
    unmount();
  });

  it("negative: a person type outside the catalog is not shown raw", () => {
    const { unmount } = show({ personType: K("pessoa", "_fisica") });
    expect(valueOf("Tipo de Contato")).toHaveTextContent(/^Tipo não identificado$/);
    unmount();
  });
});
