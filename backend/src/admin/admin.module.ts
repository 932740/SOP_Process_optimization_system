import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { User } from '../auth/entities/user.entity';
import { DepartmentFormat } from './entities/department-format.entity';
import { OperationLog } from '../log/entities/operation-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, DepartmentFormat, OperationLog])],
  controllers: [AdminController],
})
export class AdminModule {}
