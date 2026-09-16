/**
 * packages/ai-skills/src/index.ts
 *
 * Barrel raiz do pacote compartilhado de AI Skills (lógica pura).
 * Fonte canônica consumível por apps/web e apps/api.
 *
 * Fase atual: project-planning e release-checklist (automações nativas).
 * As demais skills serão migradas incrementalmente.
 */

export * from "./shared/primitives";

// project-planning — re-export seletivo (exclui ValidationResult para evitar TS2308)
export type {
  ProjectPlanningInput,
  ProjectPlanningOutput,
  ProjectPlanningLanguage,
  ProjectPhase,
  ProjectTask,
  ProjectRisk,
  ProjectOwner,
  ProjectMilestone,
  TaskPriority,
  RiskSeverity,
} from "./project-planning";
export {
  PROJECT_PLANNING_SYSTEM_PROMPT,
  buildProjectPlanningPrompt,
  parseProjectPlanningResponse,
  validateProjectPlanningInput,
  validateProjectPlanningOutput,
} from "./project-planning";

// release-checklist — re-export seletivo (exclui ValidationResult para evitar TS2308)
export type {
  ReleaseChecklistInput,
  ReleaseChecklistOutput,
  ReleaseChecklistLanguage,
  ReleaseType,
  ReleaseStatus,
  ItemSeverity,
  ActionPriority,
  MissingItem,
  CriticalIssue,
  ChecklistItem,
  RecommendedAction,
  MetadataReview,
} from "./release-checklist";
export {
  RELEASE_CHECKLIST_SYSTEM_PROMPT,
  buildReleaseChecklistPrompt,
  parseReleaseChecklistResponse,
  validateReleaseChecklistInput,
  validateReleaseChecklistOutput,
} from "./release-checklist";

// support-triage — re-export seletivo (exclui ValidationResult para evitar TS2308)
export type {
  SupportTriageInput,
  SupportTriageOutput,
  SupportTriageLanguage,
  SupportModule,
  SLARecommendation,
  SupportRecommendedAction,
} from "./support-triage";
export {
  SUPPORT_TRIAGE_SYSTEM_PROMPT,
  buildSupportTriagePrompt,
  parseSupportTriageResponse,
  validateSupportTriageInput,
  validateSupportTriageOutput,
} from "./support-triage";

// artist-profile-analysis — re-export seletivo (exclui ValidationResult para evitar TS2308)
export type {
  ArtistProfileAnalysisInput,
  ArtistProfileAnalysisOutput,
  ArtistProfileAnalysisLanguage,
  ArtistPlatformProfile,
  ArtistStrength,
  ArtistWeakness,
  ArtistOpportunity,
  ArtistRisk,
  ArtistRecommendedAction,
  ArtistPlatformRecommendation,
} from "./artist-profile-analysis";
export {
  ARTIST_PROFILE_ANALYSIS_SYSTEM_PROMPT,
  buildArtistProfileAnalysisPrompt,
  parseArtistProfileAnalysisResponse,
  validateArtistProfileAnalysisInput,
  validateArtistProfileAnalysisOutput,
} from "./artist-profile-analysis";

// catalog-metadata-validator — re-export seletivo (exclui ValidationResult para evitar TS2308)
export type {
  CatalogMetadataValidatorInput,
  CatalogMetadataValidatorOutput,
  CatalogMetadataValidatorLanguage,
  CatalogMetadataType,
  CatalogComposer,
  CatalogShare,
  CatalogFieldIssue,
  DuplicateRisk,
  RightsRisk,
  NormalizedMetadata,
  RecommendedFix,
} from "./catalog-metadata-validator";
export {
  CATALOG_METADATA_VALIDATOR_SYSTEM_PROMPT,
  buildCatalogMetadataValidatorPrompt,
  parseCatalogMetadataValidatorResponse,
  validateCatalogMetadataValidatorInput,
  validateCatalogMetadataValidatorOutput,
} from "./catalog-metadata-validator";

// financial-classification — re-export seletivo (exclui ValidationResult para evitar TS2308)
export type {
  FinancialClassificationInput,
  FinancialClassificationOutput,
  FinancialClassificationLanguage,
  FinancialDirection,
  FinancialRecurrence,
  LinkedEntityType,
  LinkedEntitySuggestion,
  FinancialRisk,
  FinancialRecommendedAction,
} from "./financial-classification";
export {
  FINANCIAL_CLASSIFICATION_SYSTEM_PROMPT,
  buildFinancialClassificationPrompt,
  parseFinancialClassificationResponse,
  validateFinancialClassificationInput,
  validateFinancialClassificationOutput,
} from "./financial-classification";

// crm-followup — re-export seletivo
export type {
  CrmFollowupInput,
  CrmFollowupOutput,
  CrmLeadType,
  CrmStage,
  CrmObjection,
  CrmRisk,
  CrmStageRecommendation,
  CrmTask,
} from "./crm-followup";
export {
  CRM_FOLLOWUP_SYSTEM_PROMPT,
  buildCrmFollowupPrompt,
  parseCrmFollowupResponse,
  validateCrmFollowupInput,
  validateCrmFollowupOutput,
} from "./crm-followup";

// marketing-calendar-builder — re-export seletivo
export type {
  MarketingCalendarBuilderInput,
  MarketingCalendarBuilderOutput,
  MarketingPlatform,
  MarketingFrequency,
  MarketingCalendarEntry,
  MarketingCalendarStatus,
  MarketingCampaignPhase,
  MarketingDailyAction,
  MarketingProductionNeed,
  ContentPillar,
  PlatformStrategy,
} from "./marketing-calendar-builder";
export {
  MARKETING_CALENDAR_BUILDER_SYSTEM_PROMPT,
  buildMarketingCalendarBuilderPrompt,
  parseMarketingCalendarBuilderResponse,
  validateMarketingCalendarBuilderInput,
  validateMarketingCalendarBuilderOutput,
} from "./marketing-calendar-builder";

// audiovisual-briefing — re-export seletivo
export type {
  AudiovisualBriefingInput,
  AudiovisualBriefingOutput,
  AudiovisualContentType,
  AudiovisualBudgetLevel,
  AudiovisualAsset,
  AudiovisualAssetType,
  AudiovisualChecklistItem,
  AudiovisualDeliverable,
  AudiovisualRisk,
  AudiovisualScene,
  AudiovisualScriptScene,
  AudiovisualTeamNeed,
} from "./audiovisual-briefing";
export {
  AUDIOVISUAL_BRIEFING_SYSTEM_PROMPT,
  buildAudiovisualBriefingPrompt,
  parseAudiovisualBriefingResponse,
  validateAudiovisualBriefingInput,
  validateAudiovisualBriefingOutput,
} from "./audiovisual-briefing";

// campaign-plan — re-export seletivo (exclui ValidationResult para evitar TS2308)
export type {
  CampaignPlanInput,
  CampaignPlanOutput,
  CampaignPlanLanguage,
  CampaignPlanChannel,
  CampaignPlanMilestone,
  CampaignPlanTask,
  CampaignPlanRisk,
} from "./campaign-plan";
export {
  CAMPAIGN_PLAN_SYSTEM_PROMPT,
  buildCampaignPlanPrompt,
  parseCampaignPlanResponse,
  validateCampaignPlanInput,
  validateCampaignPlanOutput,
} from "./campaign-plan";

// campaign-strategy — re-export seletivo (exclui ValidationResult para evitar TS2308)
export type {
  CampaignStrategyInput,
  CampaignStrategyOutput,
  CampaignStrategyLanguage,
  CampaignKeyMessage,
  CampaignMetricToWatch,
  CampaignAdjustmentTrigger,
} from "./campaign-strategy";
export {
  CAMPAIGN_STRATEGY_SYSTEM_PROMPT,
  buildCampaignStrategyPrompt,
  parseCampaignStrategyResponse,
  validateCampaignStrategyInput,
  validateCampaignStrategyOutput,
} from "./campaign-strategy";

// campaign-report — re-export seletivo (exclui ValidationResult para evitar TS2308)
export type {
  CampaignReportInput,
  CampaignReportOutput,
  CampaignReportLanguage,
  CampaignReportExternalMetric,
  CampaignReportMetricSummary,
  CampaignReportLesson,
  CampaignReportRecommendation,
  MetricAvailability,
} from "./campaign-report";
export {
  CAMPAIGN_REPORT_SYSTEM_PROMPT,
  buildCampaignReportPrompt,
  parseCampaignReportResponse,
  validateCampaignReportInput,
  validateCampaignReportOutput,
} from "./campaign-report";
