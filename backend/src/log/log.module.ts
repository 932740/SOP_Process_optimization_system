import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LogInterceptor } from './log.interceptor';
import { OperationLog } from './entities/operation-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OperationLog])],
  providers: [
    LogInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useClass: LogInterceptor,
    },
  ],
  exports: [LogInterceptor],
})
export class LogModule {}
