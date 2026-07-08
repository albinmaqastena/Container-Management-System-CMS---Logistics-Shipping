// src/modules/auth/dto/session.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class SessionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  ip?: string;

  @ApiProperty()
  userAgent?: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty()
  isActive!: boolean;
}