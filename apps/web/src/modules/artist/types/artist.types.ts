import type { ArtistStatusValue, ArtistProfileType, ArtistSpecialty } from "@/shared/types/enums";

export type { ArtistProfileType, ArtistSpecialty };
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
 * Vínculo entre o artista e um contato do CRM (CRM > Contatos).
 * O artista armazena APENAS a referência (`contactId`) — Nome/Categoria/
 * Telefone/E-mail são resolvidos dinamicamente do CRM em tempo de exibição,
 * evitando duplicação de dados. Os `distributors` são específicos da relação
 * artista↔contato (não do contato) e só se aplicam quando a categoria do
 * contato no CRM for Empresário / Gravadora / Editora.
 */
export interface ArtistLinkedContact {
  contactId: string;
  distributors?: DistributorEntry[];
}

export interface ArtistRelationship {
  type: "empresario" | "gravadora" | "editora" | "booker" | "juridico" | "financeiro" | "contador" | "assessoria";
  name: string;
  phone: string;
  email: string;
  office?: string;
  crc?: string;
  responsibles?: ArtistResponsible[];
  distributors?: DistributorEntry[];
}

/**
 * @deprecated Contatos de equipe embutidos (cópias). Mantido apenas para
 * retrocompatibilidade com dados antigos já persistidos (ainda lido/escrito
 * por `ArtistFormModal`/`artist.mapper.ts` como pass-through, para não
 * descartar dados existentes). NÃO é usado pelo fluxo público de
 * auto-cadastro (`ArtistaSignupPublic`) — esse fluxo usa seu próprio shape
 * local desconectado (`ContatoEquipe`), enviado como parte de um payload de
 * Lead, nunca convertido para este tipo. Novos cadastros/edições no painel
 * usam `linkedContacts`.
 */
export interface ArtistTeamContact {
  name: string;
  category: string;
  phone: string;
  email: string;
  distributors: DistributorEntry[];
}

export interface Artist {
  id: string;
  user_id?: string;
  stageName: string;
  legalName?: string | null;
  name?: string | null;
  status?: ArtistStatus | string | null;
  registrationStatus?: string | null;
  musicGenre?: string | null;
  email?: string | null;
  phone?: string | null;
  taxId?: string | null;
  photoUrl?: string | null;
  notes?: string | null;
  contractId?: string | null;
  artisticSlug?: string | null;
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
  appleMusicAlbumsUrl?: number | null;
  soundcloudUrl?: string | null;
  soundcloudFollowersUrl?: number | null;
  instagramUrl?: string | null;
  instagramFollowers?: number | null;
  facebook?: string | null;
  tiktokUrl?: string | null;
  tiktokFollowers?: number | null;
  twitter?: string | null;
  website?: string | null;
  personType?: string | null;
  birthDate?: string | null;
  /** Documento de identidade (RG). */
  idDocument?: string | null;
  address?: string | null;
  bank?: string | null;
  bankBranch?: string | null;
  bankAccount?: string | null;
  pixKey?: string | null;
  accountHolder?: string | null;
  specialties?: Array<ArtistSpecialty | string> | null;
  profileType?: ArtistProfileType | string | null;
  managerId?: string | null;
  managerName?: string | null;
  managerPhone?: string | null;
  managerEmail?: string | null;
  labelId?: string | null;
  labelName?: string | null;
  labelPhone?: string | null;
  labelEmail?: string | null;
  labelResponsibleId?: string | null;
  labelResponsibleName?: string | null;
  labelResponsiblePhone?: string | null;
  labelResponsibleEmail?: string | null;
  selectedDistributors?: Record<string, boolean> | null;
  distributorEmails?: Record<string, string> | null;
  selectedCompanyDistributors?: Record<string, boolean> | null;
  companyDistributorEmails?: Record<string, string> | null;
  personalDocumentsUrl?: string | null;
  pressKitUrl?: string | null;
  internalNotes?: string | null;
  galleryUrls?: string[] | null;
  /**
   * @deprecated Legacy pass-through fields from a discontinued form section
   * (distinct concept from managerName/managerPhone above — kept separate
   * and NOT unified with them, because they coexist as independent columns
   * on the wire DTO: `empresario_*` is the actively-used business
   * relationship, while `manager_nome`/`manager_contato` was a separate,
   * no-longer-collected manual field). Preserved only to round-trip
   * pre-existing data untouched (see ArtistFormModal's pass-through comment).
   */
  managerNameLegacy?: string | null;
  managerContactLegacy?: string | null;
  executiveProducer?: string | null;
  bookingAgency?: string | null;
  partnerLabel?: string | null;
  documents?: { nome: string; url: string }[] | null;
  generalDistributors?: DistributorEntry[] | null;
  /**
   * Contatos da equipe vinculados a partir do CRM (fonte única).
   * Substitui o antigo campo embutido no cadastro/edição de artista.
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
