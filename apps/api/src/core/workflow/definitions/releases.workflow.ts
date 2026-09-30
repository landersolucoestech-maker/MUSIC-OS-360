/**
 * releases.workflow.ts
 *
 * Lifecycle workflow for Releases.
 * Per spec: draft → metadata_pending → assets_pending → review → approved →
 *                scheduled → distributed → released → archived / cancelled
 */

import { ReleaseStatus } from '@music-os-360/types';
import { WorkflowDefinition } from '../workflow.types';

export const RELEASES_WORKFLOW: WorkflowDefinition<string> = {
  name:         'releases',
  entityType:   'release',
  initialState: ReleaseStatus.DRAFT,
  states: Object.values(ReleaseStatus),
  transitions: [
    {
      from:  ReleaseStatus.DRAFT,
      to:    ReleaseStatus.METADATA_PENDING,
      label: 'Preencher Metadados',
      roles: ['super_admin','tenant_owner','owner','admin','editor','manager','produtor','producer','marketing_manager'],
    },
    {
      from:  ReleaseStatus.METADATA_PENDING,
      to:    ReleaseStatus.ASSETS_PENDING,
      label: 'Enviar Assets',
      roles: ['super_admin','tenant_owner','owner','admin','editor','manager','produtor','producer','marketing_manager'],
      guard: async (ctx) => {
        const entity = ctx.entity;
        if (!entity['title'] && !entity['title']) {
          return { allowed: false, reason: 'Lançamento precisa de título antes de avançar para Assets' };
        }
        return { allowed: true };
      },
    },
    {
      from:  ReleaseStatus.ASSETS_PENDING,
      to:    ReleaseStatus.REVIEW,
      label: 'Enviar para Revisão',
      roles: ['super_admin','tenant_owner','owner','admin','editor','manager','produtor','producer','marketing_manager'],
      guard: async (ctx) => {
        const entity = ctx.entity;
        if (!entity['cover_url'] && !entity['coverUrl']) {
          return { allowed: false, reason: 'Lançamento precisa de capa (cover art) antes de ir para revisão' };
        }
        return { allowed: true };
      },
    },
    {
      from:  ReleaseStatus.REVIEW,
      to:    ReleaseStatus.APPROVED,
      label: 'Aprovar',
      roles: ['super_admin','tenant_owner','owner','admin','manager','marketing_manager'],
    },
    {
      from:  ReleaseStatus.REVIEW,
      to:    ReleaseStatus.ASSETS_PENDING,
      label: 'Solicitar Revisão de Assets',
      roles: ['super_admin','tenant_owner','owner','admin','manager','marketing_manager'],
    },
    {
      from:  ReleaseStatus.APPROVED,
      to:    ReleaseStatus.SCHEDULED,
      label: 'Agendar Distribuição',
      roles: ['super_admin','tenant_owner','owner','admin','manager','marketing_manager'],
    },
    {
      from:  ReleaseStatus.SCHEDULED,
      to:    ReleaseStatus.DISTRIBUTED,
      label: 'Confirmar Distribuição',
      roles: ['super_admin','tenant_owner','owner','admin','manager'],
    },
    {
      from:  ReleaseStatus.DISTRIBUTED,
      to:    ReleaseStatus.RELEASED,
      label: 'Publicado nas Plataformas',
      roles: ['super_admin','tenant_owner','owner','admin','manager'],
    },
    {
      from:  [
        ReleaseStatus.DRAFT,
        ReleaseStatus.METADATA_PENDING,
        ReleaseStatus.ASSETS_PENDING,
        ReleaseStatus.REVIEW,
        ReleaseStatus.APPROVED,
        ReleaseStatus.SCHEDULED,
      ],
      to:    ReleaseStatus.CANCELLED,
      label: 'Cancelar',
      roles: ['super_admin','tenant_owner','owner','admin','manager'],
    },
    {
      from:  ReleaseStatus.RELEASED,
      to:    ReleaseStatus.ARCHIVED,
      label: 'Arquivar',
      roles: ['super_admin','tenant_owner','owner','admin'],
    },
  ],
};
