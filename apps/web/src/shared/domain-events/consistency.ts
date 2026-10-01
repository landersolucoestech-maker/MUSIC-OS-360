/**
 * STEP 4 — Cross-Domain Consistency Hooks
 *
 * Registers domain event handlers to keep modules consistent
 * without direct coupling.
 *
 * Implemented handlers:
 * - CONTRACT_CREATED → sets the artist status to "signed" (+ contract_id)
 * - TRANSACTION_CREATED → flags the artist/global P&L as stale in storage
 * - ARTIST_CREATED, LEAD_CONVERTED, MUSIC_REGISTERED → dev-only diagnostic log
 *
 * This module self-initializes when imported (side-effect import).
 * Import it once in App.tsx: import '@/shared/domain-events/consistency'
 */
import { subscribe, DomainEvents } from "./index";
import { storage } from "@/shared/lib/storage";
import { getCurrentOrgId } from "@/shared/lib/tenant";
import { IS_DEV } from "@/shared/lib/env";

let _initialized = false;

function initConsistencyHooks(): void {
  if (_initialized) return;
  _initialized = true;

  // ── CONTRACT_CREATED → artist becomes "signed" ────────────────────────────
  subscribe(DomainEvents.CONTRACT_CREATED, async ({ artist_id, id }) => {
    if (!artist_id) return;
    try {
      const artist = await storage.findById<Record<string, unknown> & { id: string }>("artists", artist_id);
      if (artist && artist.status !== "signed") {
        await storage.update("artists", artist_id, {
          status: "signed",
          contract_id: id,
        });
      }
    } catch {
      // Not propagated — a consistency hook must not break the main flow
    }
  });

  // ── ARTIST_CREATED → dev-only diagnostic log ─────────────────────────────
  subscribe(DomainEvents.ARTIST_CREATED, ({ id, stageName }) => {
    try {
      // Logs the creation to the console (dev only)
      if (IS_DEV) {
        console.info(`[consistency] Artist created: "${stageName}" (${id})`);
      }
    } catch {
      /* intentionally ignored: must not break the emitter */
    }
  });

  // ── TRANSACTION_CREATED → flags a pending financial recalculation ────────
  subscribe(DomainEvents.TRANSACTION_CREATED, ({ artist_id, type, amount }) => {
    try {
      const orgId = getCurrentOrgId();
      // Marks this artist's P&L as stale (flag for the UI)
      const flagKey = `_pl_stale_${orgId}`;
      const existing = storage.getRaw<Record<string, boolean>>(flagKey) ?? {};
      if (artist_id) {
        existing[artist_id] = true;
      }
      existing["_global"] = true;
      storage.setRaw(flagKey, existing);

      if (IS_DEV) {
        console.info(
          `[consistency] Transaction created: ${type} R$${amount?.toFixed(2)} → P&L marked as stale`,
        );
      }
    } catch {
      /* intentionally ignored: must not break the emitter */
    }
  });

  // ── LEAD_CONVERTED → dev-only diagnostic log ─────────────────────────────
  subscribe(DomainEvents.LEAD_CONVERTED, ({ id, artist_id }) => {
    if (IS_DEV) {
      console.info(
        `[consistency] Lead ${id} converted${artist_id ? ` → artist ${artist_id}` : ""}`,
      );
    }
  });

  // ── MUSIC_REGISTERED → dev-only diagnostic log ───────────────────────────
  subscribe(DomainEvents.MUSIC_REGISTERED, ({ work_id, title }) => {
    if (IS_DEV) {
      console.info(`[consistency] Work registered: "${title}" (${work_id})`);
    }
  });
}

// Self-initialization on import
initConsistencyHooks();

/** Allows re-initialization in test environments. */
export function resetConsistencyHooks(): void {
  _initialized = false;
  initConsistencyHooks();
}

