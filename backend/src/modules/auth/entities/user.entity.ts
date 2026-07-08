// src/modules/auth/entities/user.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
  DeleteDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
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
  @Column({ unique: true })
  username!: string;

  @ApiProperty()
  @Column({ unique: true })
  email!: string;

  @Column()
  @Exclude()
  password!: string;

  // ✅ Password reset fields
  @Column({ nullable: true, name: 'reset_password_token' })
  @Exclude()
  resetPasswordToken?: string;

  @Column({ nullable: true, name: 'reset_password_expires' })
  @Exclude()
  resetPasswordExpires?: Date;

  // ✅ Account lock fields
  @Column({ default: 0, name: 'failed_login_attempts' })
  failedLoginAttempts!: number;

  @Column({ nullable: true, name: 'locked_until' })
  lockedUntil?: Date;

  @ApiProperty({ enum: UserRole })
  @Column({
    type: 'varchar',
    length: 50,
    default: UserRole.USER,
  })
  role!: UserRole;

  @ApiProperty()
  @Column({ default: true })
  isActive!: boolean;

  @ApiProperty()
  @Column({ nullable: true })
  lastLogin?: Date;

  @ApiProperty()
  @Column({ nullable: true })
  lastLoginIp?: string;

  @ApiProperty()
  @Column({ nullable: true })
  lastLoginUserAgent?: string;

  @ApiProperty()
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt!: Date;

  // src/modules/auth/entities/user.entity.ts - Shto nëse dëshiron soft delete për user
  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date | null;

  @OneToMany(() => Container, (container) => container.createdBy)
  containers!: Container[];

  // ============================================
  // PASSWORD HASHING (Argon2)
  // ============================================
  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    // ✅ Hash only if password is plain text (not already hashed)
    if (this.password && !this.password.startsWith('$argon2')) {
      this.password = await argon2.hash(this.password);
    }
  }

  // ============================================
  // PASSWORD VALIDATION
  // ============================================
  async validatePassword(password: string): Promise<boolean> {
    try {
      return await argon2.verify(this.password, password);
    } catch {
      return false;
    }
  }

  // ============================================
  // ACCOUNT LOCK METHODS
  // ============================================
  isLocked(): boolean {
    if (!this.lockedUntil) return false;
    return new Date() < this.lockedUntil;
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
    this.lockedUntil = undefined;
  }

  // ============================================
  // PASSWORD RESET METHODS
  // ============================================
  setResetToken(token: string, expiresInMs: number): void {
    this.resetPasswordToken = token;
    this.resetPasswordExpires = new Date(Date.now() + expiresInMs);
  }

  clearResetToken(): void {
    this.resetPasswordToken = undefined;
    this.resetPasswordExpires = undefined;
  }

  isResetTokenValid(token: string): boolean {
    return (
      this.resetPasswordToken === token &&
      this.resetPasswordExpires !== undefined &&
      this.resetPasswordExpires > new Date()
    );
  }

  // ============================================
  // CONSTRUCTOR
  // ============================================
  constructor(partial: Partial<User>) {
    Object.assign(this, partial);
  }
}