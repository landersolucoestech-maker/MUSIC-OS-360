import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, ParseUUIDPipe, UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser }   from '../../core/decorators/current-user.decorator';
import { RequireRole }   from '../../core/decorators/roles.decorator';
import { Audit }                from '../../core/interceptors/audit.interceptor';
import { IdempotencyInterceptor } from '../../core/interceptors/idempotency.interceptor';
import { HrService }             from './hr.service';
import { CreateEmployeeDto }     from './dto/create-employee.dto';
import { UpdateEmployeeDto }     from './dto/update-employee.dto';
import { CreatePayrollEntryDto } from './dto/create-payroll-entry.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';

@ApiTags('HR')
@ApiBearerAuth()
@Controller('hr')
export class HrController {
  constructor(private readonly svc: HrService) {}

  // ── Employees ──────────────────────────────────────────────────────────────

  @Get('employees')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Listar funcionários do tenant' })
  listEmployees(
    @CurrentTenant() tenant: { id: string },
    @Query('status') status?: string,
    @Query('setor') setor?: string,
    @Query('search') search?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listEmployees(tenant.id, {
      status,
      setor,
      search,
      offset: offset ? +offset : undefined,
      limit:  limit  ? +limit  : undefined,
    });
  }

  @Get('employees/stats')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Contagem exata de funcionários por status (tenant inteiro)' })
  employeeStats(@CurrentTenant() tenant: { id: string }) {
    return this.svc.employeeStats(tenant.id);
  }

  @Get('employees/:id')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Obter funcionário por ID' })
  findEmployee(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.findEmployee(tenant.id, id);
  }

  @Post('employees')
  @RequireRole('manager')
  @Audit('employee.created')
  @ApiOperation({ summary: 'Criar funcionário' })
  createEmployee(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.svc.createEmployee(tenant.id, user.userId, dto);
  }

  @Patch('employees/:id')
  @RequireRole('manager')
  @Audit('employee.updated')
  @ApiOperation({ summary: 'Atualizar funcionário' })
  updateEmployee(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.svc.updateEmployee(tenant.id, user.userId, id, dto);
  }

  @Delete('employees/:id')
  @RequireRole('admin')
  @Audit('employee.deleted')
  @ApiOperation({ summary: 'Desactivar funcionário (soft delete)' })
  removeEmployee(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.softDeleteEmployee(tenant.id, id);
  }

  // ── Payroll ────────────────────────────────────────────────────────────────

  @Get('payroll')
  @RequireRole('manager')
  @ApiOperation({ summary: 'Listar folha de pagamento (restrito a manager+)' })
  listPayroll(
    @CurrentTenant() tenant: { id: string },
    @Query('employee_id') employee_id?: string,
    @Query('competencia') competencia?: string,
    @Query('status') status?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listPayroll(tenant.id, {
      employee_id,
      competencia,
      status,
      offset: offset ? +offset : undefined,
      limit:  limit  ? +limit  : undefined,
    });
  }

  @Post('payroll')
  @RequireRole('manager')
  @UseInterceptors(IdempotencyInterceptor)
  @Audit('payroll.created')
  @ApiOperation({ summary: 'Lançar entrada na folha de pagamento' })
  @ApiHeader({ name: 'X-Idempotency-Key', description: 'UUID único por operação — previne lançamento duplicado (pagamento em dobro) em duplo-clique/retry', required: false })
  createPayroll(
    @CurrentTenant() tenant: { id: string },
    @Body() dto: CreatePayrollEntryDto,
  ) {
    return this.svc.createPayroll(tenant.id, dto);
  }

  // ── Leave Requests ─────────────────────────────────────────────────────────

  @Get('leave-requests')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Listar pedidos de ausência' })
  listLeaveRequests(
    @CurrentTenant() tenant: { id: string },
    @Query('employee_id') employee_id?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listLeaveRequests(tenant.id, {
      employee_id,
      status,
      search,
      offset: offset ? +offset : undefined,
      limit:  limit  ? +limit  : undefined,
    });
  }

  @Post('leave-requests')
  @RequireRole('editor')
  @Audit('leave_request.created')
  @ApiOperation({ summary: 'Criar pedido de ausência' })
  createLeaveRequest(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateLeaveRequestDto,
  ) {
    return this.svc.createLeaveRequest(tenant.id, user.userId, dto);
  }

  @Patch('leave-requests/:id/approve')
  @RequireRole('manager')
  @Audit('leave_request.approved')
  @ApiOperation({ summary: 'Aprovar pedido de ausência (manager+)' })
  approveLeaveRequest(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.approveLeaveRequest(tenant.id, id, user.userId);
  }
}
