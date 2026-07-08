// src/modules/containers/dto/create-container.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min, Max, MaxLength, IsNotEmpty, MinLength } from 'class-validator';

export class CreateContainerDto {
  @ApiProperty({ example: 'Container Alpha' })
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Container name is required' })
  @MinLength(3, { message: 'Container name must be at least 3 characters' })
  @MaxLength(100, { message: 'Container name must not exceed 100 characters' })
  customName!: string;

  @ApiProperty({ example: 100, description: 'Total volume in cubic meters' })
  @IsNumber({}, { message: 'Total volume must be a number' })
  @IsNotEmpty({ message: 'Total volume is required' })
  @Min(0, { message: 'Total volume must be greater than or equal to 0' })
  @Max(100000, { message: 'Total volume must not exceed 100,000 cubic meters' })
  totalVolume!: number;

  @ApiProperty({ required: false, example: 'Main storage container' })
  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  description?: string;
}