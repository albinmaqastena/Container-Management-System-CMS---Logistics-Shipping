// src/modules/auth/dto/login.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

const normalizeEmail = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().toLowerCase();
};

export class LoginDto {
  @ApiProperty({
    example: 'admin@example.com',
  })
  @Transform(({ value }: { value: unknown }): unknown => normalizeEmail(value), {
    toClassOnly: true,
  })
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
    example: 'Admin@123',
  })
  @IsString({
    message: 'Password must be a string',
  })
  @IsNotEmpty({
    message: 'Password is required',
  })
  @MinLength(6, {
    message: 'Password must be at least 6 characters long',
  })
  @MaxLength(100, {
    message: 'Password must not exceed 100 characters',
  })
  password!: string;
}
