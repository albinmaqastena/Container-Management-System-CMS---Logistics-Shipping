// src/modules/auth/dto/auth-response.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';

export class AuthResponseDto {
  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({
    type: () => UserResponseDto,
  })
  user!: UserResponseDto;

  @ApiProperty({
    description: 'Refresh token used to obtain new tokens',
    example: '3a8b4d6d0c0f...',
  })
  refreshToken!: string;

  constructor(accessToken: string, user: UserResponseDto, refreshToken: string) {
    this.accessToken = accessToken;
    this.user = user;
    this.refreshToken = refreshToken;
  }
}
