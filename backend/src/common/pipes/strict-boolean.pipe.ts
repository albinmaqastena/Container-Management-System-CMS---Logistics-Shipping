import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class StrictBooleanPipe implements PipeTransform<
  string | boolean | undefined,
  boolean | undefined
> {
  transform(value: string | boolean | undefined): boolean | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === true || value === 'true') {
      return true;
    }

    if (value === false || value === 'false') {
      return false;
    }

    throw new BadRequestException('includeDeleted must be true or false');
  }
}
