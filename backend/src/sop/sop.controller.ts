import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, Request,
} from '@nestjs/common';
import { SopService } from './sop.service';
import { CreateDocumentDto, UpdateDocumentDto, CreateStepDto, UpdateStepDto } from './dto';
import { DocumentStatus } from './entities/sop-document.entity';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt.guard';
import { UserRole } from '../auth/entities/user.entity';

const ANONYMOUS_USER = { id: -1, role: UserRole.USER } as any;

@Controller('sop-documents')
@UseGuards(OptionalJwtAuthGuard)
export class SopController {
  constructor(private sopService: SopService) {}

  private getUser(req: any) {
    return req.user || ANONYMOUS_USER;
  }

  @Get()
  findAll(@Request() req, @Query('status') status?: DocumentStatus) {
    return this.sopService.findAll(this.getUser(req), status);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.sopService.findOne(+id, this.getUser(req));
  }

  @Post()
  create(@Body() dto: CreateDocumentDto, @Request() req) {
    return this.sopService.create(dto, this.getUser(req));
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDocumentDto, @Request() req) {
    return this.sopService.update(+id, dto, this.getUser(req));
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.sopService.remove(+id, this.getUser(req));
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @Request() req) {
    return this.sopService.submit(+id, this.getUser(req));
  }

  @Post(':id/steps')
  createStep(@Param('id') id: string, @Body() dto: CreateStepDto, @Request() req) {
    return this.sopService.createStep(+id, dto, this.getUser(req));
  }

  @Put('steps/:stepId')
  updateStep(@Param('stepId') stepId: string, @Body() dto: UpdateStepDto, @Request() req) {
    return this.sopService.updateStep(+stepId, dto, this.getUser(req));
  }

  @Delete('steps/:stepId')
  removeStep(@Param('stepId') stepId: string, @Request() req) {
    return this.sopService.removeStep(+stepId, this.getUser(req));
  }
}
