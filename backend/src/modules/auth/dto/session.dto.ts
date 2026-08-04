// src/modules/auth/dto/session.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SessionDto {
  @ApiProperty({
    example: '9d4d5f4b-2b1e-4f0f-a2d6-7b4f7c3d8d9a',
    description: 'Unique session identifier',
  })
  id!: string;

  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'User ID associated with this session',
  })
  userId!: string;

  @ApiPropertyOptional({
    example: '192.168.1.100',
    description: 'IP address from which the session was created',
  })
  ip?: string;

  @ApiPropertyOptional({
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    description: 'User agent of the client that created the session',
  })
  userAgent?: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-07-13T12:34:56.000Z',
    description: 'Timestamp when the session was created',
  })
  createdAt!: Date;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-07-20T12:34:56.000Z',
    description: 'Timestamp when the session expires',
  })
  expiresAt!: Date;

  @ApiProperty({
    example: true,
    description: 'Whether the session is currently active',
  })
  isActive!: boolean;

  @ApiProperty({
    example: true,
    description: 'Whether this is the current session (the one used for this request)',
  })
  isCurrent!: boolean;
}
