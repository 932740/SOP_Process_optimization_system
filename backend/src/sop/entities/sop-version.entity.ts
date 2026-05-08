import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { SopDocument } from './sop-document.entity';

@Entity('sop_versions')
export class SopVersion {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column()
  document_id: number;

  @Column()
  version_no: number;

  @Column({ type: 'json' })
  snapshot: any;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => SopDocument)
  @JoinColumn({ name: 'document_id' })
  document: SopDocument;
}
