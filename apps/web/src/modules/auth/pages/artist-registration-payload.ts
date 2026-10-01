/**
 * additionalData of POST /public/artist-registration.
 *
 * The API (leads.service submitPublicArtistRegistration) stores this object
 * verbatim in leads.metadata.additionalData and nothing reads it back, so the
 * keys are canonical English. Leads created before this vocabulary change keep
 * the old Portuguese keys (nomeCivil, chavePix, ...) in their stored metadata.
 */
export interface DistributorEntry {
  id: string;
  email: string;
  customName?: string;
}

export interface TeamContact {
  name: string;
  category: string;
  phone: string;
  email: string;
  distributors: DistributorEntry[];
}

export interface ArtistRegistrationAdditionalDataInput {
  legalName: string;
  gender: string;
  specialties: string[];
  photoUrl: string;
  personalDocumentsUrl: string;
  presskitUrl: string;
  birthDate: string;
  taxId: string;
  rg: string;
  address: string;
  bank: string;
  agency: string;
  account: string;
  pixKey: string;
  accountHolder: string;
  profileType: string;
  teamContacts: TeamContact[];
  generalDistributors: DistributorEntry[];
  internalNotes: string;
}

export function buildArtistRegistrationAdditionalData(
  input: ArtistRegistrationAdditionalDataInput,
): Record<string, unknown> {
  return {
    legalName: input.legalName.trim() || null,
    gender: input.gender || null,
    specialties: input.specialties.length > 0 ? input.specialties : null,
    photoUrl: input.photoUrl || null,
    personalDocumentsUrl: input.personalDocumentsUrl || null,
    presskitUrl: input.presskitUrl || null,
    birthDate: input.birthDate || null,
    taxId: input.taxId || null,
    rg: input.rg || null,
    address: input.address || null,
    bank: input.bank || null,
    agency: input.agency || null,
    account: input.account || null,
    pixKey: input.pixKey || null,
    accountHolder: input.accountHolder || null,
    profileType: input.profileType,
    teamContacts: input.teamContacts.length > 0 ? input.teamContacts : null,
    generalDistributors: input.generalDistributors.length > 0 ? input.generalDistributors : null,
    internalNotes: input.internalNotes || null,
  };
}
