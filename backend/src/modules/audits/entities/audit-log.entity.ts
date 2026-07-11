// src/modules/audits/entities/audit-log.entity.ts

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

import { User } from '../../auth/entities/user.entity';

export enum AuditAction {
  LOGIN = 'login',
  LOGOUT = 'logout',
  REGISTER = 'register',
  PASSWORD_CHANGE = 'password_change',
  PASSWORD_RESET = 'password_reset',

  USER_CREATE = 'user_create',
  USER_UPDATE = 'user_update',
  USER_DELETE = 'user_delete',
  USER_RESTORE = 'user_restore',
  USER_PERMANENT_DELETE =
    'user_permanent_delete',
  USER_ROLE_CHANGE = 'user_role_change',

  CONTAINER_CREATE = 'container_create',
  CONTAINER_UPDATE = 'container_update',
  CONTAINER_DELETE = 'container_delete',
  CONTAINER_RESTORE = 'container_restore',
  CONTAINER_PERMANENT_DELETE =
    'container_permanent_delete',
  CONTAINER_STATUS_CHANGE =
    'container_status_change',

  ITEM_CREATE = 'item_create',
  ITEM_UPDATE = 'item_update',
  ITEM_DELETE = 'item_delete',
  ITEM_RESTORE = 'item_restore',
  ITEM_PERMANENT_DELETE =
    'item_permanent_delete',

  FILE_UPLOAD = 'file_upload',
  FILE_DELETE = 'file_delete',

  UNKNOWN = 'unknown',
}

export enum AuditStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
}

export interface AuditMetadata {
  ip?: string;
  userAgent?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
}

@Entity('audit_logs')
@Index(
  'IDX_audit_logs_user_created',
  ['userId', 'createdAt'],
)
@Index(
  'IDX_audit_logs_action_created',
  ['action', 'createdAt'],
)
@Index(
  'IDX_audit_logs_status_created',
  ['status', 'createdAt'],
)
export class AuditLog {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({
    enum: AuditAction,
  })
  @Column({
    type: 'varchar',
    length: 50,
  })
  action!: AuditAction;

  @ApiProperty({
    enum: AuditStatus,
  })
  @Column({
    type: 'varchar',
    length: 20,
    default: AuditStatus.SUCCESS,
  })
  status!: AuditStatus;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
  })
  @Column({
    type: 'uuid',
    nullable: true,
  })
  userId?: string | null;

  @ApiPropertyOptional({
    type: () => User,
    nullable: true,
  })
  @ManyToOne(
    () => User,
    {
      nullable: true,
      onDelete: 'SET NULL',
    },
  )
  @JoinColumn({
    name: 'userId',
  })
  user?: User | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
  })
  @Column({
    type: 'uuid',
    nullable: true,
  })
  targetId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
  })
  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  targetType?: string | null;

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
  })
  @Column({
    type: 'jsonb',
    nullable: true,
  })
  changes?: Record<
    string,
    unknown
  > | null;

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
  })
  @Column({
    type: 'jsonb',
    nullable: true,
  })
  metadata?: AuditMetadata | null;

  @ApiPropertyOptional({
    nullable: true,
  })
  @Column({
    type: 'text',
    nullable: true,
  })
  errorMessage?: string | null;

  @ApiProperty()
  @CreateDateColumn({
    type: 'timestamp with time zone',
  })
  createdAt!: Date;

  constructor(
    partial?: Partial<AuditLog>,
  ) {
    if (partial) {
      Object.assign(
        this,
        partial,
      );
    }
  }
}