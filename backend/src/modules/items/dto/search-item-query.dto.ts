// src/modules/items/dto/search-item-query.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

import { ItemQueryDto } from './item-query.dto';

export class SearchItemQueryDto
  extends ItemQueryDto
{
  @ApiProperty({
    description: 'Search text',
    example: 'Laptop',
  })
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim()
      : value,
  )
  @IsString({
    message:
      'Query must be a string',
  })
  @IsNotEmpty({
    message:
      'Query parameter is required',
  })
  @MaxLength(200, {
    message:
      'Query must not exceed 200 characters',
  })
  query!: string;
}