import { toast } from "sonner";
import { ConflictError } from "@/shared/lib/errors";

/**
 * Task L — reads the original `updated_at` of a loaded entity, to
 * resend it as `expectedUpdatedAt` in the update/patch (backend concurrency
 * protection — see apps/api/src/common/persistence/optimistic-update.util.ts).
 *
 * Deliberately NOT a hook with state/ref: edit modals receive the
 * entity as a prop when they open and that prop is not updated
 * while the form is open — reading `updated_at` on submit already reflects the
 * ORIGINAL loaded value, never "now". If a form starts to
 * refetch the entity in the background while editing, it must
 * freeze the value read on the first render (initial useRef/useState)
 * before using this helper — that is the caller's responsibility.
 */
export function getExpectedUpdatedAt(
  entity: { updated_at?: unknown; updatedAt?: unknown } | null | undefined,
): string | undefined {
  const value = entity?.updated_at ?? entity?.updatedAt;
  return typeof value === "string" ? value : undefined;
}

/**
 * True when the error is a backend 409 (stale version — another session
 * saved first). `api-client.ts` maps every HTTP 409 to `ConflictError`
 * (never `IntegrationError` — that is only the fallback for unmapped statuses),
 * so that is the class that must be checked here.
 */
export function isConcurrencyConflict(err: unknown): boolean {
  return err instanceof ConflictError;
}

/**
 * Handles a concurrency 409 consistently in any form:
 * warns that the record changed (never fakes success, never overwrites), and
 * returns `true` so the caller does NOT close the modal/clear the form. If the error
 * is not a 409, rethrows it for the caller's catch to handle as a generic error.
 *
 * Typical usage:
 *   } catch (err) {
 *     if (handleConcurrencyConflict(err, "contrato")) return;
 *     toast.error("Erro ao salvar contrato. Tente novamente.");
 *   }
 */
export function handleConcurrencyConflict(err: unknown, entityLabel: string): boolean {
  if (!isConcurrencyConflict(err)) return false;
  toast.error(
    `Este ${entityLabel} foi alterado por outra pessoa desde que você o carregou. ` +
    `Feche e reabra o formulário para ver a versão mais recente antes de salvar novamente.`,
  );
  return true;
}
