// src/modules/audit/entities/audit-log.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../auth/entities/user.entity';

export enum AuditAction {
  // Auth
  LOGIN = 'login',
  LOGOUT = 'logout',
  REGISTER = 'register',
  PASSWORD_CHANGE = 'password_change',
  PASSWORD_RESET = 'password_reset',

  // Users
  USER_CREATE = 'user_create',
  USER_UPDATE = 'user_update',
  USER_DELETE = 'user_delete',
  USER_RESTORE = 'user_restore',
  USER_PERMANENT_DELETE = 'user_permanent_delete',
  USER_ROLE_CHANGE = 'user_role_change',

  // Containers
  CONTAINER_CREATE = 'container_create',
  CONTAINER_UPDATE = 'container_update',
  CONTAINER_DELETE = 'container_delete',
  CONTAINER_RESTORE = 'container_restore',
  CONTAINER_PERMANENT_DELETE = 'container_permanent_delete',
  CONTAINER_STATUS_CHANGE = 'container_status_change',

  // Items
  ITEM_CREATE = 'item_create',
  ITEM_UPDATE = 'item_update',
  ITEM_DELETE = 'item_delete',
  ITEM_RESTORE = 'item_restore',
  ITEM_PERMANENT_DELETE = 'item_permanent_delete',
}

export enum AuditStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
}

@Entity('audit_logs')
@Index(['userId', 'createdAt'])
@Index(['action', 'createdAt'])
export class AuditLog {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ enum: AuditAction })
  @Column({
    type: 'varchar',
    length: 50,
  })
  action!: AuditAction;

  @ApiProperty({ enum: AuditStatus })
  @Column({
    type: 'varchar',
    length: 20,
    default: AuditStatus.SUCCESS,
  })
  status!: AuditStatus;

  @ApiProperty()
  @Column({ nullable: true })
  userId?: string;

  @ApiProperty({ type: () => User })
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @ApiProperty()
  @Column({ nullable: true })
  targetId?: string;

  @ApiProperty()
  @Column({ nullable: true })
  targetType?: string;

  @ApiProperty()
  @Column({ type: 'jsonb', nullable: true })
  changes?: Record<string, any>;

  @ApiProperty()
  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    ip?: string;
    userAgent?: string;
    method?: string;
    url?: string;
    statusCode?: number;
    duration?: number;
  };

  @ApiProperty()
  @Column({ nullable: true })
  errorMessage?: string;

  @ApiProperty()
  @CreateDateColumn()
  createdAt!: Date;

  constructor(partial: Partial<AuditLog>) {
    Object.assign(this, partial);
  }
}