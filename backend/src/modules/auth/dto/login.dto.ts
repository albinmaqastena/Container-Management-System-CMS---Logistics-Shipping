// src/modules/auth/dto/login.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'admin@example.com',
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
    example: 'password123',
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
