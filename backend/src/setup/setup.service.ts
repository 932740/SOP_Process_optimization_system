import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../auth/entities/user.entity';
import { AiModel } from '../ai-model/entities/ai-model.entity';
import * as crypto from 'crypto';

@Injectable()
export class SetupService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(AiModel)
    private aiModelRepo: Repository<AiModel>,
  ) {}

  async isInitialized(): Promise<boolean> {
    const admin = await this.userRepo.findOne({ where: { role: UserRole.SUPER_ADMIN } });
    return !!admin;
  }

  async initialize(data: {
    adminUsername: string;
    adminPassword: string;
    aiModels?: any[];
  }) {
    const passwordHash = crypto.createHash('sha256').update(data.adminPassword).digest('hex');
    const admin = this.userRepo.create({
      username: data.adminUsername,
      password_hash: passwordHash,
      name: '系统管理员',
      department: 'IT部',
      role: UserRole.SUPER_ADMIN,
      status: 1,
    });
    await this.userRepo.save(admin);

    if (data.aiModels && data.aiModels.length > 0) {
      for (const model of data.aiModels) {
        const aiModel = this.aiModelRepo.create(model);
        await this.aiModelRepo.save(aiModel);
      }
    }

    return { success: true };
  }
}
