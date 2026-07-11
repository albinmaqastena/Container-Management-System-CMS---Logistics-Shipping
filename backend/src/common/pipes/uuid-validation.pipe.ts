// src/common/pipes/uuid-validation.pipe.ts

import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isUUID } from 'class-validator';

@Injectable()
export class UUIDValidationPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    const normalizedValue = value?.trim();

    if (!normalizedValue || !isUUID(normalizedValue, '4')) {
      throw new BadRequestException('Invalid UUID version 4 format');
    }

    return normalizedValue;
  }
}
