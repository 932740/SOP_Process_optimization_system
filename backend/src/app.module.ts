import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { OperationLog } from './log/entities/operation-log.entity';
import { SopModule } from './sop/sop.module';
import { AiModelModule } from './ai-model/ai-model.module';
import { ExportModule } from './export/export.module';
import { AdminModule } from './admin/admin.module';
import { LogModule } from './log/log.module';
import { CommonModule } from './common/common.module';
import { SetupModule } from './setup/setup.module';
import { AnonymousUserInterceptor } from './common/interceptors/anonymous-user.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: '/app/data/sop.db',
      autoLoadEntities: true,
      synchronize: true,
    }),
    TypeOrmModule.forFeature([OperationLog]),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'frontend', 'dist'),
      exclude: ['/api*'],
    }),
    SetupModule,
    CommonModule,
    AuthModule,
    SopModule,
    AiModelModule,
    ExportModule,
    AdminModule,
    LogModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AnonymousUserInterceptor,
    },
  ],
})
export class AppModule {}
