# FASE 4 — Auditoria Operacional Enterprise-Grade

## What & Why
O sistema tem uma `AuditLogEntity` e um `AuditInterceptor` básicos, mas a cobertura é incompleta: faltam `correlation_id`, `org_id` (apenas `tenant_id`), `before`/`after` automáticos nos mutations críticos, e as entidades de billing/permissions/settings não são cobertas. Esta fase implementa audit trail completo, append-only, tenant-safe e preparado para compliance futuro (LGPD, SOC2).

## Done looks like
- `AuditLogEntity` expandida com: `org_id`, `correlation_id`, `session_id`, `actor_role`, `http_method`, `http_path`, campo `diff` (apenas campos alterados, não o snapshot completo quando irrelevante)
- `AuditInterceptor` captura automaticamente `before` (pre-load da entidade) e `after` (post-mutation) para todos os endpoints decorados com `@Audit()`
- Cobertura obrigatória implementada em:
  - `contracts` — toda criação/edição/assinatura/cancelamento
  - `releases` — toda transição de status
  - `artists` — criação, edição de dados sensíveis, inativação
  - `billing` — mudança de plano, cancelamento, atualização de subscription
  - `permissions/roles` — qualquer alteração de role de membro
  - `settings` — alterações de configuração de tenant
  - `integrations` — conexão/desconexão de plataformas
  - `uploads` — upload e deleção de assets críticos
  - `campaigns` — criação e mudanças de budget
- Auditoria é append-only: nenhum UPDATE ou DELETE na tabela `audit_logs`
- Isolation por tenant: queries de audit sempre filtradas por `tenant_id`
- `GET /audit-logs` endpoint com filtros por entity_type, entity_id, actor_id, date range — acesso restrito a OWNER/ADMIN
- Frontend: página de Audit Trail em Settings > Segurança exibindo histórico com diff visual (before/after)
- `correlation_id` propagado de FASE 3 linkado aos audit logs correspondentes

## Out of scope
- Export de audit logs para SIEM externo
- Retenção automática com TTL (infraestrutura futura)
- Assinatura criptográfica de logs

## Steps
1. **Expandir AuditLogEntity** — Adicionar colunas: `org_id UUID`, `correlation_id VARCHAR(255)`, `session_id VARCHAR(255)`, `actor_role VARCHAR(50)`, `http_method VARCHAR(10)`, `http_path TEXT`, `diff JSONB` (apenas campos modificados). Criar migration.
2. **Refatorar AuditInterceptor** — Implementar captura automática de `before`: antes do handler, fazer SELECT da entidade atual por ID (quando disponível no request params). Capturar `after` no response. Calcular `diff` como objeto de campos modificados. Ler `correlation_id` do AsyncLocalStorage (FASE 3).
3. **Anotar controllers com @Audit()** — Adicionar decorator `@Audit('entity.action')` em todos os endpoints críticos dos módulos: contracts, releases, artists, billing, settings, integrations, uploads. Verificar que `AuditModule` está importado globalmente.
4. **Criar endpoint GET /audit-logs** — Controller com filtros: `entity_type`, `entity_id`, `actor_id`, `from_date`, `to_date`, `action`, `tenant_id`. Paginado. Protegido por `@Roles('OWNER', 'ADMIN')`.
5. **Implementar página de Audit Trail no frontend** — Em `apps/web/src/modules/settings/pages/`, criar `AuditTrail.tsx` com tabela de logs, filtros por entidade e data, e expansão de linha para ver diff before/after. Rota: `/settings/audit`.
6. **Garantir append-only na camada de repositório** — Em `AuditService`, remover qualquer método de update/delete. Adicionar constraint de banco (trigger ou policy) que previne UPDATE/DELETE na tabela.

## Relevant files
- `apps/api/src/core/interceptors/audit.interceptor.ts`
- `apps/api/src/database/entities.ts`
- `apps/api/src/core/audit/audit.service.ts`
- `apps/api/src/modules/contracts/contracts.controller.ts`
- `apps/api/src/modules/releases/releases.controller.ts`
- `apps/web/src/modules/settings/pages/`
- `apps/web/src/app/routes/`
