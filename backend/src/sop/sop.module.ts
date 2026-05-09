import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SopService } from './sop.service';
import { SopController } from './sop.controller';
import { AiOptimizeController } from './ai-optimize.controller';
import { SopDocument } from './entities/sop-document.entity';
import { SopStep } from './entities/sop-step.entity';
import { SopVersion } from './entities/sop-version.entity';
import { AiModelModule } from '../ai-model/ai-model.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SopDocument, SopStep, SopVersion]),
    HttpModule,
    AiModelModule,
  ],
  providers: [SopService],
  controllers: [SopController, AiOptimizeController],
  exports: [SopService],
})
export class SopModule {}
