// src/modules/containers/dto/update-container-status.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { ContainerStatus } from '../entities/container.entity';

export class UpdateContainerStatusDto {
  @ApiProperty({
    enum: ContainerStatus,
    example: ContainerStatus.ACTIVE,
    description: 'New container status',
  })
  @IsEnum(ContainerStatus, {
    message: `Invalid status. Must be one of: ${Object.values(ContainerStatus).join(', ')}`,
  })
  status: ContainerStatus;
}
