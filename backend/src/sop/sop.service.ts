import { Injectable, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SopDocument, DocumentStatus } from './entities/sop-document.entity';
import { SopStep } from './entities/sop-step.entity';
import { SopVersion } from './entities/sop-version.entity';
import { User, UserRole } from '../auth/entities/user.entity';
import { CreateDocumentDto, UpdateDocumentDto, CreateStepDto, UpdateStepDto } from './dto';

@Injectable()
export class SopService {
  constructor(
    @InjectRepository(SopDocument)
    private docRepo: Repository<SopDocument>,
    @InjectRepository(SopStep)
    private stepRepo: Repository<SopStep>,
    @InjectRepository(SopVersion)
    private versionRepo: Repository<SopVersion>,
  ) {}

  private isAnonymous(user: User) {
    return user.id === -1;
  }

  async findAll(user: User, status?: DocumentStatus) {
    const where: any = {};
    if (user.role !== UserRole.SUPER_ADMIN && !this.isAnonymous(user)) {
      where.created_by = user.id;
    }
    if (status) {
      where.status = status;
    }
    return this.docRepo.find({
      where,
      relations: ['creator'],
      order: { updated_at: 'DESC' },
    });
  }

  async findOne(id: number, user: User) {
    const doc = await this.docRepo.findOne({
      where: { id },
      relations: ['steps', 'creator'],
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (user.role !== UserRole.SUPER_ADMIN && !this.isAnonymous(user) && doc.created_by !== user.id) {
      throw new ForbiddenException('No permission');
    }
    return doc;
  }

  async create(dto: CreateDocumentDto, user: User) {
    const doc = this.docRepo.create({
      ...dto,
      doc_no: `SOP-${Date.now()}`,
      created_by: user.id,
      status: DocumentStatus.DRAFT,
    });
    return this.docRepo.save(doc);
  }

  async update(id: number, dto: UpdateDocumentDto, user: User) {
    const doc = await this.findOne(id, user);
    if (doc.status === DocumentStatus.COMPLETED) {
      throw new BadRequestException('Completed document cannot be modified');
    }
    Object.assign(doc, dto);
    return this.docRepo.save(doc);
  }

  async remove(id: number, user: User) {
    if (this.isAnonymous(user) || user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only admin can delete documents');
    }
    const doc = await this.findOne(id, user);
    return this.docRepo.remove(doc);
  }

  async submit(id: number, user: User) {
    const doc = await this.findOne(id, user);
    if (doc.status === DocumentStatus.COMPLETED) {
      throw new BadRequestException('Document already completed');
    }

    const steps = await this.stepRepo.find({ where: { document_id: id } });
    if (!steps.length) {
      throw new BadRequestException('At least one step is required');
    }
    for (const step of steps) {
      if (!step.description && !step.ai_optimized_desc) {
        throw new BadRequestException(`Step ${step.step_no} description is empty`);
      }
    }

    // Create version snapshot
    const snapshot = {
      document: { ...doc, steps: undefined },
      steps: steps.map(s => ({
        ...s,
        final_description: s.ai_optimized_desc || s.description,
      })),
    };
    const version = this.versionRepo.create({
      document_id: id,
      version_no: doc.current_version,
      snapshot,
    });
    await this.versionRepo.save(version);

    doc.status = DocumentStatus.COMPLETED;
    doc.submitted_at = new Date();
    doc.current_version += 1;
    return this.docRepo.save(doc);
  }

  async createStep(documentId: number, dto: CreateStepDto, user: User) {
    await this.findOne(documentId, user); // verify access
    const maxStep = await this.stepRepo.findOne({
      where: { document_id: documentId },
      order: { step_no: 'DESC' },
    });
    const step = this.stepRepo.create({
      ...dto,
      document_id: documentId,
      step_no: (maxStep?.step_no || 0) + 1,
    });
    return this.stepRepo.save(step);
  }

  async updateStep(stepId: number, dto: UpdateStepDto, user: User) {
    const step = await this.stepRepo.findOne({ where: { id: stepId }, relations: ['document'] });
    if (!step) throw new NotFoundException('Step not found');
    await this.findOne(step.document_id, user); // verify access and status
    if (step.document.status === DocumentStatus.COMPLETED) {
      throw new BadRequestException('Completed document cannot be modified');
    }
    Object.assign(step, dto);
    return this.stepRepo.save(step);
  }

  async removeStep(stepId: number, user: User) {
    const step = await this.stepRepo.findOne({ where: { id: stepId }, relations: ['document'] });
    if (!step) throw new NotFoundException('Step not found');
    await this.findOne(step.document_id, user);
    if (step.document.status === DocumentStatus.COMPLETED) {
      throw new BadRequestException('Completed document cannot be modified');
    }
    return this.stepRepo.remove(step);
  }
}
