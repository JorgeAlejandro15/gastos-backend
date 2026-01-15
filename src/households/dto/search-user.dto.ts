import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SearchUserDto {
  @ApiProperty({
    description: 'Email or phone number to search for',
    example: 'user@example.com or +56986532',
  })
  @IsString()
  @IsNotEmpty()
  identifier!: string;
}
