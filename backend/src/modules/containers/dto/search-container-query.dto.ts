// src/modules/containers/dto/search-container-query.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class SearchContainerQueryDto extends PaginationDto {
  @ApiProperty({
    example: 'Container Alpha',
    description: 'Search text for container name, code or description',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Query must be a string' })
  @IsNotEmpty({ message: 'Query parameter is required' })
  @MaxLength(200, {
    message: 'Query must not exceed 200 characters',
  })
  query!: string;
}
