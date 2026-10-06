/**
 * MusicChat technical vocabulary (CZ-045). Values are English (technical =
 * English, UX = PT-BR — the web renders the PT-BR labels). Stored data was
 * remapped by 20260928000026_CanonicalizeMusicChatValuesToEnglish; the legacy
 * maps below only translate deprecated INPUT from a pre-CZ-045 web build.
 */

export const LEGACY_SERVICE_STATUSES: Readonly<Record<string, string>> = {
  nova: 'new',
  aguardando_atendimento: 'waiting_agent',
  em_atendimento: 'in_progress',
  aguardando_cliente: 'waiting_customer',
  resolvida: 'resolved',
  arquivada: 'archived',
};

export const LEGACY_PRIORITIES: Readonly<Record<string, string>> = {
  baixa: 'low',
  media: 'medium',
  alta: 'high',
  critica: 'critical',
};

/** Default triage menu option ids (also the ids of their response templates). */
export const LEGACY_MENU_OPTION_IDS: Readonly<Record<string, string>> = {
  producao: 'music_production',
  editora: 'publishing_distribution',
  financeiro: 'finance',
  conteudo: 'content',
  outros: 'other',
  engano: 'wrong_contact',
};

/** Menu option that closes the triage as resolved instead of routing it to a queue. */
export const WRONG_CONTACT_OPTION_ID = 'wrong_contact';

function canonical(map: Readonly<Record<string, string>>, value: unknown): unknown {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(map, value) ? map[value] : value;
}

/** class-transformer @Transform: maps a pre-CZ-045 service_status before validation. */
export const canonicalServiceStatus = ({ value }: { value: unknown }) => canonical(LEGACY_SERVICE_STATUSES, value);

interface MenuOptionLike { id: string; responseTemplateId: string; priority?: string }
interface TemplateLike { id: string }

/**
 * Legacy -> canonical id map for one tenant's settings: a default id is mapped
 * only when its English target is not already used (same rule as migration
 * 20260928000026), so a tenant holding both `outros` and its own `other` never
 * ends up with two options sharing one id.
 */
export function legacyMenuIdMap(usedIds: Iterable<string>, keptLegacyIds: Iterable<string> = []): Readonly<Record<string, string>> {
  const used = new Set(usedIds);
  // A legacy id still present in a stored array the payload does not replace was
  // kept on purpose (collision tenant, migration 26): it is never renamed either.
  const kept = new Set(keptLegacyIds);
  return Object.fromEntries(Object.entries(LEGACY_MENU_OPTION_IDS).filter(([legacy, target]) => !used.has(target) && !kept.has(legacy)));
}

/** Maps a pre-CZ-045 settings payload (menu option ids, template ids, priorities). */
export function canonicalMenuOption<T extends MenuOptionLike>(option: T, idMap: Readonly<Record<string, string>> = LEGACY_MENU_OPTION_IDS): T {
  return {
    ...option,
    id: canonical(idMap, option.id) as string,
    responseTemplateId: canonical(idMap, option.responseTemplateId) as string,
    ...(option.priority !== undefined ? { priority: canonical(LEGACY_PRIORITIES, option.priority) as string } : {}),
  };
}

export function canonicalTemplate<T extends TemplateLike>(template: T, idMap: Readonly<Record<string, string>> = LEGACY_MENU_OPTION_IDS): T {
  return { ...template, id: canonical(idMap, template.id) as string };
}

/** The first id used by more than one entry, if any. */
export function duplicateId(entries: ReadonlyArray<{ id: string }>): string | null {
  const seen = new Set<string>();
  for (const { id } of entries) {
    if (seen.has(id)) return id;
    seen.add(id);
  }
  return null;
}
