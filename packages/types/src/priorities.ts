/**
 * Priority scales persisted by the API. They are DISTINCT scales (different
 * domains, different CHECK constraints): none is a superset of another, so they
 * are never merged. Values are the persisted technical values (English).
 * PT-BR labels: PRIORITY_LABEL_PT_BR in value-labels.pt-br.ts.
 * Support tickets use the SupportTicketPriority enum (enums.ts).
 */

/** Takedown triage priority (takedowns.priority). */
export const TRIAGE_PRIORITIES = ["high", "medium", "low"] as const;
export type TriagePriority = (typeof TRIAGE_PRIORITIES)[number];

/** CRM relationship priority (clients.priority). */
export const RELATIONSHIP_PRIORITIES = ["low", "medium", "high", "strategic"] as const;
export type RelationshipPriority = (typeof RELATIONSHIP_PRIORITIES)[number];

/** Work-item priority (projects, tasks, marketing tasks, audiovisual tasks). */
export const WORK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type WorkPriority = (typeof WORK_PRIORITIES)[number];
