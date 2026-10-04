// @ts-nocheck
// Wiring test for ContactFormModal: a stored (legacy) profile stays selectable under its canonical value,
// the CEP lookup fills the address, and the CPF/CNPJ/phone/CEP inputs store the masked value.
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

vi.mock("@/shared/ui/select", () => ({
  Select: ({ value, children }: any) => <div data-select-value={value ?? ""}>{children}</div>,
  SelectTrigger: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ value, children }: any) => <div role="option" data-value={value}>{children}</div>,
}));
vi.mock("@/shared/ui/date-picker-field", () => ({ DatePickerField: () => null }));

import { ContactFormModal } from "./ContactFormModal";

const K = (...p: string[]) => p.join("");

function renderForm(initialValue: any) {
  return render(<ContactFormModal open onOpenChange={() => {}} mode="edit" initialValue={initialValue} />);
}

const profileOptions = () =>
  within(screen.getByTestId("select-profile").closest("[data-select-value]") as HTMLElement)
    .queryAllByRole("option")
    .map((o) => [o.getAttribute("data-value"), o.textContent]);

afterEach(() => vi.unstubAllGlobals());

describe("ContactFormModal legacy wiring: profile options", () => {
  it("keeps a stored legacy profile of another category selectable under its canonical value", () => {
    const { unmount } = renderForm({ personType: "individual", category: "CORPORATE_CLIENT", profile: K("fotogr", "afo") });
    const opts = profileOptions();
    expect(opts).toContainEqual(["photographer", "Fotógrafo"]);
    // the category's own profiles are still offered
    expect(opts).toContainEqual(["artist_or_band", "Artista/Banda"]);
    expect(opts.map((o) => o[0])).not.toContain(K("fotogr", "afo"));
    unmount();
  });

  it("a legacy profile that belongs to the category is not duplicated nor offered under the legacy slug", () => {
    const { unmount } = renderForm({ personType: "individual", category: "CORPORATE_CLIENT", profile: K("artista", "_banda") });
    const values = profileOptions().map((o) => o[0]);
    expect(values.filter((v) => v === "artist_or_band")).toHaveLength(1);
    expect(values).not.toContain(K("artista", "_banda"));
    unmount();
  });

  it("negative: an unknown stored profile is kept as-is with the generic label, and an empty category offers nothing", () => {
    const first = renderForm({ personType: "individual", category: "CORPORATE_CLIENT", profile: "perfil_desconhecido" });
    expect(profileOptions()).toContainEqual(["perfil_desconhecido", "Perfil não cadastrado"]);
    first.unmount();
    const second = renderForm({ personType: "individual", category: "", profile: "" });
    expect(profileOptions()).toEqual([]);
    second.unmount();
  });

  it("offers the catalog of the selected person type and category only", () => {
    const { unmount } = renderForm({ personType: "individual", category: "SUPPLIER", profile: "other" });
    expect(profileOptions()).toEqual([["other", "Outros"]]);
    unmount();
  });
});

describe("ContactFormModal: CEP lookup", () => {
  const lookup = { cep: "01310-100", logradouro: "Avenida Paulista", complemento: "Conjunto 1", bairro: "Bela Vista", localidade: "São Paulo", uf: "SP" };

  function stubFetch(body: any) {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => body });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  async function typeZipAndBlur() {
    const zipInput = screen.getByTestId("input-postal-code");
    fireEvent.change(zipInput, { target: { value: "01310100" } });
    expect(zipInput).toHaveValue("01310-100");
    fireEvent.blur(zipInput);
  }

  it("blur on a complete CEP fills the address fields from the lookup", async () => {
    const fetchMock = stubFetch(lookup);
    const { unmount } = renderForm({ personType: "individual", category: "CORPORATE_CLIENT", profile: "other" });
    await typeZipAndBlur();
    await waitFor(() => expect(screen.getByTestId("input-street")).toHaveValue("Avenida Paulista"));
    expect(fetchMock).toHaveBeenCalledWith("https://viacep.com.br/ws/01310100/json/", expect.anything());
    expect(screen.getByTestId("input-neighborhood")).toHaveValue("Bela Vista");
    expect(screen.getByTestId("input-city")).toHaveValue("São Paulo");
    expect(screen.getByTestId("select-state").closest("[data-select-value]")).toHaveAttribute("data-select-value", "SP");
    expect(screen.getByTestId("input-complement")).toHaveValue("Conjunto 1");
    unmount();
  });

  it("negative: fields already typed are kept when the lookup does not return them", async () => {
    stubFetch({ ...lookup, logradouro: "", complemento: "Conjunto 1" });
    const { unmount } = renderForm({ personType: "individual", category: "CORPORATE_CLIENT", profile: "other", street: "Rua Minha", addressComplement: "Apto 9" });
    await typeZipAndBlur();
    await waitFor(() => expect(screen.getByTestId("input-city")).toHaveValue("São Paulo"));
    expect(screen.getByTestId("input-street")).toHaveValue("Rua Minha");
    expect(screen.getByTestId("input-complement")).toHaveValue("Apto 9");
    unmount();
  });

  it("negative: a not-found CEP leaves the address untouched", async () => {
    const fetchMock = stubFetch({ erro: true });
    const { unmount } = renderForm({ personType: "individual", category: "CORPORATE_CLIENT", profile: "other", city: "Cidade Atual" });
    await typeZipAndBlur();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText("Buscando endereço...")).not.toBeInTheDocument());
    expect(screen.getByTestId("input-city")).toHaveValue("Cidade Atual");
    expect(screen.getByTestId("input-street")).toHaveValue("");
    unmount();
  });

  it("negative: an incomplete CEP does not call the lookup", () => {
    const fetchMock = stubFetch(lookup);
    const { unmount } = renderForm({ personType: "individual", category: "CORPORATE_CLIENT", profile: "other" });
    const zipInput = screen.getByTestId("input-postal-code");
    fireEvent.change(zipInput, { target: { value: "0131" } });
    fireEvent.blur(zipInput);
    expect(fetchMock).not.toHaveBeenCalled();
    unmount();
  });
});

describe("ContactFormModal: masked inputs", () => {
  const type = (id: string, value: string) => fireEvent.change(screen.getByTestId(id), { target: { value } });

  it("individual: CPF, phone and CEP show the masked value", () => {
    const { unmount } = renderForm({ personType: "individual", category: "CORPORATE_CLIENT", profile: "other" });
    type("input-individual-cpf", "12345678901");
    expect(screen.getByTestId("input-individual-cpf")).toHaveValue("123.456.789-01");
    type("input-phone", "11987654321");
    expect(screen.getByTestId("input-phone")).toHaveValue("(11) 98765-4321");
    type("input-postal-code", "01310100");
    expect(screen.getByTestId("input-postal-code")).toHaveValue("01310-100");
    unmount();
  });

  it("company: CNPJ, phone and responsible phone show the masked value", () => {
    const { unmount } = renderForm({ personType: "company", category: "CORPORATE_CLIENT", profile: "other" });
    type("input-pj-cnpj", "12345678000190");
    expect(screen.getByTestId("input-pj-cnpj")).toHaveValue("12.345.678/0001-90");
    type("input-phone", "1133334444");
    expect(screen.getByTestId("input-phone")).toHaveValue("(11) 3333-4444");
    type("input-resp-phone", "21987654321");
    expect(screen.getByTestId("input-resp-phone")).toHaveValue("(21) 98765-4321");
    unmount();
  });

  it("negative: non-digit input is stripped, never stored raw", () => {
    const { unmount } = renderForm({ personType: "individual", category: "CORPORATE_CLIENT", profile: "other" });
    type("input-individual-cpf", "abc");
    expect(screen.getByTestId("input-individual-cpf")).toHaveValue("");
    type("input-phone", "(11) abc 9");
    expect(screen.getByTestId("input-phone")).toHaveValue("(11) 9");
    unmount();
  });
});
