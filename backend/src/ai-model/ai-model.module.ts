import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModelService } from './ai-model.service';
import { AiModelController } from './ai-model.controller';
import { AiModel } from './entities/ai-model.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AiModel])],
  providers: [AiModelService],
  controllers: [AiModelController],
  exports: [AiModelService],
})
export class AiModelModule {}
