// src/modules/auth/entities/refresh-token.entity.ts

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('refresh_tokens')
@Index('IDX_refresh_tokens_user_active', ['userId', 'isActive'])
@Index('IDX_refresh_tokens_session_id', ['sessionId'])
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'varchar',
    length: 500,
    unique: true,
  })
  token!: string;

  @Column({
    name: 'user_id',
    type: 'uuid',
  })
  userId!: string;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'user_id',
  })
  user!: User;

  @Column({
    name: 'expires_at',
    type: 'timestamp with time zone',
  })
  expiresAt!: Date;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp with time zone',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp with time zone',
  })
  updatedAt!: Date;

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
  })
  isActive!: boolean;

  @Column({
    name: 'revoked_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  revokedAt!: Date | null;

  @Column({
    name: 'revoked_reason',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  revokedReason!: string | null;

  @Column({
    type: 'varchar',
    length: 45,
    nullable: true,
  })
  ip?: string | null;

  @Column({
    name: 'user_agent',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  userAgent?: string | null;

  @Column({
    name: 'session_id',
    type: 'uuid',
    nullable: true,
  })
  sessionId?: string | null;

  constructor(partial?: Partial<RefreshToken>) {
    if (partial) {
      Object.assign(this, partial);
    }
  }
}
