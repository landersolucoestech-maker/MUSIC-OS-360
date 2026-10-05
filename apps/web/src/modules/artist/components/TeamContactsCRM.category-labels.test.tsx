/**
 * TeamContactsCRM shows the PT-BR category label (labelFor over contactTypeOptions) in the CRM search
 * (result row, and as a search key) and on the linked-contact chip.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

vi.mock("@/modules/crm-relationships/hooks/useContacts", () => ({
  useContacts: () => ({
    contacts: [
      { id: "c1", name: "Ana Filmes", category: "VIDEOMAKER", phone: "111" },
      { id: "c2", name: "Bruno Silva", category: "LAWYER" },
      { id: "c3", name: "Zeca", category: "NOT_A_CATEGORY" },
    ],
    createContact: vi.fn(),
  }),
}));
vi.mock("@/modules/crm-relationships/modals/ContactFormModal", () => ({ ContactFormModal: () => null }));

import { TeamContactsCRM } from "./TeamContactsCRM";

function openSearch(value: { contactId: string; distributors: [] }[] = []) {
  render(<TeamContactsCRM value={value} onChange={vi.fn()} />);
  fireEvent.click(screen.getByTestId("button-link-crm-contact"));
}
const type = (text: string) => fireEvent.change(screen.getByTestId("input-crm-contact-search"), { target: { value: text } });

describe("TeamContactsCRM category label", () => {
  it("search results show the PT-BR label of each contact's category (and a fallback for unknown)", () => {
    openSearch();
    expect(screen.getByTestId("crm-contact-result-c1")).toHaveTextContent("Videomaker · 111");
    expect(screen.getByTestId("crm-contact-result-c2")).toHaveTextContent("Advogado");
    expect(screen.getByTestId("crm-contact-result-c3")).toHaveTextContent("Não identificado");
    expect(screen.queryByText(/VIDEOMAKER|LAWYER|NOT_A_CATEGORY/)).toBeNull();
  });

  it("search matches by the PT-BR category label, not the raw enum value", () => {
    openSearch();
    type("videomaker"); // name does not contain it: only the label does
    expect(screen.getByTestId("crm-contact-result-c1")).toBeInTheDocument();
    expect(screen.queryByTestId("crm-contact-result-c2")).toBeNull();
    type("advogado");
    expect(screen.getByTestId("crm-contact-result-c2")).toBeInTheDocument();
    expect(screen.queryByTestId("crm-contact-result-c1")).toBeNull();
    type("LAWYER");
    expect(screen.queryByTestId("crm-contact-result-c2")).toBeNull();
  });

  it("a linked contact's chip shows the PT-BR category label", () => {
    render(<TeamContactsCRM value={[{ contactId: "c1", distributors: [] }, { contactId: "c2", distributors: [] }]} onChange={vi.fn()} />);
    expect(within(screen.getByTestId("linked-contact-c1")).getByText("Videomaker")).toBeInTheDocument();
    expect(within(screen.getByTestId("linked-contact-c2")).getByText("Advogado")).toBeInTheDocument();
    expect(screen.queryByText("VIDEOMAKER")).toBeNull();
  });
});
