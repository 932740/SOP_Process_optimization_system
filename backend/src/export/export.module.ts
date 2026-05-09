import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExportService } from './export.service';
import { ExportController } from './export.controller';
import { ExportTask } from './entities/export-task.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ExportTask])],
  providers: [ExportService],
  controllers: [ExportController],
})
export class ExportModule {}
