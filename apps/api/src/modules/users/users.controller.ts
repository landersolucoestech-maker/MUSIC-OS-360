import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser }   from '../../core/decorators/current-user.decorator';
import { CurrentMember } from '../../core/decorators/current-member.decorator';
import { RequireRole }   from '../../core/decorators/roles.decorator';
import { Audit }         from '../../core/interceptors/audit.interceptor';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, AssignRoleDto, SetStatusDto, QueryUserDto, InviteUserDto } from './dto/users.dto';

@ApiTags('Users') @ApiBearerAuth() @Controller('users')
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Get()    @RequireRole('manager') @ApiOperation({ summary: 'Listar utilizadores' })
  list(@CurrentTenant() t: { id: string }, @Query() q: QueryUserDto) { return this.svc.list(t.id, q); }

  @Post() @RequireRole('owner') @Audit('user.created') @ApiOperation({ summary: 'Criar utilizador' })
  create(
    @CurrentTenant() t: { id: string },
    @CurrentUser() u: { userId: string },
    @CurrentMember() member: { role?: string } | undefined,
    @Body() dto: CreateUserDto,
  ) { return this.svc.create(t.id, dto, u.userId, member?.role); }

  @Post('invitations') @RequireRole('admin') @Audit('user.invited') @ApiOperation({ summary: 'Convidar utilizador por email' })
  invite(
    @CurrentTenant() t: { id: string },
    @CurrentUser() u: { userId: string },
    @CurrentMember() member: { role?: string } | undefined,
    @Body() dto: InviteUserDto,
  ) {
    return this.svc.invite(t.id, dto.email, dto.roleId, u.userId, member?.role);
  }

  @Get('invitations') @RequireRole('admin') @ApiOperation({ summary: 'Listar convites do tenant' })
  invitations(@CurrentTenant() t: { id: string }) {
    return this.svc.listInvitations(t.id);
  }

  @Post('invitations/:id/resend') @RequireRole('admin') @Audit('user.invitation_resent')
  resendInvitation(
    @CurrentTenant() t: { id: string },
    @CurrentUser() u: { userId: string },
    @CurrentMember() member: { role?: string } | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.resendInvitation(t.id, id, u.userId, member?.role);
  }

  @Delete('invitations/:id') @RequireRole('admin') @Audit('user.invitation_cancelled')
  cancelInvitation(
    @CurrentTenant() t: { id: string },
    @CurrentMember() member: { role?: string } | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.cancelInvitation(t.id, id, member?.role);
  }

  @Get(':id') @RequireRole('manager') @ApiOperation({ summary: 'Obter utilizador' })
  findById(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findById(t.id, id);
  }

  @Patch(':id') @RequireRole('manager') @Audit('user.updated') @ApiOperation({ summary: 'Atualizar utilizador' })
  update(@CurrentTenant() t: { id: string }, @CurrentUser() _u: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) { return this.svc.update(t.id, id, dto); }

  @Patch(':id/role') @RequireRole('admin') @Audit('user.role_changed') @ApiOperation({ summary: 'Alterar role do utilizador respeitando hierarquia' })
  assignRole(
    @CurrentTenant() t: { id: string },
    @CurrentMember() member: { role?: string } | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRoleDto,
  ) { return this.svc.assignRole(t.id, id, dto.role, member?.role, dto.expectedUpdatedAt); }

  @Patch(':id/status') @RequireRole('owner') @Audit('user.status_changed') @ApiOperation({ summary: 'Activar/desactivar/suspender utilizador (protege o último owner)' })
  setStatus(
    @CurrentTenant() t: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetStatusDto,
  ) { return this.svc.setStatus(t.id, id, dto.status, dto.expectedUpdatedAt); }

  @Delete(':id') @RequireRole('owner') @Audit('user.deleted') @ApiOperation({ summary: 'Desactivar utilizador' })
  remove(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(t.id, id); }
}
