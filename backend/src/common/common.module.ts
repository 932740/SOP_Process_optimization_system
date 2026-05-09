import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';
import { MinioService } from './minio.service';
import { CryptoService } from './crypto.service';

@Global()
@Module({
  providers: [RedisService, MinioService, CryptoService],
  exports: [RedisService, MinioService, CryptoService],
})
export class CommonModule {}
