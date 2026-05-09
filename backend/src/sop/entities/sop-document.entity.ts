import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { SopStep } from './sop-step.entity';
import { User } from '../../auth/entities/user.entity';

export enum DocumentStatus {
  DRAFT = 'draft',
  COMPLETED = 'completed',
}

@Entity('sop_documents')
export class SopDocument {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ length: 32, unique: true, nullable: true })
  doc_no: string;

  @Column({ length: 128 })
  title: string;

  @Column({ length: 32, nullable: true })
  doc_type: string;

  @Column({
    type: 'enum',
    enum: DocumentStatus,
    default: DocumentStatus.DRAFT,
  })
  status: DocumentStatus;

  @Column()
  created_by: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  submitted_at: Date;

  @Column({ default: 1 })
  current_version: number;

  @OneToMany(() => SopStep, step => step.document, { cascade: true })
  steps: SopStep[];

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;
}
