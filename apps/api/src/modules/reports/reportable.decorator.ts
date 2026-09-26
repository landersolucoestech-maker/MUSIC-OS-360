/**
 * modules/reports/reportable.decorator.ts
 *
 * PHASE 1 — explicit per-entity reportability mechanism.
 *
 * Allows marking a TypeORM entity as reportable (or not) directly on the
 * class, OVERRIDING the central classification. Optional use — the central
 * classification already covers the inventory; the decorator exists for future entities and
 * for auditable one-off adjustments.
 *
 *   @Reportable({ category: EntityCategory.REPORTABLE, label: 'Artistas' })
 *   @Entity('artists')
 *   export class ArtistEntity { … }
 */
import 'reflect-metadata';
import { EntityCategory } from './entity-metadata.types';

export interface ReportableOptions {
  /** Explicit category (overrides the central one). */
  category?: EntityCategory;
  /** Atalho: `reportable: false` ⇒ NOT_REPORTABLE. */
  reportable?: boolean;
  /** Operational pt-BR label. */
  label?: string;
}

export const REPORTABLE_METADATA = Symbol('music-os-360:reportable');

export function Reportable(options: ReportableOptions = {}): ClassDecorator {
  return (target) => {
    const resolved: ReportableOptions = { ...options };
    if (resolved.category === undefined && resolved.reportable === false) {
      resolved.category = EntityCategory.NOT_REPORTABLE;
    }
    Reflect.defineMetadata(REPORTABLE_METADATA, resolved, target);
  };
}

/** Reads the `@Reportable` marking of an entity class, if any. */
export function getReportableMetadata(target: unknown): ReportableOptions | undefined {
  if (typeof target !== 'function') return undefined;
  return Reflect.getMetadata(REPORTABLE_METADATA, target) as ReportableOptions | undefined;
}
