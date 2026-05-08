import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export enum ExportStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  DONE = 'done',
  FAILED = 'failed',
}

@Entity('export_tasks')
export class ExportTask {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column()
  document_id: number;

  @Column({ length: 16 })
  format_type: string;

  @Column({
    type: 'enum',
    enum: ExportStatus,
    default: ExportStatus.PENDING,
  })
  status: ExportStatus;

  @Column({ length: 512, nullable: true })
  file_url: string;

  @Column({ type: 'text', nullable: true })
  error_msg: string;

  @Column()
  created_by: number;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date;
}
