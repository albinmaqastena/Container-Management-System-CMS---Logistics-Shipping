// src/modules/items/dto/search-item-query.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { ItemQueryDto } from './item-query.dto';

export class SearchItemQueryDto extends ItemQueryDto {
  @ApiProperty({
    description: 'Search text',
    example: 'Laptop',
  })
  @IsString()
  @IsNotEmpty()
  query!: string;
}