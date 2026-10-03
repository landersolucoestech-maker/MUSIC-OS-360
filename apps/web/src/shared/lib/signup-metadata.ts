/**
 * Signup contract between the register form, the Supabase user metadata and the
 * `PATCH /auth/provision-workspace` body. The metadata keys are snake_case (persisted by Supabase),
 * the API body keys are camelCase (`ProvisionWorkspaceDto`). `LGPD` is the Brazilian data-protection
 * statute acronym (a permanent legal-domain term, not a legacy alias), so the consent keys keep it.
 */
export interface SignupFormValues {
  companyName: string;
  tradeName?: string;
  workspaceName: string;
  slug: string;
  segment?: string;
  corporateEmail?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  activationPlanId?: string;
  acceptTerms: boolean;
  acceptLgpd: boolean;
}

export function buildSignupMetadata(all: SignupFormValues): Record<string, unknown> {
  return {
    org_name: all.companyName,
    trade_name: all.tradeName,
    workspace_name: all.workspaceName,
    workspace_slug: all.slug,
    segment: all.segment,
    corporate_email: all.corporateEmail,
    phone: all.phone,
    address: all.address,
    city: all.city,
    state: all.state,
    activation_plan_id: all.activationPlanId,
    accepted_terms: all.acceptTerms,
    accepted_lgpd: all.acceptLgpd,
  };
}

export function buildProvisionWorkspacePayload(metadata: Record<string, unknown>): Record<string, unknown> {
  return {
    organizationName: metadata["org_name"],
    workspaceName: metadata["workspace_name"],
    workspaceSlug: metadata["workspace_slug"],
    segment: metadata["segment"],
    tradeName: metadata["trade_name"],
    corporateEmail: metadata["corporate_email"],
    phone: metadata["phone"],
    address: metadata["address"],
    city: metadata["city"],
    state: metadata["state"],
    requestedPlan: metadata["requested_plan"],
    acceptedTerms: metadata["accepted_terms"],
    acceptedLgpd: metadata["accepted_lgpd"],
  };
}
