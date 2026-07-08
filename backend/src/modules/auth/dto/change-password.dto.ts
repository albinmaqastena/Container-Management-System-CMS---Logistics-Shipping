// src/modules/auth/dto/change-password.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, MaxLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'oldPassword123' })
  @IsString({ message: 'Current password must be a string' })
  @IsNotEmpty({ message: 'Current password is required' })
  @MinLength(6, { message: 'Current password must be at least 6 characters' })
  @MaxLength(100, { message: 'Current password must not exceed 100 characters' })
  currentPassword!: string;

  @ApiProperty({ example: 'NewPassword@123' })
  @IsString({ message: 'New password must be a string' })
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(12, { message: 'New password must be at least 12 characters long' })
  @MaxLength(100, { message: 'New password must not exceed 100 characters' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/,
    {
      message:
        'Password must contain at least: 1 uppercase, 1 lowercase, 1 number, and 1 special character (@$!%*?&)',
    },
  )
  newPassword!: string;
}