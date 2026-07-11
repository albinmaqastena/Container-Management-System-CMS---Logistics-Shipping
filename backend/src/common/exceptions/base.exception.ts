// src/common/exceptions/base.exception.ts

export abstract class BaseException extends Error {
  abstract readonly status: number;
  abstract readonly code: string;

  protected constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
