// src/common/exceptions/base.exception.ts
export abstract class BaseException extends Error {
  abstract status: number;
  abstract code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, BaseException.prototype);
  }
}