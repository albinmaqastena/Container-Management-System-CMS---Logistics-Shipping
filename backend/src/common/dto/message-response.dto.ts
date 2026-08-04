import { ApiProperty } from '@nestjs/swagger';

export class MessageResponseDto {
  @ApiProperty({
    example: 'Operation completed successfully',
    description: 'Human-readable response message',
  })
  message!: string;

  constructor(message: string) {
    this.message = message;
  }
}
