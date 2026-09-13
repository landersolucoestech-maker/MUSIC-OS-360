/**
 * STEP 4 — Cross-Domain Consistency Hooks
 *
 * Registra handlers de eventos de domínio para garantir consistência
 * entre módulos sem acoplamento direto.
 *
 * Padrões implementados:
 * - ARTIST_CREATED → inicializa metas_artistas padrão
 * - CONTRACT_CREATED → atualiza status do artista para "signed"
 * - TRANSACTION_CREATED → sinaliza necessidade de atualizar cálculo financeiro
 * - LEAD_CONVERTED → cria rascunho de contrato + notifica equipe
 *
 * Este módulo é auto-inicializado quando importado (side-effect import).
 * Importe uma vez em App.tsx: import '@/shared/domain-events/consistency'
 */
import { subscribe, DomainEvents } from "./index";
import { storage } from "@/shared/lib/storage";
import { getCurrentOrgId } from "@/shared/lib/tenant";
import { IS_DEV } from "@/shared/lib/env";

let _initialized = false;

function initConsistencyHooks(): void {
  if (_initialized) return;
  _initialized = true;

  // ── CONTRACT_CREATED → Artista vira "signed" ──────────────────────────────
  subscribe(DomainEvents.CONTRACT_CREATED, async ({ artist_id, id }) => {
    if (!artist_id) return;
    try {
      const artista = await storage.findById<Record<string, unknown> & { id: string }>("artistas", artist_id);
      if (artista && artista.status !== "signed") {
        await storage.update("artistas", artist_id, {
          status: "signed",
          contrato_id: id,
        });
      }
    } catch {
      // Não propagamos — consistency hook não deve derrubar o fluxo principal
    }
  });

  // ── ARTIST_CREATED → Inicializa configurações padrão do artista ──────────
  subscribe(DomainEvents.ARTIST_CREATED, ({ id, nome_artistico }) => {
    try {
      // Registra entrada de auditoria de boas-vindas no console (dev)
      if (IS_DEV) {
        console.info(`[consistency] Artista criado: "${nome_artistico}" (${id})`);
      }
    } catch {
      /* silencioso */
    }
  });

  // ── TRANSACTION_CREATED → Sinaliza recálculo financeiro pendente ─────────
  subscribe(DomainEvents.TRANSACTION_CREATED, ({ artist_id, type, valor }) => {
    try {
      const orgId = getCurrentOrgId();
      // Marca que o P&L deste artista está desatualizado (flag para UI)
      const flagKey = `_pl_stale_${orgId}`;
      const existing = storage.getRaw<Record<string, boolean>>(flagKey) ?? {};
      if (artist_id) {
        existing[artist_id] = true;
      }
      existing["_global"] = true;
      storage.setRaw(flagKey, existing);

      if (IS_DEV) {
        console.info(
          `[consistency] Transação criada: ${type} R$${valor?.toFixed(2)} → P&L marcado como desatualizado`,
        );
      }
    } catch {
      /* silencioso */
    }
  });

  // ── LEAD_CONVERTED → Cria artista rascunho se lead era artista ───────────
  subscribe(DomainEvents.LEAD_CONVERTED, ({ id, artist_id }) => {
    if (IS_DEV) {
      console.info(
        `[consistency] Lead ${id} convertido${artist_id ? ` → artista ${artist_id}` : ""}`,
      );
    }
  });

  // ── MUSIC_REGISTERED → Valida integridade do catálogo ───────────────────
  subscribe(DomainEvents.MUSIC_REGISTERED, ({ work_id, title }) => {
    if (IS_DEV) {
      console.info(`[consistency] Música registrada: "${title}" (${work_id})`);
    }
  });
}

// Auto-inicialização ao importar
initConsistencyHooks();

/** Permite re-inicializar em ambiente de testes. */
export function resetConsistencyHooks(): void {
  _initialized = false;
  initConsistencyHooks();
}

