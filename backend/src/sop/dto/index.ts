import { IsString, IsOptional, IsInt, IsArray, IsEnum } from 'class-validator';
import { DocumentStatus } from '../entities/sop-document.entity';

export class CreateDocumentDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  doc_type?: string;
}

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  doc_type?: string;
}

export class CreateStepDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  image_urls?: string[];
}

export class UpdateStepDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  image_urls?: string[];

  @IsOptional()
  @IsString()
  ai_optimized_desc?: string;

  @IsOptional()
  @IsString()
  optimization_type?: string;

  @IsOptional()
  ai_model_id?: number;
}
