import type { ArtistRelationshipType } from "@music-os-360/types";
import type {
  ArtistStatusValue,
  ArtistProfileType,
  ArtistSpecialty,
  ArtistRelationshipContactType,
  ArtistGender,
} from "@/shared/types/enums";

export type { ArtistProfileType, ArtistSpecialty, ArtistRelationshipContactType, ArtistGender };
export type ArtistStatus = ArtistStatusValue;

export interface DistributorEntry {
  id: string;
  email: string;
  customName?: string;
}

export interface ArtistResponsible {
  name: string;
  phone: string;
  email: string;
}

/**
 * Link between the artist and a CRM contact (CRM > Contatos).
 * The artist stores ONLY the reference (`contactId`) — name/category/phone/email
 * are resolved dynamically from the CRM at display time, avoiding data
 * duplication. `distributors` belong to the artist↔contact relation (not the
 * contact) and apply only when the contact's CRM category is Empresário /
 * Gravadora / Editora.
 */
export interface ArtistLinkedContact {
  contactId: string;
  distributors?: DistributorEntry[];
}

export interface ArtistRelationship {
  type: ArtistRelationshipContactType;
  name: string;
  phone: string;
  email: string;
  office?: string;
  crc?: string;
  responsibles?: ArtistResponsible[];
  distributors?: DistributorEntry[];
}

/**
 * @deprecated Embedded team contacts (copies). Kept only for backward
 * compatibility with old persisted data (still read/written by
 * `ArtistFormModal`/`artist.mapper.ts` as a pass-through, so existing data is
 * not discarded). NOT used by the public self-signup flow
 * (`ArtistSignupPublic`) — that flow uses its own disconnected local shape
 * (`ContatoEquipe`), sent as part of a Lead payload and never converted to this
 * type. New panel creates/edits use `linkedContacts`.
 */
export interface ArtistTeamContact {
  name: string;
  category: string;
  phone: string;
  email: string;
  distributors: DistributorEntry[];
}

/** Item of the `documents` column. */
export interface ArtistDocument {
  name: string;
  url: string;
}

/**
 * Internal artist model (English, camelCase). Field names mirror the canonical
 * CZ-042 columns (`stage_name` → `stageName`, `agent_name` → `agentName`, …);
 * the only translation point to/from the wire is `services/artist.mapper.ts`.
 */
export interface Artist {
  id: string;
  user_id?: string;
  stageName: string;
  /** "Nome completo" (column full_name). */
  fullName?: string | null;
  status?: ArtistStatus | string | null;
  registrationStatus?: string | null;
  /** Contract-derived classification computed by GET /artists (exclusive/partner/independent). */
  relationship?: ArtistRelationshipType | null;
  musicGenre?: string | null;
  email?: string | null;
  phone?: string | null;
  /** CPF/CNPJ (wire key cpf_cnpj — legal-domain exception). */
  taxId?: string | null;
  photoUrl?: string | null;
  notes?: string | null;
  contractId?: string | null;
  artistSlug?: string | null;
  musicTags?: string[] | null;
  careerStage?: string | null;
  relationships?: ArtistRelationship[] | null;
  spotifyUrl?: string | null;
  spotifyListeners?: number | null;
  youtubeUrl?: string | null;
  youtubeSubscribers?: number | null;
  deezerUrl?: string | null;
  deezerFans?: number | null;
  appleMusicUrl?: string | null;
  appleMusicAlbums?: number | null;
  soundcloudUrl?: string | null;
  soundcloudFollowers?: number | null;
  instagramUrl?: string | null;
  instagramFollowers?: number | null;
  tiktokUrl?: string | null;
  tiktokFollowers?: number | null;
  gender?: ArtistGender | string | null;
  birthDate?: string | null;
  /** Identity document (RG — wire key rg, legal-domain exception). */
  idDocument?: string | null;
  address?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  bankAccount?: string | null;
  pixKey?: string | null;
  accountHolder?: string | null;
  specialties?: Array<ArtistSpecialty | string> | null;
  profileType?: ArtistProfileType | string | null;
  /** "Empresário" (agent_*). */
  agentId?: string | null;
  agentName?: string | null;
  agentPhone?: string | null;
  agentEmail?: string | null;
  recordLabelId?: string | null;
  recordLabelName?: string | null;
  recordLabelPhone?: string | null;
  recordLabelEmail?: string | null;
  recordLabelContactId?: string | null;
  recordLabelContactName?: string | null;
  recordLabelContactPhone?: string | null;
  recordLabelContactEmail?: string | null;
  selectedDistributors?: Record<string, boolean> | null;
  distributorEmails?: Record<string, string> | null;
  companySelectedDistributors?: Record<string, boolean> | null;
  companyDistributorEmails?: Record<string, string> | null;
  personalDocumentsUrl?: string | null;
  pressKitUrl?: string | null;
  internalNotes?: string | null;
  galleryUrls?: string[] | null;
  /**
   * @deprecated "Manager" (team) pass-through fields from a discontinued form
   * section — a distinct concept from agent* ("Empresário"). Preserved only to
   * round-trip pre-existing data untouched.
   */
  managerName?: string | null;
  managerContact?: string | null;
  executiveProducer?: string | null;
  bookingAgency?: string | null;
  partnerLabel?: string | null;
  documents?: ArtistDocument[] | null;
  generalDistributors?: DistributorEntry[] | null;
  /**
   * Team contacts linked from the CRM (single source).
   * Replaces the old embedded field in artist create/edit.
   */
  linkedContacts?: ArtistLinkedContact[] | null;
  /** @deprecated ver `ArtistTeamContact`. */
  teamContacts?: ArtistTeamContact[] | null;
  created_at?: string;
  updated_at?: string;
}

export type ArtistInsert = Omit<Artist, "id" | "user_id" | "created_at" | "updated_at">;
export type ArtistUpdate = Partial<ArtistInsert>;
export type SignedArtist = Artist;
