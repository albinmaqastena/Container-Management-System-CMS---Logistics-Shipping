// src/modules/auth/dto/refresh-token.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    example: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    description: 'Refresh token',
  })
  @IsString({
    message: 'Refresh token must be a string',
  })
  @IsNotEmpty({
    message: 'Refresh token is required',
  })
  @MaxLength(500, {
    message: 'Refresh token must not exceed 500 characters',
  })
  refreshToken!: string;
}
