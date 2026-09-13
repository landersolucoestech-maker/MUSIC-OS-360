/**
 * campaigns.workflow.ts
 *
 * Workflow de ciclo de vida para Campanhas de Marketing.
 * Estados: draft → planning → active → paused → completed / cancelled
 */

import { CampaignStatus } from '@music-os-360/types';
import { WorkflowDefinition } from '../workflow.types';

export const CAMPAIGNS_WORKFLOW: WorkflowDefinition<string> = {
  name:         'campaigns',
  entityType:   'campaign',
  initialState: CampaignStatus.DRAFT,
  states: Object.values(CampaignStatus),
  transitions: [
    {
      from:  CampaignStatus.DRAFT,
      to:    CampaignStatus.PLANNING,
      label: 'Iniciar Planejamento',
      roles: ['super_admin','tenant_owner','owner','admin','manager','marketing_manager','marketing'],
    },
    {
      from:  CampaignStatus.PLANNING,
      to:    CampaignStatus.ACTIVE,
      label: 'Ativar Campanha',
      roles: ['super_admin','tenant_owner','owner','admin','manager','marketing_manager'],
    },
    {
      from:  CampaignStatus.ACTIVE,
      to:    CampaignStatus.PAUSED,
      label: 'Pausar Campanha',
      roles: ['super_admin','tenant_owner','owner','admin','manager','marketing_manager'],
    },
    {
      from:  CampaignStatus.PAUSED,
      to:    CampaignStatus.ACTIVE,
      label: 'Retomar Campanha',
      roles: ['super_admin','tenant_owner','owner','admin','manager','marketing_manager'],
    },
    {
      from:  [CampaignStatus.ACTIVE, CampaignStatus.PAUSED],
      to:    CampaignStatus.COMPLETED,
      label: 'Concluir Campanha',
      roles: ['super_admin','tenant_owner','owner','admin','manager','marketing_manager'],
    },
    {
      from:  [
        CampaignStatus.DRAFT,
        CampaignStatus.PLANNING,
        CampaignStatus.ACTIVE,
        CampaignStatus.PAUSED,
      ],
      to:    CampaignStatus.CANCELLED,
      label: 'Cancelar Campanha',
      roles: ['super_admin','tenant_owner','owner','admin','manager'],
    },
  ],
};
