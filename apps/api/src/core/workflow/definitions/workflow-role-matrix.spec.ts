import {
  CampaignStatus,
  ContractStatus,
  LeadStatus,
  ProjectStatus,
  ReleaseStatus,
} from '@music-os-360/types';
import { WorkflowEngine } from '../workflow.engine';
import type { WorkflowDefinition } from '../workflow.types';
import { CAMPAIGNS_WORKFLOW } from './campaigns.workflow';
import { CONTRACTS_WORKFLOW } from './contracts.workflow';
import { LEADS_WORKFLOW } from './leads.workflow';
import { PROJECTS_WORKFLOW } from './projects.workflow';
import { RELEASES_WORKFLOW } from './releases.workflow';

/**
 * CHARACTERIZATION (RBAC slice S0): pins who may run each workflow transition TODAY.
 * The engine matches roles by exact string membership (no alias, no hierarchy), so this
 * table is a behavior contract: any role slug rename or array change must update it
 * deliberately. The literal arrays below are intentionally NOT derived from the definitions.
 */

// Every slug persisted in roles.slug / org_members.role (ROLE_HIERARCHY keys).
const ALL_ROLE_SLUGS = [
  'super_admin', 'tenant_owner', 'owner', 'admin', 'manager', 'editor', 'financial',
  'accounting', 'juridico', 'marketing_manager', 'rh_manager', 'marketing', 'comercial',
  'produtor', 'radio', 'tv', 'artist', 'artista', 'colaborador', 'viewer',
] as const;

const CORE = ['super_admin', 'tenant_owner', 'owner', 'admin', 'manager'];
const CORE_MM = [...CORE, 'marketing_manager'];

interface Row {
  from: string[];
  to: string;
  roles: string[];
}

const EXPECTED: Record<string, { definition: WorkflowDefinition<string>; rows: Row[] }> = {
  contracts: {
    definition: CONTRACTS_WORKFLOW,
    rows: [
      { from: [ContractStatus.DRAFT], to: ContractStatus.UNDER_REVIEW, roles: [...CORE, 'juridico'] },
      { from: [ContractStatus.UNDER_REVIEW], to: ContractStatus.DRAFT, roles: [...CORE, 'juridico'] },
      { from: [ContractStatus.UNDER_REVIEW], to: ContractStatus.AWAITING_SIGNATURE, roles: CORE },
      { from: [ContractStatus.AWAITING_SIGNATURE], to: ContractStatus.SIGNED, roles: CORE },
      { from: [ContractStatus.SIGNED], to: ContractStatus.IN_FORCE, roles: CORE },
      { from: [ContractStatus.IN_FORCE], to: ContractStatus.EXPIRING, roles: CORE },
      { from: [ContractStatus.EXPIRING, ContractStatus.IN_FORCE], to: ContractStatus.EXPIRED, roles: CORE },
      {
        from: [ContractStatus.EXPIRED, ContractStatus.IN_FORCE, ContractStatus.SIGNED],
        to: ContractStatus.TERMINATED,
        roles: CORE,
      },
      {
        from: [
          ContractStatus.DRAFT,
          ContractStatus.UNDER_REVIEW,
          ContractStatus.AWAITING_SIGNATURE,
          ContractStatus.SIGNED,
          ContractStatus.IN_FORCE,
        ],
        to: ContractStatus.CANCELLED,
        roles: CORE,
      },
    ],
  },
  leads: {
    definition: LEADS_WORKFLOW,
    rows: [
      { from: [LeadStatus.NEW], to: LeadStatus.CONTACTED, roles: [...CORE, 'comercial'] },
      { from: [LeadStatus.NEW, LeadStatus.CONTACTED], to: LeadStatus.IN_CONTACT, roles: [...CORE, 'comercial'] },
      { from: [LeadStatus.CONTACTED, LeadStatus.IN_CONTACT], to: LeadStatus.QUALIFIED, roles: [...CORE, 'comercial'] },
      { from: [LeadStatus.QUALIFIED], to: LeadStatus.PROPOSAL, roles: [...CORE, 'comercial'] },
      { from: [LeadStatus.PROPOSAL], to: LeadStatus.NEGOTIATION, roles: [...CORE, 'comercial'] },
      { from: [LeadStatus.PROPOSAL, LeadStatus.NEGOTIATION], to: LeadStatus.CLOSED, roles: [...CORE, 'comercial'] },
      {
        from: [
          LeadStatus.NEW,
          LeadStatus.CONTACTED,
          LeadStatus.IN_CONTACT,
          LeadStatus.QUALIFIED,
          LeadStatus.PROPOSAL,
          LeadStatus.NEGOTIATION,
        ],
        to: LeadStatus.LOST,
        roles: [...CORE, 'comercial'],
      },
      { from: [LeadStatus.LOST, LeadStatus.INACTIVE], to: LeadStatus.NEW, roles: CORE },
      { from: [LeadStatus.CLOSED, LeadStatus.LOST], to: LeadStatus.INACTIVE, roles: CORE },
    ],
  },
  projects: {
    definition: PROJECTS_WORKFLOW,
    rows: [
      { from: [ProjectStatus.PLANNING], to: ProjectStatus.IN_PROGRESS, roles: [...CORE, 'produtor'] },
      { from: [ProjectStatus.IN_PROGRESS], to: ProjectStatus.REVIEW, roles: [...CORE, 'produtor'] },
      { from: [ProjectStatus.REVIEW], to: ProjectStatus.IN_PROGRESS, roles: CORE },
      { from: [ProjectStatus.REVIEW], to: ProjectStatus.COMPLETED, roles: CORE },
      {
        from: [ProjectStatus.PLANNING, ProjectStatus.IN_PROGRESS, ProjectStatus.REVIEW],
        to: ProjectStatus.CANCELLED,
        roles: CORE,
      },
    ],
  },
  releases: {
    definition: RELEASES_WORKFLOW,
    rows: [
      {
        from: [ReleaseStatus.DRAFT],
        to: ReleaseStatus.METADATA_PENDING,
        roles: ['super_admin', 'tenant_owner', 'owner', 'admin', 'editor', 'manager', 'produtor', 'marketing_manager'],
      },
      {
        from: [ReleaseStatus.METADATA_PENDING],
        to: ReleaseStatus.ASSETS_PENDING,
        roles: ['super_admin', 'tenant_owner', 'owner', 'admin', 'editor', 'manager', 'produtor', 'marketing_manager'],
      },
      {
        from: [ReleaseStatus.ASSETS_PENDING],
        to: ReleaseStatus.REVIEW,
        roles: ['super_admin', 'tenant_owner', 'owner', 'admin', 'editor', 'manager', 'produtor', 'marketing_manager'],
      },
      { from: [ReleaseStatus.REVIEW], to: ReleaseStatus.APPROVED, roles: CORE_MM },
      { from: [ReleaseStatus.REVIEW], to: ReleaseStatus.ASSETS_PENDING, roles: CORE_MM },
      { from: [ReleaseStatus.APPROVED], to: ReleaseStatus.SCHEDULED, roles: CORE_MM },
      { from: [ReleaseStatus.SCHEDULED], to: ReleaseStatus.DISTRIBUTED, roles: CORE },
      { from: [ReleaseStatus.DISTRIBUTED], to: ReleaseStatus.RELEASED, roles: CORE },
      {
        from: [
          ReleaseStatus.DRAFT,
          ReleaseStatus.METADATA_PENDING,
          ReleaseStatus.ASSETS_PENDING,
          ReleaseStatus.REVIEW,
          ReleaseStatus.APPROVED,
          ReleaseStatus.SCHEDULED,
        ],
        to: ReleaseStatus.CANCELLED,
        roles: CORE,
      },
      { from: [ReleaseStatus.RELEASED], to: ReleaseStatus.ARCHIVED, roles: ['super_admin', 'tenant_owner', 'owner', 'admin'] },
    ],
  },
  campaigns: {
    definition: CAMPAIGNS_WORKFLOW,
    rows: [
      { from: [CampaignStatus.DRAFT], to: CampaignStatus.PLANNING, roles: [...CORE_MM, 'marketing'] },
      { from: [CampaignStatus.PLANNING], to: CampaignStatus.ACTIVE, roles: CORE_MM },
      { from: [CampaignStatus.ACTIVE], to: CampaignStatus.PAUSED, roles: CORE_MM },
      { from: [CampaignStatus.PAUSED], to: CampaignStatus.ACTIVE, roles: CORE_MM },
      { from: [CampaignStatus.ACTIVE, CampaignStatus.PAUSED], to: CampaignStatus.COMPLETED, roles: CORE_MM },
      {
        from: [CampaignStatus.DRAFT, CampaignStatus.PLANNING, CampaignStatus.ACTIVE, CampaignStatus.PAUSED],
        to: CampaignStatus.CANCELLED,
        roles: CORE,
      },
    ],
  },
};

const project = (definition: WorkflowDefinition<string>): Row[] =>
  definition.transitions.map((t) => ({
    from: Array.isArray(t.from) ? [...t.from] : [t.from],
    to: t.to,
    roles: [...(t.roles ?? ['<<no roles declared>>'])],
  }));

describe.each(Object.keys(EXPECTED))('workflow role matrix: %s', (name) => {
  const { definition, rows } = EXPECTED[name];
  const engine = new WorkflowEngine(definition);

  it('pins the exact transition table (from, to, ordered role slugs)', () => {
    expect(project(definition)).toEqual(rows);
  });

  it.each(ALL_ROLE_SLUGS)('role %s: allow/deny is exact-string membership on every transition', (role) => {
    for (const row of rows) {
      for (const from of row.from) {
        expect({ name, role, from, to: row.to, allowed: engine.canTransition(from, row.to, role) }).toEqual({
          name,
          role,
          from,
          to: row.to,
          allowed: row.roles.includes(role),
        });
      }
    }
  });

  it('denies a missing actor role and an unknown role slug on every transition', () => {
    for (const row of rows) {
      for (const from of row.from) {
        expect(engine.canTransition(from, row.to, undefined)).toBe(false);
        expect(engine.canTransition(from, row.to, '')).toBe(false);
        expect(engine.canTransition(from, row.to, 'nonexistent_role')).toBe(false);
      }
    }
  });

  it('does not treat aliases or higher hierarchy levels as equivalent (exact match only)', () => {
    // tenant_owner is listed explicitly; artista/artist and viewer never appear in any array.
    for (const row of rows) {
      expect(row.roles).not.toContain('viewer');
      expect(row.roles).not.toContain('artist');
      expect(row.roles).not.toContain('artista');
    }
  });
});
