import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { RequirePermission } from '../../core/decorators/permissions.decorator';
import { RequireRole } from '../../core/decorators/roles.decorator';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Audit } from '../../core/interceptors/audit.interceptor';
import type { JwtAuth } from '../../core/guards/auth.guard';
import { ContactsService } from './contacts.service';

/**
 * /contacts — compatibility endpoint. Delegates entirely to
 * ClientsService via ContactsService (facade); see the comment there for the
 * why. New code must use /clients directly.
 */
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @RequireRole('viewer')
  @RequirePermission('contact:read')
  list(@CurrentTenant() tenant: { id: string }) {
    return this.contactsService.list(tenant.id);
  }

  @Get(':id')
  @RequireRole('viewer')
  @RequirePermission('contact:read')
  getById(@CurrentTenant() tenant: { id: string }, @Param('id') id: string) {
    return this.contactsService.getById(tenant.id, id);
  }

  @Post()
  @RequireRole('editor')
  @RequirePermission('contact:create')
  create(@CurrentTenant() tenant: { id: string }, @CurrentUser() u: JwtAuth, @Body() payload: Record<string, unknown>) {
    return this.contactsService.create(tenant.id, payload, u?.userId);
  }

  @Patch(':id')
  @RequireRole('editor')
  @RequirePermission('contact:update')
  update(@CurrentTenant() tenant: { id: string }, @CurrentUser() u: JwtAuth, @Param('id') id: string, @Body() payload: Record<string, unknown>) {
    return this.contactsService.update(tenant.id, id, payload, u?.userId);
  }

  @Delete(':id')
  @RequireRole('manager')
  @RequirePermission('contact:delete')
  @Audit('contact.deleted')
  remove(@CurrentTenant() tenant: { id: string }, @CurrentUser() u: JwtAuth, @Param('id') id: string) {
    return this.contactsService.remove(tenant.id, id, u?.userId);
  }
}
