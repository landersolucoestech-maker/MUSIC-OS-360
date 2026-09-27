# ETAPA 4 - CANONICAL BASELINE 157/80

Data de validacao: 2026-07-05
Status: FONTE DE VERDADE do baseline atual de schema/migrations
Projeto Supabase: `iundcoubyaiwzqyytvdr` (producao)

## 1. Baseline Canonico

```text
public_tables            = 157
musicos360_migrations    = 80
```

Validado em 2026-07-05 por consulta read-only contra o `DATABASE_URL` de producao:

```sql
SELECT
  (SELECT count(*) FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS public_tables,
  (SELECT count(*) FROM public.musicos360_migrations)            AS applied_migrations;
-- Resultado: 157 / 80
```

## 2. Paridade Repo <-> Producao

O repositorio contem exatamente **80 arquivos** em
`apps/api/src/database/migrations/`, e os nomes de classe batem **1:1** com os
80 registros de `public.musicos360_migrations` (comparacao por conjunto,
zero divergencias em ambas as direcoes).

Consequencias:

- `db:check` / TypeORM nao deve reportar migrations pendentes contra producao.
- Qualquer migration pendente que apareca e um sinal de NO-GO imediato
  (ver `docs/runbooks/release-baseline-157-80.md`, secao 5).

## 3. Backfill De Reconciliacao (FASE 2A)

A migration `CrmPipelinesAnalytics20260521000050`
(`apps/api/src/database/migrations/20260521000050_CrmPipelinesAnalytics.ts`)
ja estava **aplicada e registrada** em producao, mas o arquivo fonte estava
ausente do repositorio. O arquivo foi restaurado como backfill de
reconciliacao — ele **nao** sera executado contra producao (o registro ja
existe no registry).

Tabelas cobertas (12, todas presentes em producao com RLS habilitado):

- `crm_companies`, `crm_contacts`, `crm_tags`, `crm_contact_tags`,
  `crm_tasks`, `crm_timeline_events`
- `pipelines`, `pipeline_stages`, `pipeline_opportunities`
- `campaign_tasks`, `campaign_assets`
- `ai_usage_logs`

## 4. Registro Canonico Das 80 Migrations

Ordem de aplicacao conforme `public.musicos360_migrations` (id crescente):

1. `InitialSchema20240101000000`
2. `WorkflowTransitions20240601000001`
3. `DomainEventLog20240602000001`
4. `AuditLogEnterpriseColumns20260516000001`
5. `ActivityLogs20260520000002`
6. `SupabaseAuthColumnNames20260520000004`
7. `RLSPolicies20260520000020`
8. `PerformanceIndexes20260521000030`
9. `ConversationsAndForms20260521000040`
10. `CrmPipelinesAnalytics20260521000050`
11. `InventoryLicensingFinancialRules20260521000060`
12. `FixRLSFallback20260522000001`
13. `ForceRLSFailClosed20260522000002`
14. `AddArtistIdToWorks20260523000001`
15. `FinancialCategoriesEnterprise20260526000002`
16. `FinancialCategoryRulesDynamic20260526000003`
17. `AudiovisualPhase120260527000003`
18. `AudiovisualTasks20260527000004`
19. `AudiovisualAssets20260527000005`
20. `LeadsContactsOperationalRefactor20260528000002`
21. `MarketingProjects20260529000001`
22. `MarketingProjectAutomation20260529000002`
23. `MarketingStrategyStructure20260529000003`
24. `MarketingAssets20260529000004`
25. `RegistryFieldsPhase120260601000001`
26. `RegistryRightsHoldersIdentifiers20260601000002`
27. `SocietyIntegration20260601000003`
28. `MarketingContentPublishing20260602000001`
29. `CustomerCareConversationExtensions20260604000001`
30. `AddGenreToPhonograms20260605000001`
31. `SkillsAndCentralAssets20260607000001`
32. `WorkflowExecutions20260607000002`
33. `MusicChatAutomation20260609000001`
34. `CreatePermissionsCatalog20260610000001`
35. `CreateRolesAndRolePermissions20260610000002`
36. `CreateOrgStructure20260610000003`
37. `AlterOrgMembersAddRbacColumns20260610000004`
38. `CreateMembershipJobFunctions20260610000005`
39. `BackfillOrgMembersRoleId20260610000006`
40. `EnableRlsOnRbacTables20260610000007`
41. `PortableRlsTenantContext20260612000001`
42. `FixAppJwtInsufficientPrivilege20260612000002`
43. `CreateArtistPlatformProfiles20260612000003`
44. `CreateReleaseWorksJoinTable20260613000001`
45. `AddMissingSafeColumns20260613000002`
46. `AddLeadsPipelineStage20260613000003`
47. `AddDomainForeignKeys20260613000004`
48. `AddHrEmployeeForeignKeys20260613000005`
49. `RlsPoliciesInventoryLicensesFinancial20260613000006`
50. `RlsPoliciesAssets20260613000007`
51. `RlsPoliciesAudiovisualSocietyMarketing20260613000008`
52. `RlsPolicyReleaseWorks20260613000009`
53. `RlsPoliciesMusicChatAutomation20260613000010`
54. `WorkflowExecutionTenantNotNull20260613000011`
55. `RlsPoliciesSkillRunsWorkflowExecutions20260613000012`
56. `RlsPoliciesSkillWorkflowLogs20260613000013`
57. `HarmonizeRawUuidPolicies20260613000014`
58. `HarmonizeRawTextPolicies20260613000015`
59. `NotificationSettings20260613000016`
60. `HardenRbacAclDefaults20260613000017`
61. `CreateUsersProjection20260614000000`
62. `CreatePermissionGroups20260614000001`
63. `ExtendPermissionsCatalog20260614000002`
64. `CreatePermissionAliases20260614000003`
65. `CreateRoleTemplates20260614000004`
66. `CreatePermissionDependenciesAndConflicts20260614000005`
67. `ExtendRolesForEnterpriseRbac20260614000006`
68. `CreateRoleInheritance20260614000007`
69. `CreateRbacDecisionLogs20260614000008`
70. `CreateTenantInvitations20260620000001`
71. `HardenContactsLeadUploadsRls20260620000002`
72. `HardenRoleInheritanceFunctions20260620000003`
73. `ReconcileOperationalSchema20260620000004`
74. `ForceRLSOperationalTables20260620000005`
75. `HardenSupabaseDataApiSurface20260620000006`
76. `CreateRbacErrorLogs20260621000001`
77. `PublicArtistRegistration20260630000001`
78. `BillingEnforcement20260701000001`
79. `BillingPlans20260701000002`
80. `BillingRlsHardening20260701000003`

## 5. Bloqueios

Este baseline substitui e bloqueia definitivamente:

```text
Baseline historico 61/14        = OBSOLETO
Runbook migration-reconciliation = NAO EXECUTAR
ETAPA 3C antiga                  = BLOQUEADA
Waves antigas                    = BLOQUEADAS
```

Documentos historicos bloqueados para execucao (relatorios de sessao,
nao versionados no repo):

- `docs/runbooks/migration-reconciliation.md` (versionado, marcado OBSOLETO)
- ETAPA 3B - Mirror Restore NO-GO Report (nao versionado)
- ETAPA 3B.1 - Supabase-Compatible Mirror Report (nao versionado)

## 6. Decisao Que Encerra O Impasse 3B/3B.1

Contexto: as ETAPAs 3B e 3B.1 tentaram criar um mirror/restore do banco para
reconciliar o baseline historico `61/14` com o estado real de producao.
Ambas terminaram em NO-GO (incompatibilidades de restore no ambiente
Supabase e ausencia de staging descartavel).

Decisao tecnica:

1. O **banco de producao real** e adotado como fonte de verdade do schema.
2. O baseline canonico passa a ser `157/80`, validado por consulta direta.
3. O repo foi reconciliado com producao via backfill (secao 3), nao via
   re-execucao de waves antigas.
4. Toda migration futura parte deste baseline, somente forward
   (timestamp > `20260701000003`), com ensaio previo em mirror/staging
   descartavel e runbook proprio.

## 7. Como Revalidar Este Baseline

Somente leitura, sem alterar banco:

```sql
SELECT count(*) FROM information_schema.tables
 WHERE table_schema = 'public' AND table_type = 'BASE TABLE';  -- esperado: 157

SELECT count(*) FROM public.musicos360_migrations;             -- esperado: 80
```

E paridade de nomes: extrair `name = '<Classe>'` de cada arquivo em
`apps/api/src/database/migrations/` e comparar com
`SELECT name FROM public.musicos360_migrations` — o diff deve ser vazio.

Se qualquer valor divergir, **parar** e tratar como NO-GO conforme
`docs/runbooks/release-baseline-157-80.md`.
