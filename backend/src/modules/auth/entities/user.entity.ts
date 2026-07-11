// src/modules/auth/entities/user.entity.ts

import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiHideProperty, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import * as argon2 from 'argon2';
import { Container } from '../../containers/entities/container.entity';

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  USER = 'user',
}

@Entity('users')
export class User {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty()
  @Column({
    type: 'varchar',
    length: 50,
    unique: true,
  })
  username!: string;

  @ApiProperty()
  @Column({
    type: 'varchar',
    length: 255,
    unique: true,
  })
  email!: string;

  @ApiHideProperty()
  @Column({
    type: 'varchar',
    length: 255,
  })
  @Exclude()
  password!: string;

  @ApiHideProperty()
  @Column({
    name: 'reset_password_token',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  @Exclude()
  resetPasswordToken?: string | null;

  @ApiHideProperty()
  @Column({
    name: 'reset_password_expires',
    type: 'timestamp with time zone',
    nullable: true,
  })
  @Exclude()
  resetPasswordExpires?: Date | null;

  @ApiHideProperty()
  @Column({
    name: 'failed_login_attempts',
    type: 'integer',
    default: 0,
  })
  failedLoginAttempts!: number;

  @ApiHideProperty()
  @Column({
    name: 'locked_until',
    type: 'timestamp with time zone',
    nullable: true,
  })
  lockedUntil?: Date | null;

  @ApiProperty({
    enum: UserRole,
  })
  @Column({
    type: 'varchar',
    length: 50,
    default: UserRole.USER,
  })
  role!: UserRole;

  @ApiProperty()
  @Column({
    type: 'boolean',
    default: true,
  })
  isActive!: boolean;

  @ApiPropertyOptional()
  @Column({
    type: 'timestamp with time zone',
    nullable: true,
  })
  lastLogin?: Date | null;

  @ApiPropertyOptional()
  @Column({
    type: 'varchar',
    length: 45,
    nullable: true,
  })
  lastLoginIp?: string | null;

  @ApiPropertyOptional()
  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  lastLoginUserAgent?: string | null;

  @ApiProperty()
  @CreateDateColumn({
    type: 'timestamp with time zone',
  })
  createdAt!: Date;

  @ApiProperty()
  @UpdateDateColumn({
    type: 'timestamp with time zone',
  })
  updatedAt!: Date;

  @ApiPropertyOptional()
  @DeleteDateColumn({
    type: 'timestamp with time zone',
    nullable: true,
  })
  deletedAt?: Date | null;

  @OneToMany(() => Container, (container) => container.createdBy)
  containers!: Container[];

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword(): Promise<void> {
    if (this.password && !this.password.startsWith('$argon2')) {
      this.password = await argon2.hash(this.password);
    }
  }

  async validatePassword(password: string): Promise<boolean> {
    try {
      return await argon2.verify(this.password, password);
    } catch {
      return false;
    }
  }

  isLocked(): boolean {
    return Boolean(this.lockedUntil && this.lockedUntil.getTime() > Date.now());
  }

  lockAccount(durationMs: number): void {
    this.lockedUntil = new Date(Date.now() + durationMs);
    this.failedLoginAttempts = 0;
  }

  incrementFailedAttempts(): void {
    this.failedLoginAttempts += 1;
  }

  resetFailedAttempts(): void {
    this.failedLoginAttempts = 0;
    this.lockedUntil = null;
  }

  setResetToken(token: string, expiresInMs: number): void {
    this.resetPasswordToken = token;
    this.resetPasswordExpires = new Date(Date.now() + expiresInMs);
  }

  clearResetToken(): void {
    this.resetPasswordToken = null;
    this.resetPasswordExpires = null;
  }

  isResetTokenValid(token: string): boolean {
    return Boolean(
      this.resetPasswordToken === token &&
      this.resetPasswordExpires &&
      this.resetPasswordExpires.getTime() > Date.now(),
    );
  }

  constructor(partial?: Partial<User>) {
    if (partial) {
      Object.assign(this, partial);
    }
  }
}
