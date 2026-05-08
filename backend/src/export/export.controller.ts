import { Controller, Post, Get, Body, Param, Request, UseGuards } from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt.guard';
import { ExportService } from './export.service';

@Controller('exports')
@UseGuards(OptionalJwtAuthGuard)
export class ExportController {
  constructor(private exportService: ExportService) {}

  @Post()
  create(@Body() dto: { documentId: number; formatType: string }, @Request() req) {
    return this.exportService.createTask(dto.documentId, dto.formatType, req.user);
  }

  @Get(':id/status')
  getStatus(@Param('id') id: string) {
    return this.exportService.getStatus(+id);
  }
}
