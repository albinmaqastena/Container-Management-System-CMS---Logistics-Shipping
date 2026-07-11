// src/modules/auth/dto/auth-response.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';

export class AuthResponseDto {
  @ApiProperty({
    description: 'JWT access token',
  })
  accessToken!: string;

  @ApiProperty({
    type: () => UserResponseDto,
  })
  user!: Partial<UserResponseDto>;

  @ApiPropertyOptional({
    description: 'Refresh token used to obtain a new access token',
  })
  refreshToken?: string;

  constructor(accessToken: string, user: Partial<UserResponseDto>, refreshToken?: string) {
    this.accessToken = accessToken;
    this.user = user;
    this.refreshToken = refreshToken;
  }
}
