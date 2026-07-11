// src/modules/auth/dto/user-response.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity';

export class UserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({
    enum: UserRole,
  })
  role!: UserRole;

  @ApiProperty()
  isActive!: boolean;

  @ApiPropertyOptional({
    nullable: true,
  })
  lastLogin?: Date | null;

  @ApiPropertyOptional({
    nullable: true,
  })
  lastLoginIp?: string | null;

  @ApiPropertyOptional({
    nullable: true,
  })
  lastLoginUserAgent?: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional({
    nullable: true,
  })
  deletedAt?: Date | null;
}
