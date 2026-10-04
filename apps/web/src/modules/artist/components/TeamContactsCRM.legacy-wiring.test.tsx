/**
 * Compat wiring: TeamContactsCRM routes every distributor id through isOtherDistributorId
 * (canonical 'other', legacy 'outros'), so only the "Outros" option carries a custom name and
 * every regular distributor carries the e-mail share input.
 */
import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/modules/crm-relationships/hooks/useContacts", () => ({
  useContacts: () => ({
    contacts: [
      { id: "c1", name: "Gravadora X", category: "LABEL_RECORD" },
      { id: "c2", name: "Produtor Y", category: "PRODUCER" },
    ],
    createContact: vi.fn(),
  }),
}));
vi.mock("@/modules/crm-relationships/modals/ContactFormModal", () => ({ ContactFormModal: () => null }));

import { TeamContactsCRM, type LinkedContactForm } from "./TeamContactsCRM";

let lastValue: LinkedContactForm[] = [];
const onChangeSpy = vi.fn();

function Harness({ initial }: { initial: LinkedContactForm[] }) {
  const [value, setValue] = useState(initial);
  lastValue = value;
  return (
    <TeamContactsCRM
      value={value}
      onChange={(next) => {
        onChangeSpy(next);
        setValue(next);
      }}
    />
  );
}

const customName = (id = "c1") => screen.queryByTestId(`input-dist-name-custom-${id}`);
const shareEmail = (dist: string, id = "c1") => screen.queryByTestId(`input-dist-email-share-${id}-${dist}`);

describe("TeamContactsCRM distributor 'other' handling", () => {
  it("a linked 'other' distributor shows the custom-name input and no e-mail until a name is typed", () => {
    render(<Harness initial={[{ contactId: "c1", distributors: [{ id: "other", email: "", customName: "" }] }]} />);
    expect(customName()).not.toBeNull();
    expect(shareEmail("other")).toBeNull();
    fireEvent.change(customName()!, { target: { value: "Minha Distro" } });
    expect(shareEmail("other")).not.toBeNull();
  });

  it("negative: a regular distributor shows the e-mail input and never the custom-name input", () => {
    render(<Harness initial={[{ contactId: "c1", distributors: [{ id: "onerpm", email: "a@b.com" }] }]} />);
    expect(shareEmail("onerpm")).not.toBeNull();
    expect((shareEmail("onerpm") as HTMLInputElement).value).toBe("a@b.com");
    expect(customName()).toBeNull();
  });

  it("negative: with both a regular and an 'other' distributor, only 'other' gets the custom-name input", () => {
    render(
      <Harness
        initial={[{ contactId: "c1", distributors: [{ id: "onerpm", email: "" }, { id: "other", email: "", customName: "Z" }] }]}
      />,
    );
    expect(screen.getAllByTestId("input-dist-name-custom-c1")).toHaveLength(1);
    expect(shareEmail("onerpm")).not.toBeNull();
    expect(shareEmail("other")).not.toBeNull(); // name typed -> e-mail of 'other' appears
  });

  it("checking 'other' starts with an empty custom name, checking a regular distributor has none", () => {
    onChangeSpy.mockClear();
    render(<Harness initial={[{ contactId: "c1", distributors: [] }]} />);

    fireEvent.click(screen.getByTestId("checkbox-dist-c1-other"));
    expect(lastValue[0].distributors).toEqual([{ id: "other", email: "", customName: "" }]);
    expect(customName()).not.toBeNull();

    fireEvent.click(screen.getByTestId("checkbox-dist-c1-onerpm"));
    const onerpm = lastValue[0].distributors.find((d) => d.id === "onerpm")!;
    expect(onerpm).toEqual({ id: "onerpm", email: "", customName: undefined });
    expect("customName" in onerpm && onerpm.customName !== undefined).toBe(false);
    expect(shareEmail("onerpm")).not.toBeNull();
    expect(screen.getAllByTestId("input-dist-name-custom-c1")).toHaveLength(1);
  });

  it("negative: a contact whose category has no distributors section renders none", () => {
    render(<Harness initial={[{ contactId: "c2", distributors: [] }]} />);
    expect(screen.queryByTestId("checkbox-dist-c2-other")).toBeNull();
  });
});
