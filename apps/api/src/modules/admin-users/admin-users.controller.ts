import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RequireRole } from '../../core/decorators/roles.decorator';
import { AdminUsersService } from './admin-users.service';
import { AdminUsersQueryDto } from './dto/admin-users.dto';

@ApiTags('AdminUsers') @ApiBearerAuth() @Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly svc: AdminUsersService) {}

  @Get() @RequireRole('super_admin')
  @ApiOperation({ summary: 'List real cross-tenant users with role/MFA/last login (super_admin)' })
  list(@Query() query: AdminUsersQueryDto) {
    return this.svc.list(query);
  }
}
