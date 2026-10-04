/**
 * Compat wiring: ProjectViewModal shows the PT-BR language label of a stored track language,
 * whether persisted as a legacy slug ('portugues') or as the ISO code ('pt').
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/shared/hooks/useWorkflowTransition", () => ({
  useWorkflowTransition: () => ({ transition: vi.fn(), isPending: false }),
}));
vi.mock("@/shared/hooks/useEntityDetail", () => ({
  useEntityDetail: () => ({ data: undefined }),
}));
vi.mock("@/shared/components/WorkflowTransitionPanel", () => ({ WorkflowTransitionPanel: () => null }));
vi.mock("@/shared/components/StoredFileLink", () => ({ StoredFileLink: () => null }));

import { ProjectViewModal } from "./ProjectViewModal";

function renderWith(language: string | undefined) {
  const project = {
    id: "p1", title: "Faixa", type: "single", status: "planning",
    tracks: [{ id: "t1", name: "Faixa", language }],
  };
  render(
    <MemoryRouter>
      <ProjectViewModal open onOpenChange={() => {}} project={project} />
    </MemoryRouter>,
  );
  return screen.getByTestId("text-view-language-0").textContent;
}

describe("ProjectViewModal track language label", () => {
  it.each([
    ["portugues", "Português"],
    ["pt", "Português"],
    ["ingles", "Inglês"],
    ["en", "Inglês"],
  ])("stored language %j renders %s", (stored, label) => {
    expect(renderWith(stored)).toBe(label);
  });

  it("negative: free text is shown as typed", () => {
    expect(renderWith("Klingon")).toBe("Klingon");
  });

  it("negative: absent language renders the dash placeholder", () => {
    expect(renderWith(undefined)).toBe("—");
  });
});
