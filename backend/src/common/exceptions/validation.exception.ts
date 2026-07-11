// src/common/exceptions/validation.exception.ts

import { BaseException } from './base.exception';

export class ValidationException extends BaseException {
  readonly status = 400;
  readonly code = 'VALIDATION_ERROR';

  constructor(
    message: string,
    public readonly errors: string[] = [],
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}