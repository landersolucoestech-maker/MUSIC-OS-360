/**
 * report-module-registry.spec.ts  ·  Part 89, Block 31
 *
 * Permanent guard: the Reports Center must list EXACTLY the 22
 * authorized modules, in this order — not one more, not one less, never
 * out of order.
 */
import { EntityMetadataService } from './entity-metadata.service';
import { REPORT_MODULE_ORDERED_LABELS, REPORT_MODULE_REGISTRY } from './report-module-registry';

const EXPECTED_ORDERED_LABELS = [
  'Artistas',
  'Projetos',
  'Obras',
  'Fonogramas',
  'Monitoramento',
  'Licenciamento',
  'Takedowns',
  'Distribuição',
  'Shares',
  'Contratos',
  'Projetos Audiovisuais',
  'Transações Financeiras',
  'Contabilidade',
  'Nota Fiscal',
  'Agenda',
  'Inventário',
  'Contatos',
  'Leads',
  'RH',
  'Tarefas',
  'Calendário de Conteúdo',
  'Briefing',
];

describe('REPORT_MODULE_REGISTRY — closed list and exact order (Block 31)', () => {
  it('has exactly 22 items', () => {
    expect(REPORT_MODULE_REGISTRY.length).toBe(22);
  });

  it('the exact order of labels is the user-authorized list, with no item missing or extra', () => {
    expect(REPORT_MODULE_ORDERED_LABELS).toEqual(EXPECTED_ORDERED_LABELS);
  });

  it('no duplicate key in the registry', () => {
    const keys = REPORT_MODULE_REGISTRY.map((e) => e.tableName);
    expect(new Set(keys).size).toBe(keys.length);
  });

  describe('real inventory (EntityMetadataService) reflects the registry', () => {
    const inv = new EntityMetadataService().scan();
    const reportable = inv.entities.filter((e) => e.reportable);

    it('exactly the 22 registry tableNames are reportable=true — nothing more, nothing less', () => {
      const reportableTables = reportable.map((e) => e.tableName).sort();
      const registryTables = REPORT_MODULE_REGISTRY.map((e) => e.tableName).sort();
      expect(reportableTables).toEqual(registryTables);
    });

    it('the order of reportable entities in the inventory exactly follows the registry order', () => {
      const orderedLabels = reportable.map((e) => e.label);
      expect(orderedLabels).toEqual(EXPECTED_ORDERED_LABELS);
    });

    it('"pipelines" is never reportable', () => {
      for (const table of ['pipelines']) {
        const e = inv.entities.find((x) => x.tableName === table);
        expect(e?.reportable).toBe(false);
      }
    });

    it('entities explicitly removed from the authorized list are not reportable', () => {
      const explicitlyRemoved = [
        'artist_goals', 'assets', 'audiovisual_assets', 'audiovisual_deliverables',
        'audiovisual_tasks', 'lead_interactions', 'marketing_assets',
        'marketing_projects', 'marketing_strategies', 'pipeline_opportunities',
        'support_tickets', 'contract_templates', 'ecad_reports', 'contract_service_types',
        'operational_tasks',
      ];
      for (const table of explicitlyRemoved) {
        const e = inv.entities.find((x) => x.tableName === table);
        if (!e) continue;
        expect(e.reportable).toBe(false);
      }
    });
  });
});
