// src/modules/auth/dto/register.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../entities/user.entity';

export class RegisterDto {
  @ApiProperty({
    example: 'johndoe',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({
    message: 'Username must be a string',
  })
  @IsNotEmpty({
    message: 'Username is required',
  })
  @MinLength(3, {
    message: 'Username must be at least 3 characters long',
  })
  @MaxLength(50, {
    message: 'Username must not exceed 50 characters',
  })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers and underscores',
  })
  username!: string;

  @ApiProperty({
    example: 'john@example.com',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail(
    {},
    {
      message: 'Please provide a valid email address',
    },
  )
  @IsNotEmpty({
    message: 'Email is required',
  })
  @MaxLength(255, {
    message: 'Email must not exceed 255 characters',
  })
  email!: string;

  @ApiProperty({
    example: 'Password@123',
  })
  @IsString({
    message: 'Password must be a string',
  })
  @IsNotEmpty({
    message: 'Password is required',
  })
  @MinLength(12, {
    message: 'Password must be at least 12 characters long',
  })
  @MaxLength(100, {
    message: 'Password must not exceed 100 characters',
  })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,100}$/, {
    message:
      'Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number and 1 special character (@$!%*?&)',
  })
  password!: string;

  @ApiPropertyOptional({
    enum: UserRole,
    default: UserRole.USER,
  })
  @IsOptional()
  @IsEnum(UserRole, {
    message: 'Invalid role. Must be one of: super_admin, admin, user',
  })
  role?: UserRole;
}
