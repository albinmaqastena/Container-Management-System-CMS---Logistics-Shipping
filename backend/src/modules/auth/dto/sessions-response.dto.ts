import { ApiProperty } from '@nestjs/swagger';

import { SessionDto } from './session.dto';

export class SessionsResponseDto {
  @ApiProperty({
    type: () => [SessionDto],
    description: 'Active sessions for the authenticated user',
  })
  sessions!: SessionDto[];

  constructor(sessions: SessionDto[]) {
    this.sessions = sessions;
  }
}
