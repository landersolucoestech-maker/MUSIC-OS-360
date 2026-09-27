/**
 * HR vocabularies: canonical technical values (persisted, English) and their
 * PT-BR labels. The UI renders labels only — never the raw value.
 */
import { LEAVE_REQUEST_STATUS_LABELS_PT_BR, LeaveRequestStatus } from "@music-os-360/types";

export interface HrOption<T extends string = string> {
  value: T;
  label: string;
}

/** clt/pj are Brazilian legal employment regimes (legal-domain terms). */
export const CONTRACT_TYPE_OPTIONS: readonly HrOption[] = [
  { value: "clt", label: "CLT" },
  { value: "pj", label: "PJ" },
  { value: "freelancer", label: "Freelancer" },
  { value: "internship", label: "Estágio" },
  { value: "temporary", label: "Temporário" },
];

export const LEAVE_TYPE_OPTIONS: readonly HrOption[] = [
  { value: "vacation", label: "Férias" },
  { value: "sick_leave", label: "Licença médica" },
  { value: "maternity_leave", label: "Licença maternidade" },
  { value: "paternity_leave", label: "Licença paternidade" },
  { value: "excused_absence", label: "Falta justificada" },
  { value: "unexcused_absence", label: "Falta injustificada" },
  { value: "day_off", label: "Day off" },
  { value: "compensatory_time_off", label: "Folga compensatória" },
];

export const LEAVE_STATUS_OPTIONS: readonly HrOption<LeaveRequestStatus>[] = Object.values(LeaveRequestStatus).map((value) => ({
  value,
  label: LEAVE_REQUEST_STATUS_LABELS_PT_BR[value],
}));

const labelOf = (options: readonly HrOption[], value: string | null | undefined, fallback: string) =>
  options.find((option) => option.value === value)?.label ?? (value ? fallback : "—");

export const contractTypeLabel = (value: string | null | undefined) => labelOf(CONTRACT_TYPE_OPTIONS, value, "Outro tipo de contrato");
export const leaveTypeLabel = (value: string | null | undefined) => labelOf(LEAVE_TYPE_OPTIONS, value, "Outro tipo de ausência");
export const leaveStatusLabel = (value: string | null | undefined) => labelOf(LEAVE_STATUS_OPTIONS, value, "Status desconhecido");
