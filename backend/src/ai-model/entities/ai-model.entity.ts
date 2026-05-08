import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('ai_models')
export class AiModel {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ length: 64 })
  name: string;

  @Column({ length: 32 })
  provider: string;

  @Column({ length: 256 })
  api_base_url: string;

  @Column({ length: 512, nullable: true })
  api_key: string;

  @Column({ length: 64 })
  model_name: string;

  @Column({ type: 'tinyint', default: 0 })
  is_default: number;

  @Column({ type: 'tinyint', default: 1 })
  is_active: number;

  @Column({ type: 'json', nullable: true })
  capabilities: string[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
