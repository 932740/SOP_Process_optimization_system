import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { SopDocument } from './sop-document.entity';

@Entity('sop_steps')
export class SopStep {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column()
  document_id: number;

  @Column()
  step_no: number;

  @Column({ length: 128, nullable: true })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'json', nullable: true })
  image_urls: string[];

  @Column({ type: 'text', nullable: true })
  ai_optimized_desc: string;

  @Column({ length: 32, nullable: true })
  optimization_type: string;

  @Column({ type: 'bigint', nullable: true })
  ai_model_id: number;

  @Column({ length: 32, default: 'normal' })
  status: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => SopDocument, doc => doc.steps)
  @JoinColumn({ name: 'document_id' })
  document: SopDocument;
}
