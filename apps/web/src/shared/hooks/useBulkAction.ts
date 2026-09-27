import { toast } from "sonner";

export interface BulkActionResult {
  succeeded: string[];
  failed: Array<{ id: string; error: string }>;
}

/**
 * Task K — replaces the `selectedIds.forEach(id => mutation.mutate(id))` pattern
 * followed by an IMMEDIATE success toast (before any request
 * finished) — found in ~27 pages with bulk selection. That pattern
 * shows "success" even when part of the operations fail, without counting or
 * identifying what failed.
 *
 * `runBulkAction` waits for every operation to settle (Promise.allSettled —
 * one failure does not cancel the others) and returns the exact success/failure count
 * so the caller decides the correct message via `reportBulkResult`.
 */
export async function runBulkAction<T>(
  ids: string[],
  action: (id: string) => Promise<T>,
): Promise<BulkActionResult> {
  const results = await Promise.allSettled(ids.map((id) => action(id)));
  const succeeded: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      succeeded.push(ids[i]);
    } else {
      const reason = result.reason as unknown;
      failed.push({ id: ids[i], error: reason instanceof Error ? reason.message : String(reason) });
    }
  });
  return { succeeded, failed };
}

/**
 * Honest message about the real result: never "success" when there was a
 * partial failure, never silence about how many items failed.
 */
export function reportBulkResult(result: BulkActionResult, actionLabel: string, itemLabel: string): void {
  const { succeeded, failed } = result;
  if (failed.length === 0) {
    toast.success(`${succeeded.length} ${itemLabel}${succeeded.length === 1 ? "" : "(s)"} ${actionLabel} com sucesso`);
    return;
  }
  if (succeeded.length === 0) {
    toast.error(`Nenhum ${itemLabel} foi ${actionLabel} (${failed.length} falha${failed.length === 1 ? "" : "s"}). Tente novamente.`);
    return;
  }
  toast.warning(
    `${succeeded.length} ${itemLabel}(s) ${actionLabel} com sucesso, ${failed.length} falharam. Verifique e tente novamente para os que falharam.`,
  );
}
