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

/**
 * Queue and sector of a menu option are tenant-editable DISPLAY LABELS (free strings). The canonical machine keys
 * (`queueKey`/`sectorKey`, pattern ROUTING_KEY_PATTERN) live next to them. These frozen maps are the labels the
 * pre-key defaults shipped; they are only used to ADD a key to an option still carrying exactly such a label.
 */
export const ROUTING_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;

export const LEGACY_QUEUE_LABELS: Readonly<Record<string, string>> = {
  Comercial: 'commercial',
  'Produção Musical': 'music_production',
  Catálogo: 'catalog',
  Marketing: 'marketing',
  Financeiro: 'finance',
  Atendimento: 'customer_service',
};

export const LEGACY_SECTOR_LABELS: Readonly<Record<string, string>> = {
  Shows: 'shows',
  Produção: 'production',
  'Editora/Distribuição': 'publishing_distribution',
  Criação: 'creative',
  Financeiro: 'finance',
  Conteúdo: 'content',
  Suporte: 'support',
  Triagem: 'triage',
};

/** Own-property, exact, case-sensitive lookup: a prototype key such as `constructor` never matches. */
function labelKey(map: Readonly<Record<string, string>>, label: unknown): string | undefined {
  return typeof label === 'string' && Object.prototype.hasOwnProperty.call(map, label) ? map[label] : undefined;
}

/**
 * Keys to ADD to a menu option: only for a key that is absent and whose label matches a legacy label exactly.
 * An unknown or edited label gets no key (never guessed); an existing key is never overwritten.
 */
export function canonicalRoutingKeys(option: { queue?: unknown; sector?: unknown; queueKey?: unknown; sectorKey?: unknown }): { queueKey?: string; sectorKey?: string } {
  const out: { queueKey?: string; sectorKey?: string } = {};
  if (option.queueKey === undefined || option.queueKey === null) {
    const key = labelKey(LEGACY_QUEUE_LABELS, option.queue);
    if (key) out.queueKey = key;
  }
  if (option.sectorKey === undefined || option.sectorKey === null) {
    const key = labelKey(LEGACY_SECTOR_LABELS, option.sector);
    if (key) out.sectorKey = key;
  }
  return out;
}

/** The option with its absent routing keys derived from exact legacy labels (all other fields untouched). */
export function withCanonicalRoutingKeys<T extends { queue?: unknown; sector?: unknown; queueKey?: string | null; sectorKey?: string | null }>(option: T): T {
  const keys = canonicalRoutingKeys(option);
  return Object.keys(keys).length > 0 ? { ...option, ...keys } : option;
}

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
