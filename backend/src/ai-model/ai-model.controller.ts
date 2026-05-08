import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { AiModelService } from './ai-model.service';

@Controller('admin/ai-models')
export class AiModelController {
  constructor(private aiModelService: AiModelService) {}

  @Get()
  findAll() {
    return this.aiModelService.findAll();
  }

  @Get('active')
  findActive() {
    return this.aiModelService.findActive();
  }

  @Post()
  create(@Body() dto: any) {
    return this.aiModelService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.aiModelService.update(+id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.aiModelService.remove(+id);
  }
}
