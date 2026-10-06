/**
 * A release is only marked Distributed with a registered confirmation: the distributor confirmed it, or the operation
 * was concluded manually and that conclusion is registered with its evidence. The server is authoritative (it
 * validates, and stamps who recorded it and when); this module only shapes what the person typed.
 */
export const DISTRIBUTION_CONFIRMATION_KEY = "distribution_confirmation";

export const DISTRIBUTION_CONFIRMATION_SOURCE_OPTIONS = [
  { value: "external_confirmation", label: "Confirmação da distribuidora" },
  { value: "manual_operational", label: "Conclusão operacional manual" },
] as const;

export interface DistributionConfirmationDraft {
  source: string;
  reference: string;
  confirmedAt: string;
  note: string;
}

export const EMPTY_DISTRIBUTION_CONFIRMATION: DistributionConfirmationDraft = {
  source: "",
  reference: "",
  confirmedAt: "",
  note: "",
};

export function isDistributionTarget(toStatus: string): boolean {
  return toStatus === "distributed";
}

/** Names the fields still missing, in Portuguese, for the form; empty when the draft can be sent. */
export function distributionConfirmationProblems(draft: DistributionConfirmationDraft): string[] {
  const problems: string[] = [];
  if (!DISTRIBUTION_CONFIRMATION_SOURCE_OPTIONS.some((o) => o.value === draft.source)) problems.push("origem da confirmação");
  if (draft.reference.trim().length < 3) problems.push("referência (protocolo, ticket ou link)");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.confirmedAt)) problems.push("data da confirmação");
  return problems;
}

/** The metadata patch sent with the status change; the server stamps who confirmed and when it was recorded. */
export function buildDistributionConfirmationMetadata(draft: DistributionConfirmationDraft): Record<string, unknown> {
  const note = draft.note.trim();
  return {
    [DISTRIBUTION_CONFIRMATION_KEY]: {
      source: draft.source,
      reference: draft.reference.trim(),
      confirmed_at: draft.confirmedAt,
      ...(note ? { note } : {}),
    },
  };
}
