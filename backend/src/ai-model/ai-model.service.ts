import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiModel } from './entities/ai-model.entity';
import { CryptoService } from '../common/crypto.service';

@Injectable()
export class AiModelService {
  constructor(
    @InjectRepository(AiModel)
    private modelRepo: Repository<AiModel>,
    private cryptoService: CryptoService,
  ) {}

  async findAll() {
    return this.modelRepo.find({ order: { created_at: 'DESC' } });
  }

  async findActive() {
    return this.modelRepo.find({ where: { is_active: 1 } });
  }

  async findOne(id: number) {
    return this.modelRepo.findOne({ where: { id } });
  }

  async create(data: Partial<AiModel>) {
    if (data.api_key) {
      data.api_key = this.cryptoService.encrypt(data.api_key);
    }
    if (data.is_default) {
      await this.modelRepo.update({}, { is_default: 0 });
    }
    const model = this.modelRepo.create(data);
    return this.modelRepo.save(model);
  }

  async update(id: number, data: Partial<AiModel>) {
    if (data.api_key) {
      data.api_key = this.cryptoService.encrypt(data.api_key);
    }
    if (data.is_default) {
      await this.modelRepo.update({}, { is_default: 0 });
    }
    await this.modelRepo.update(id, data);
    return this.findOne(id);
  }

  async remove(id: number) {
    return this.modelRepo.delete(id);
  }

  decryptKey(model: AiModel): string {
    if (!model.api_key) return '';
    return this.cryptoService.decrypt(model.api_key);
  }
}
