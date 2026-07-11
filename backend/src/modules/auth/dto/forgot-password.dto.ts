// src/modules/auth/dto/forgot-password.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'user@example.com',
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
}
