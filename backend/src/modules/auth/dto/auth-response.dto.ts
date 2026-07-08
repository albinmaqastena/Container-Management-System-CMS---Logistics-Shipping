// dto/auth-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../entities/user.entity';

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ type: () => User })
  user: Partial<User>;

  @ApiProperty({ required: false })
  refreshToken?: string;

  constructor(
    accessToken: string,
    user: Partial<User>,
    refreshToken?: string,
  ) {
    this.accessToken = accessToken;
    this.user = user;
    this.refreshToken = refreshToken;
  }
}