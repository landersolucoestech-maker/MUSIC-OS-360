/**
 * Global zod error map → PT-BR end-user copy.
 *
 * Form validation messages are rendered next to the field (the field label is
 * already visible), so the copy never names the field or echoes the technical
 * issue. A message written on the schema itself (`{ message: "..." }`) always
 * takes precedence over this map. Without it, zod's English defaults
 * ("Required", "Expected string, received number") reached the UI.
 */
import { z, ZodIssueCode, type ZodErrorMap } from "zod";

export const GENERIC_INVALID_VALUE = "Valor inválido.";
export const REQUIRED_FIELD = "Campo obrigatório.";

function sizeMessage(issue: z.ZodTooSmallIssue | z.ZodTooBigIssue, kind: "min" | "max"): string {
  const limit = Number(kind === "min" ? (issue as z.ZodTooSmallIssue).minimum : (issue as z.ZodTooBigIssue).maximum);
  const inclusive = issue.inclusive;
  switch (issue.type) {
    case "string":
      if (kind === "min") return limit <= 1 ? REQUIRED_FIELD : `Informe pelo menos ${limit} caracteres.`;
      return `Informe no máximo ${limit} caracteres.`;
    case "number":
    case "bigint":
      if (kind === "min") return inclusive ? `O valor deve ser maior ou igual a ${limit}.` : `O valor deve ser maior que ${limit}.`;
      return inclusive ? `O valor deve ser menor ou igual a ${limit}.` : `O valor deve ser menor que ${limit}.`;
    case "array":
    case "set":
      if (kind === "min") return limit <= 1 ? "Selecione pelo menos um item." : `Selecione pelo menos ${limit} itens.`;
      return `Selecione no máximo ${limit} itens.`;
    case "date":
      return kind === "min" ? "A data é anterior à permitida." : "A data é posterior à permitida.";
    default:
      return GENERIC_INVALID_VALUE;
  }
}

export const zodErrorMapPtBr: ZodErrorMap = (issue) => {
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === "undefined" || issue.received === "null") return { message: REQUIRED_FIELD };
      return { message: GENERIC_INVALID_VALUE };
    case ZodIssueCode.too_small:
      return { message: sizeMessage(issue, "min") };
    case ZodIssueCode.too_big:
      return { message: sizeMessage(issue, "max") };
    case ZodIssueCode.invalid_string:
      if (issue.validation === "email") return { message: "Informe um e-mail válido." };
      if (issue.validation === "url") return { message: "Informe uma URL válida." };
      if (issue.validation === "datetime" || issue.validation === "date") return { message: "Informe uma data válida." };
      return { message: "Formato inválido." };
    case ZodIssueCode.invalid_enum_value:
    case ZodIssueCode.invalid_literal:
    case ZodIssueCode.invalid_union:
    case ZodIssueCode.invalid_union_discriminator:
      return { message: "Selecione uma opção válida." };
    case ZodIssueCode.invalid_date:
      return { message: "Informe uma data válida." };
    default:
      // custom issues without their own message, not_multiple_of, etc. (zod only
      // consults the map when the issue carries no schema-defined message).
      return { message: GENERIC_INVALID_VALUE };
  }
};

/** Installs the PT-BR map as zod's global error map (app bootstrap and test setup). */
export function installZodErrorMapPtBr(): void {
  z.setErrorMap(zodErrorMapPtBr);
}
