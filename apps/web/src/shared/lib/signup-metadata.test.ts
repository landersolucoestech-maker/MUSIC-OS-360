import { describe, expect, it } from "vitest";
import { buildProvisionWorkspacePayload, buildSignupMetadata, type SignupFormValues } from "./signup-metadata";

const form: SignupFormValues = {
  companyName: "Acme Music", tradeName: "Acme", workspaceName: "Acme HQ", slug: "acme-hq", segment: "label",
  corporateEmail: "ops@acme.example", phone: "+5511999999999", address: "Rua A, 1", city: "São Paulo", state: "SP",
  activationPlanId: "plan-1", acceptTerms: true, acceptLgpd: true,
};

describe("signup consent contract: register form -> Supabase metadata -> provision-workspace body", () => {
  it("persists the LGPD consent under the snake_case metadata key", () => {
    const meta = buildSignupMetadata(form);
    expect(meta["accepted_lgpd"]).toBe(true);
    expect(meta["accepted_terms"]).toBe(true);
    expect(Object.keys(meta)).not.toContain("acceptLgpd");
  });
  it("the consent survives the round trip to the camelCase API body", () => {
    const body = buildProvisionWorkspacePayload(buildSignupMetadata(form));
    expect(body["acceptedLgpd"]).toBe(true);
    expect(body["acceptedTerms"]).toBe(true);
    expect(body["workspaceSlug"]).toBe("acme-hq");
    expect(body["organizationName"]).toBe("Acme Music");
  });
  it("a refused consent stays false end to end (never defaulted to true)", () => {
    const body = buildProvisionWorkspacePayload(buildSignupMetadata({ ...form, acceptLgpd: false, acceptTerms: false }));
    expect(body["acceptedLgpd"]).toBe(false);
    expect(body["acceptedTerms"]).toBe(false);
  });
  it("an absent consent key is forwarded as undefined, not invented", () => {
    expect(buildProvisionWorkspacePayload({ workspace_slug: "x" })["acceptedLgpd"]).toBeUndefined();
  });
});
