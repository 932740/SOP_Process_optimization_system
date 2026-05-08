import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SetupService } from './setup.service';
import { SetupController } from './setup.controller';
import { User } from '../auth/entities/user.entity';
import { AiModel } from '../ai-model/entities/ai-model.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, AiModel])],
  providers: [SetupService],
  controllers: [SetupController],
})
export class SetupModule {}
