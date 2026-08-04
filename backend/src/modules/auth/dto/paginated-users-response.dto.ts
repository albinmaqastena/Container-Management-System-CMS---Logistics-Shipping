import { ApiProperty } from '@nestjs/swagger';

import { UserResponseDto } from './user-response.dto';
import { PaginatedResponseDto } from '../../../common/dto/pagination.dto';

export class PaginatedUsersResponseDto extends PaginatedResponseDto<UserResponseDto> {
  @ApiProperty({
    type: () => [UserResponseDto],
    description: 'Users for the current page',
  })
  declare data: UserResponseDto[];

  constructor(data: UserResponseDto[], total: number, limit: number, offset: number) {
    super(data, total, limit, offset);
  }
}
