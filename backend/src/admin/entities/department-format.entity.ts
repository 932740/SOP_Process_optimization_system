import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('department_formats')
export class DepartmentFormat {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ length: 32, unique: true })
  department_code: string;

  @Column({ length: 64 })
  department_name: string;

  @Column({ type: 'json' })
  available_formats: string[];

  @Column({ length: 16, default: 'pdf' })
  default_format: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
