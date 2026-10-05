// Behavior of the real ContactsTable: the category and status cells show the PT-BR label of the
// category/status (labelFor over the option catalogs), never the raw enum value.
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ContactsTable } from "./ContactsTable";
import { UNKNOWN_OPTION_LABEL } from "../constants";
import type { Contact } from "../types";

const contact = (over: Partial<Contact>): Contact =>
  ({ id: "c", name: "Contato", personType: "individual", category: "VIDEOMAKER", status: "active", ...over }) as Contact;

const rowCells = (id: string) => within(screen.getByTestId(`contact-row-${id}`)).getAllByRole("cell");
// cells: 0 checkbox, 1 name, 2 category, 3 contact, 4 city, 5 responsible, 6 status, 7 actions
const categoryCell = (id: string) => rowCells(id)[2];
const status = (id: string) => rowCells(id)[6];

describe("ContactsTable category/status labels", () => {
  it("shows the PT-BR label of an individual category and of each status", () => {
    render(
      <ContactsTable
        contacts={[
          contact({ id: "a", name: "Ana", category: "VIDEOMAKER", status: "active" }),
          contact({ id: "b", name: "Bia", category: "LAWYER", status: "inactive" }),
          contact({ id: "c", name: "Caio", category: "ART_PRODUCER", status: "prospect" }),
        ]}
      />,
    );
    expect(categoryCell("a")).toHaveTextContent(/^Videomaker$/);
    expect(status("a")).toHaveTextContent(/^Ativo$/);
    expect(categoryCell("b")).toHaveTextContent(/^Advogado$/);
    expect(status("b")).toHaveTextContent(/^Inativo$/);
    expect(categoryCell("c")).toHaveTextContent(/^Produtor Artístico$/);
    expect(status("c")).toHaveTextContent(/^Em prospecção$/);
    expect(screen.queryByText("VIDEOMAKER")).toBeNull();
    expect(screen.queryByText("active")).toBeNull();
  });

  it("shows the PT-BR label of a company category", () => {
    render(
      <ContactsTable
        contacts={[contact({ id: "d", name: "Agência X", personType: "company", category: "BOOKING_AGENCY" })]}
      />,
    );
    expect(categoryCell("d")).toHaveTextContent(/^Agência de Booking$/);
  });

  it("negative: unknown category/status fall back to the unknown label and empty ones to a dash, never the raw value", () => {
    render(
      <ContactsTable
        contacts={[
          contact({ id: "e", name: "Eva", category: "NOT_A_CATEGORY" as never, status: "weird" as never }),
          contact({ id: "f", name: "Fia", category: undefined, status: undefined as never }),
        ]}
      />,
    );
    expect(categoryCell("e")).toHaveTextContent(new RegExp(`^${UNKNOWN_OPTION_LABEL}$`));
    expect(status("e")).toHaveTextContent(new RegExp(`^${UNKNOWN_OPTION_LABEL}$`));
    expect(categoryCell("f")).toHaveTextContent(/^—$/);
    expect(status("f")).toHaveTextContent(/^—$/);
    expect(screen.queryByText("NOT_A_CATEGORY")).toBeNull();
    expect(screen.queryByText("weird")).toBeNull();
  });
});
