import { Controller, Post, Param, Body, Request, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SopStep } from './entities/sop-step.entity';
import { SopDocument, DocumentStatus } from './entities/sop-document.entity';
import { AiModelService } from '../ai-model/ai-model.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt.guard';

@Controller('steps/:stepId/ai-optimize')
@UseGuards(OptionalJwtAuthGuard)
export class AiOptimizeController {
  constructor(
    @InjectRepository(SopStep)
    private stepRepo: Repository<SopStep>,
    @InjectRepository(SopDocument)
    private docRepo: Repository<SopDocument>,
    private aiModelService: AiModelService,
    private httpService: HttpService,
    private configService: ConfigService,
  ) {}

  @Post()
  async optimize(
    @Param('stepId') stepId: string,
    @Body() dto: { modelId?: number; optimizationType: string; customPrompt?: string },
    @Request() req,
  ) {
    const step = await this.stepRepo.findOne({
      where: { id: +stepId },
      relations: ['document'],
    });
    if (!step) throw new Error('Step not found');
    if (step.document.status === DocumentStatus.COMPLETED) {
      throw new Error('Completed document cannot be optimized');
    }

    // Get AI model
    let model;
    if (dto.modelId) {
      model = await this.aiModelService.findOne(dto.modelId);
    } else {
      const models = await this.aiModelService.findActive();
      model = models.find(m => m.is_default) || models[0];
    }
    if (!model) throw new Error('No active AI model configured');

    const apiKey = this.aiModelService.decryptKey(model);
    if (!apiKey) throw new Error('AI模型API Key未配置，请先在后台管理中添加API Key');

    // Build prompt
    const prompt = this.buildPrompt(step, dto.optimizationType, dto.customPrompt);

    // Call AI service
    const aiServiceUrl = this.configService.get('AI_SERVICE_URL') || 'http://localhost:8000';
    const response = await firstValueFrom(
      this.httpService.post(`${aiServiceUrl}/ai/optimize`, {
        provider: model.provider,
        api_base_url: model.api_base_url,
        api_key: apiKey,
        model_name: model.model_name,
        prompt,
        image_urls: step.image_urls || [],
        optimization_type: dto.optimizationType,
      }),
    );

    const optimizedText = response.data.result;

    // Update step
    step.ai_optimized_desc = optimizedText;
    step.optimization_type = dto.optimizationType;
    step.ai_model_id = model.id;
    await this.stepRepo.save(step);

    return { result: optimizedText, model: model.name };
  }

  private buildPrompt(step: SopStep, type: string, customPrompt?: string): string {
    let prompt = `请优化以下SOP步骤描述。`;
    if (type === 'text_polish') {
      prompt += `优化类型：文字润色（修正语法、标准化术语、提升可读性）。`;
    } else if (type === 'image_completion') {
      prompt += `优化类型：图片理解补全（根据步骤相关图片补充完善描述）。`;
    } else if (type === 'checkpoint_supplement') {
      prompt += `优化类型：规范检查点补充（添加安全注意事项、质量检查点）。`;
    }
    prompt += `\n\n原始描述：${step.description || ''}\n\n步骤标题：${step.title || ''}`;
    if (customPrompt) {
      prompt += `\n\n额外要求：${customPrompt}`;
    }
    return prompt;
  }
}
