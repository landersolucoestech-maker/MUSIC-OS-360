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
  @ApiOperation({ summary: 'List the tenant\'s employees' })
  listEmployees(
    @CurrentTenant() tenant: { id: string },
    @Query('status') status?: string,
    @Query('department') department?: string,
    /** CZ-030: deprecated alias of `department` (deploy-skew window). */
    @Query('setor') legacyDepartment?: string,
    @Query('search') search?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listEmployees(tenant.id, {
      status,
      department: department ?? legacyDepartment,
      search,
      offset: offset ? +offset : undefined,
      limit:  limit  ? +limit  : undefined,
    });
  }

  @Get('employees/stats')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Exact employee count per status (whole tenant)' })
  employeeStats(@CurrentTenant() tenant: { id: string }) {
    return this.svc.employeeStats(tenant.id);
  }

  @Get('employees/:id')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Get an employee by ID' })
  findEmployee(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.findEmployee(tenant.id, id);
  }

  @Post('employees')
  @RequireRole('manager')
  @Audit('employee.created')
  @ApiOperation({ summary: 'Create an employee' })
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
  @ApiOperation({ summary: 'Update an employee' })
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
  @ApiOperation({ summary: 'Deactivate an employee (soft delete)' })
  removeEmployee(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.softDeleteEmployee(tenant.id, id);
  }

  // ── Payroll ────────────────────────────────────────────────────────────────

  @Get('payroll')
  @RequireRole('manager')
  @ApiOperation({ summary: 'List payroll entries (restricted to manager+)' })
  listPayroll(
    @CurrentTenant() tenant: { id: string },
    @Query('employee_id') employee_id?: string,
    @Query('reference_month') referenceMonth?: string,
    /** CZ-030: deprecated alias of `reference_month` (deploy-skew window). */
    @Query('competencia') legacyReferenceMonth?: string,
    @Query('status') status?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listPayroll(tenant.id, {
      employee_id,
      reference_month: referenceMonth ?? legacyReferenceMonth,
      status,
      offset: offset ? +offset : undefined,
      limit:  limit  ? +limit  : undefined,
    });
  }

  @Post('payroll')
  @RequireRole('manager')
  @UseInterceptors(IdempotencyInterceptor)
  @Audit('payroll.created')
  @ApiOperation({ summary: 'Post a payroll entry' })
  @ApiHeader({ name: 'X-Idempotency-Key', description: 'Unique UUID per operation — prevents duplicate posting (double payment) on double click/retry', required: false })
  createPayroll(
    @CurrentTenant() tenant: { id: string },
    @Body() dto: CreatePayrollEntryDto,
  ) {
    return this.svc.createPayroll(tenant.id, dto);
  }

  // ── Leave Requests ─────────────────────────────────────────────────────────

  @Get('leave-requests')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'List leave requests' })
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
  @ApiOperation({ summary: 'Create a leave request' })
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
  @ApiOperation({ summary: 'Approve a leave request (manager+)' })
  approveLeaveRequest(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.approveLeaveRequest(tenant.id, id, user.userId);
  }
}
