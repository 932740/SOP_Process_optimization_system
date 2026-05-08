import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExportTask, ExportStatus } from './entities/export-task.entity';
import { RedisService } from '../common/redis.service';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class ExportService {
  constructor(
    @InjectRepository(ExportTask)
    private exportRepo: Repository<ExportTask>,
    private redisService: RedisService,
  ) {}

  async createTask(documentId: number, formatType: string, user: User) {
    const task = this.exportRepo.create({
      document_id: documentId,
      format_type: formatType,
      created_by: user.id,
      status: ExportStatus.PENDING,
    });
    const saved = await this.exportRepo.save(task);
    await this.redisService.pushQueue('export_queue', {
      taskId: saved.id,
      documentId,
      formatType,
      userId: user.id,
    });
    return saved;
  }

  async getStatus(taskId: number) {
    return this.exportRepo.findOne({ where: { id: taskId } });
  }
}
