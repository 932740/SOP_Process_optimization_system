import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('operation_logs')
export class OperationLog {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'bigint', nullable: true })
  user_id: number;

  @Column({ length: 32 })
  action: string;

  @Column({ length: 32, nullable: true })
  target_type: string;

  @Column({ type: 'bigint', nullable: true })
  target_id: number;

  @Column({ type: 'json', nullable: true })
  detail: any;

  @Column({ length: 64, nullable: true })
  ip: string;

  @Column({ length: 256, nullable: true })
  user_agent: string;

  @CreateDateColumn()
  created_at: Date;
}
