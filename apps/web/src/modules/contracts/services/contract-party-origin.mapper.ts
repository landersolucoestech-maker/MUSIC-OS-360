import { CONTRACT_TYPES } from "../constants/contract-types";
import type { ContractPartyOrigin } from "../domain/contract-party-origin";

const ARTIST_TYPES: string[] = [
  ...CONTRACT_TYPES.ARTISTIC,
  ...CONTRACT_TYPES.SHOWS,
  ...CONTRACT_TYPES.BRANDS_ADVERTISING,
  "Parceria entre Artistas",
  "Colaboração Musical (Feat com estrutura contratual)",
];

export const getContractPartyOrigin = (
  contractType: string
): ContractPartyOrigin => {
  if (ARTIST_TYPES.includes(contractType)) {
    return "ARTIST";
  }

  const allCrmTypes: string[] = Object.values(CONTRACT_TYPES)
    .flat()
    .filter((type) => !ARTIST_TYPES.includes(type));

  if (allCrmTypes.includes(contractType)) {
    return "CRM";
  }

  return "NONE";
};

