// src/modules/auth/dto/reset-password.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'reset-token-123',
  })
  @IsString({
    message: 'Token must be a string',
  })
  @IsNotEmpty({
    message: 'Reset token is required',
  })
  @MaxLength(500, {
    message: 'Reset token must not exceed 500 characters',
  })
  token!: string;

  @ApiProperty({
    example: 'NewPassword@123',
  })
  @IsString({
    message: 'Password must be a string',
  })
  @IsNotEmpty({
    message: 'New password is required',
  })
  @MinLength(12, {
    message: 'Password must be at least 12 characters long',
  })
  @MaxLength(100, {
    message: 'Password must not exceed 100 characters',
  })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,100}$/,
    {
      message:
        'Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number and 1 special character (@$!%*?&)',
    },
  )
  newPassword!: string;
}
