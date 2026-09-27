import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser }   from '../../core/decorators/current-user.decorator';
import { RequirePermission } from '../../core/decorators/permissions.decorator';
import { RequireRole }   from '../../core/decorators/roles.decorator';
import { Audit }         from '../../core/interceptors/audit.interceptor';
import type { JwtAuth }  from '../../core/guards/auth.guard';
import { FinanceCategoryRulesService } from './finance-category-rules.service';
import { CreateFinanceCategoryRuleDto, UpdateFinanceCategoryRuleDto, QueryFinanceCategoryRuleDto } from './dto/finance-category-rules.dto';

@ApiTags('Finance Category Rules') @ApiBearerAuth() @Controller('finance-category-rules')
export class FinanceCategoryRulesController {
  constructor(private readonly svc: FinanceCategoryRulesService) {}

  @Get() @RequireRole('viewer') @RequirePermission('financial_category_rule:read') @ApiOperation({ summary: 'List automatic categorization rules' })
  list(@CurrentTenant() t: { id: string }, @Query() q: QueryFinanceCategoryRuleDto) {
    return this.svc.list(t.id, q);
  }

  @Get(':id') @RequireRole('viewer') @RequirePermission('financial_category_rule:read') @ApiOperation({ summary: 'Get an automatic categorization rule' })
  findById(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findById(t.id, id);
  }

  @Post() @RequireRole('financial') @RequirePermission('financial_category_rule:create') @Audit('financial_category_rule.created') @ApiOperation({ summary: 'Create an automatic categorization rule' })
  create(@CurrentTenant() t: { id: string }, @CurrentUser() u: JwtAuth, @Body() dto: CreateFinanceCategoryRuleDto) {
    return this.svc.create(t.id, u?.userId ?? '', dto);
  }

  @Patch(':id') @RequireRole('financial') @RequirePermission('financial_category_rule:update') @Audit('financial_category_rule.updated') @ApiOperation({ summary: 'Update an automatic categorization rule' })
  update(@CurrentTenant() t: { id: string }, @CurrentUser() u: JwtAuth, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFinanceCategoryRuleDto) {
    return this.svc.update(t.id, u?.userId ?? '', id, dto);
  }

  @Delete(':id') @RequireRole('manager') @RequirePermission('financial_category_rule:delete') @Audit('financial_category_rule.deleted') @ApiOperation({ summary: 'Remove an automatic categorization rule' })
  remove(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.softDelete(t.id, id);
  }
}
