import { ApiProperty } from '@nestjs/swagger';

export class AgentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;
}
