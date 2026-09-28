import type { ContractWithRelations } from "@/modules/contracts/types/contracts.types";

export const ARTIST_NOT_FOUND_LABEL = "Artista não encontrado";
export const CLIENT_NOT_FOUND_LABEL = "Cliente não encontrado";
export const NO_PARTY_LABEL = "—";

type ContractParty = Pick<ContractWithRelations, "artist" | "client" | "artist_id" | "client_id">;

/**
 * "Artista / Cliente" label of a contract, from the API's `artist` / `client`
 * embeds. A linked id whose embed is missing (deleted or unreadable party) shows
 * the PT-BR "não encontrado" label — never a blank "—" nor the raw id. "—" is
 * only for a contract with no party at all.
 */
export function contractPartyLabel(contract: ContractParty): string {
  const artistName = contract.artist?.stage_name?.trim();
  if (artistName) return artistName;
  const clientName = contract.client?.name?.trim();
  if (clientName) return clientName;
  if (contract.artist_id) return ARTIST_NOT_FOUND_LABEL;
  if (contract.client_id) return CLIENT_NOT_FOUND_LABEL;
  return NO_PARTY_LABEL;
}
