// src/common/exceptions/validation.exception.ts
import { BaseException } from './base.exception';

export class ValidationException extends BaseException {
  status = 400;
  code = 'VALIDATION_ERROR';

  constructor(message: string, public errors?: string[]) {
    super(message);
  }
}