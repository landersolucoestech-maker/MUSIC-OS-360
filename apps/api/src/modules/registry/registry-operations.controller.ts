import { Controller, Post, Get, Body, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { RequireRole } from '../../core/decorators/roles.decorator';
import { Audit } from '../../core/interceptors/audit.interceptor';
import type { JwtAuth } from '../../core/guards/auth.guard';
import { RegistryOperationsService } from './registry-operations.service';
import { PrepareSubmissionDto, SubmitToSocietyDto } from './dto/operations.dto';

@ApiTags('Registry · Operations') @ApiBearerAuth() @Controller('registry')
export class RegistryOperationsController {
  constructor(private readonly svc: RegistryOperationsService) {}

  // ── Validate ──────────────────────────────────────────────────────────────
  @Post('works/:workId/validate') @RequireRole('editor') @ApiOperation({ summary: 'Validate a work for registration' })
  validateWork(@CurrentTenant() t: { id: string }, @Param('workId', ParseUUIDPipe) workId: string) {
    return this.svc.validateWork(t.id, workId);
  }

  @Post('recordings/:recordingId/validate') @RequireRole('editor') @ApiOperation({ summary: 'Validate a phonogram for registration' })
  validateRecording(@CurrentTenant() t: { id: string }, @Param('recordingId', ParseUUIDPipe) recordingId: string) {
    return this.svc.validateRecording(t.id, recordingId);
  }

  // ── Prepare (validate + build payload + create submission + snapshot) ──────
  @Post('works/:workId/prepare') @RequireRole('editor') @Audit('registry.work.prepared') @ApiOperation({ summary: 'Prepare the work submission' })
  prepareWork(
    @CurrentTenant() t: { id: string },
    @CurrentUser() u: JwtAuth,
    @Param('workId', ParseUUIDPipe) workId: string,
    @Body() dto: PrepareSubmissionDto,
  ) {
    return this.svc.prepareWork(t.id, u?.userId ?? '', workId, dto);
  }

  @Post('recordings/:recordingId/prepare') @RequireRole('editor') @Audit('registry.recording.prepared') @ApiOperation({ summary: 'Prepare the phonogram submission' })
  prepareRecording(
    @CurrentTenant() t: { id: string },
    @CurrentUser() u: JwtAuth,
    @Param('recordingId', ParseUUIDPipe) recordingId: string,
    @Body() dto: PrepareSubmissionDto,
  ) {
    return this.svc.prepareRecording(t.id, u?.userId ?? '', recordingId, dto);
  }

  // ── Submit (via driver; manual stays READY with instructions) ─────────────
  @Post('works/:workId/submit') @RequireRole('editor') @Audit('registry.work.submitted') @ApiOperation({ summary: 'Submit a work to the society' })
  submitWork(
    @CurrentTenant() t: { id: string },
    @CurrentUser() u: JwtAuth,
    @Param('workId', ParseUUIDPipe) workId: string,
    @Body() dto: SubmitToSocietyDto,
  ) {
    return this.svc.submitWork(t.id, u?.userId ?? '', workId, dto);
  }

  @Post('recordings/:recordingId/submit') @RequireRole('editor') @Audit('registry.recording.submitted') @ApiOperation({ summary: 'Submit a phonogram to the society' })
  submitRecording(
    @CurrentTenant() t: { id: string },
    @CurrentUser() u: JwtAuth,
    @Param('recordingId', ParseUUIDPipe) recordingId: string,
    @Body() dto: SubmitToSocietyDto,
  ) {
    return this.svc.submitRecording(t.id, u?.userId ?? '', recordingId, dto);
  }

  // ── Payload regenerate (new immutable snapshot version) ────────────────────
  @Post('submissions/:id/payload/regenerate') @RequireRole('editor') @Audit('registry.payload.regenerated') @ApiOperation({ summary: 'Regenerate the payload snapshot' })
  regenerate(@CurrentTenant() t: { id: string }, @CurrentUser() u: JwtAuth, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.regeneratePayload(t.id, u?.userId ?? '', id);
  }

  // ── Export (read-only serialisation of the current snapshot) ───────────────
  @Get('submissions/:id/export/json') @RequireRole('viewer') @ApiOperation({ summary: 'Export the payload (JSON)' })
  async exportJson(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const out = await this.svc.exportSubmission(t.id, id, 'json');
    res.setHeader('Content-Type', out.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${out.fileName}"`);
    res.send(out.content);
  }

  @Get('submissions/:id/export/xlsx') @RequireRole('viewer') @ApiOperation({ summary: 'Export the payload (XLSX)' })
  async exportXlsx(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const out = await this.svc.exportSubmission(t.id, id, 'xlsx');
    res.setHeader('Content-Type', out.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${out.fileName}"`);
    res.send(out.content);
  }
}
