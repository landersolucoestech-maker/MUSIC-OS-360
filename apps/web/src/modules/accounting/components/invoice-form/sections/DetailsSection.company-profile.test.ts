import { describe, expect, it } from "vitest";
import { formatCompanyAddress, formatCompanyBank } from "./DetailsSection";

// The provider card receives the English flat shape of useCompanySettings; it used to read the removed Portuguese
// names (and a street "number" taken from an unrelated invoice field), so the address and bank lines were always empty.
describe("invoice provider card: company profile summary", () => {
  it("joins street, number, city, state and a formatted zip code", () => {
    expect(formatCompanyAddress({ street: "Rua A", number: "10", city: "Springfield", state: "SP", zipCode: "01001000" }))
      .toBe("Rua A, 10, Springfield, SP, 01001-000");
  });

  it("skips what is missing and falls back to a dash", () => {
    expect(formatCompanyAddress({ city: "Rio", state: "RJ" })).toBe("Rio, RJ");
    expect(formatCompanyAddress({})).toBe("—");
  });

  it("formats the bank with agency and account, a dash without a bank", () => {
    expect(formatCompanyBank({ bankName: "Banco X", agency: "0001", account: "123-4" })).toBe("Banco X • Ag 0001 • CC 123-4");
    expect(formatCompanyBank({ bankName: "Banco X" })).toBe("Banco X • Ag — • CC —");
    expect(formatCompanyBank({})).toBe("—");
  });
});
