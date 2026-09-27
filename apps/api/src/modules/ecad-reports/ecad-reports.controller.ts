import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant }        from '../../core/decorators/current-tenant.decorator';
import { CurrentUser }          from '../../core/decorators/current-user.decorator';
import { RequireRole }          from '../../core/decorators/roles.decorator';
import { EcadReportsService }   from './ecad-reports.service';
import { CreateEcadReportDto }  from './dto/create-ecad-report.dto';
import { UpdateEcadReportDto }  from './dto/update-ecad-report.dto';

@ApiTags('EcadReports')
@ApiBearerAuth()
@Controller('ecad-reports')
export class EcadReportsController {
  constructor(private readonly svc: EcadReportsService) {}

  @Get()
  @RequireRole('manager')
  @ApiOperation({ summary: 'List ECAD reports (manager+)' })
  list(
    @CurrentTenant() tenant: { id: string },
    @Query('periodo') periodo?: string,
    @Query('status') status?: string,
    @Query('work_id') work_id?: string,
    @Query('ascending') ascending?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.list(tenant.id, {
      periodo,
      status,
      work_id,
      ascending: ascending === 'true',
      offset: offset ? +offset : undefined,
      limit:  limit  ? +limit  : undefined,
    });
  }

  @Get(':id')
  @RequireRole('manager')
  @ApiOperation({ summary: 'Get an ECAD report by ID' })
  findOne(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.findById(tenant.id, id);
  }

  @Post()
  @RequireRole('manager')
  @ApiOperation({ summary: 'Create an ECAD report' })
  create(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateEcadReportDto,
  ) {
    return this.svc.create(tenant.id, user.userId, dto);
  }

  @Patch(':id')
  @RequireRole('manager')
  @ApiOperation({ summary: 'Update an ECAD report' })
  update(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEcadReportDto,
  ) {
    return this.svc.update(tenant.id, id, dto);
  }

  @Delete(':id')
  @RequireRole('admin')
  @ApiOperation({ summary: 'Remove an ECAD report (admin+)' })
  remove(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.remove(tenant.id, id);
  }
}
