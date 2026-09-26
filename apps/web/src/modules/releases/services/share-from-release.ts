import type { Release } from "@/modules/releases/types";

/**
 * Seam desacoplado entre Lançamentos e Gestão de Shares.
 *
 * Lançamentos NÃO importa o módulo de Shares diretamente: oferece iniciar o fluxo
 * de shares via navegação por query param (mesmo padrão de `?edit`/`?view`), que a
 * página de Shares interpreta. Assim não há acoplamento direto entre os módulos.
 */

/** Query param lido por Gestão de Shares para abrir o form já vinculado a um release. */
export const SHARE_FOR_RELEASE_PARAM = "shareForRelease";

/** Rota da Gestão de Shares com o release pré-selecionado. */
export function shareFlowFromReleaseUrl(releaseId: string): string {
  return `/gestao-shares?${SHARE_FOR_RELEASE_PARAM}=${encodeURIComponent(releaseId)}`;
}

/**
 * Há participantes/créditos suficientes para sugerir o fluxo de shares?
 * Conservador: exige artista principal definido. Evita abrir o fluxo sem dados.
 */
export function hasEnoughParticipantsForShares(release: Pick<Release, "artist_id"> | null | undefined): boolean {
  return Boolean(release?.artist_id);
}
