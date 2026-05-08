import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  USER = 'user',
  ANONYMOUS = 'anonymous',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ unique: true, length: 64, nullable: true })
  union_id: string;

  @Column({ unique: true, length: 64, nullable: true })
  username: string;

  @Column({ length: 128, nullable: true })
  password_hash: string;

  @Column({ length: 64 })
  name: string;

  @Column({ length: 256, nullable: true })
  avatar: string;

  @Column({ length: 64, nullable: true })
  department: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({ type: 'tinyint', default: 1 })
  status: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
