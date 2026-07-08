// src/modules/auth/entities/refresh-token.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  token!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'expires_at' })
  expiresAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ default: true, name: 'is_active' })
  isActive!: boolean;

  @Column({ nullable: true, name: 'revoked_at' })
  revokedAt!: Date;

  @Column({ nullable: true, name: 'revoked_reason' })
  revokedReason!: string;

  constructor(partial: Partial<RefreshToken>) {
    Object.assign(this, partial);
  }
}