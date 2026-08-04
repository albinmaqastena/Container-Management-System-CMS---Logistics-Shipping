// src/modules/auth/dto/refresh-token.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    example: '<refresh-token>',
    description: 'Refresh token',
  })
  @IsString({
    message: 'Refresh token must be a string',
  })
  @IsNotEmpty({
    message: 'Refresh token is required',
  })
  @MinLength(64, {
    message: 'Invalid refresh token',
  })
  @MaxLength(128, {
    message: 'Invalid refresh token',
  })
  refreshToken!: string;
}
