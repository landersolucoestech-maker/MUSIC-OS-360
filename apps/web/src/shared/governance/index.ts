/**
 * shared/governance/index.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * MUSIC OS 360 — Barrel of the Governance layer
 *
 * Exports every convention, registry and piece of operational documentation
 * of the platform for use anywhere in the codebase.
 *
 * Recommended import:
 *   import { MODULE_REGISTRY, ENTITY_CATALOG, ... }
 *     from "@/shared/governance";
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Naming conventions ────────────────────────────────────────────────────────
export * from "./naming";

// ── Module registry ───────────────────────────────────────────────────────────
export * from "./modules";

// ── Entity and relationship catalog ───────────────────────────────────────────
export * from "./entities";

// ── State machines ────────────────────────────────────────────────────────────
export * from "./states";

// ── RBAC permission system ────────────────────────────────────────────────────
export * from "./permissions";

// ── Fluxos operacionais ───────────────────────────────────────────────────────
export * from "./flows";
