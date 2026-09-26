/**
 * modules/reports/reports.module.ts
 *
 * PHASE 1 — backend foundation of the Reports Center (entity-driven metadata).
 * No functional import/export yet; only the classified inventory.
 */
import { Module } from '@nestjs/common';
import { FinanceCategoryRulesModule } from '../finance-category-rules/finance-category-rules.module';
import { EntityMetadataService } from './entity-metadata.service';
import { ReportEntityDefinitionService } from './definitions/report-entity-definition.service';
import { ExportEngineService } from './export/export-engine.service';
import { ExportQueryBuilderService } from './export/export-query-builder.service';
import { ExportFormatService } from './export/export-format.service';
import { ExportAuditService } from './export/export-audit.service';
import { ImportEngineService } from './import/import-engine.service';
import { ImportParserService } from './import/import-parser.service';
import { ImportMapperService } from './import/import-mapper.service';
import { ImportValidationService } from './import/import-validation.service';
import { ImportCommitService } from './import/import-commit.service';
import { ImportAuditService } from './import/import-audit.service';
import { ReportTableGuardService } from './report-table-guard.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [FinanceCategoryRulesModule],
  controllers: [ReportsController],
  providers: [
    EntityMetadataService,
    ReportEntityDefinitionService,
    ReportTableGuardService,
    ExportEngineService,
    ExportQueryBuilderService,
    ExportFormatService,
    ExportAuditService,
    ImportEngineService,
    ImportParserService,
    ImportMapperService,
    ImportValidationService,
    ImportCommitService,
    ImportAuditService,
  ],
  exports: [EntityMetadataService, ReportEntityDefinitionService, ExportEngineService, ImportEngineService, ImportCommitService],
})
export class ReportsModule {}
