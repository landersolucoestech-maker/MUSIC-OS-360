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
  it("KNOWN GAP (find-8fb21cf0, product decision pending): the chosen plan id is stored as activation_plan_id but is not forwarded, because the API takes a plan code (requestedPlan, max 30 chars) and the form holds a plan id", () => {
    const metadata = buildSignupMetadata({ ...form, activationPlanId: "3f1c2d1e-8a53-4c53-9a0f-3f0b8a0d9c11" });
    expect(metadata["activation_plan_id"]).toBe("3f1c2d1e-8a53-4c53-9a0f-3f0b8a0d9c11");
    expect(buildProvisionWorkspacePayload(metadata)["requestedPlan"]).toBeUndefined();
  });
});
