import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class SearchUserDto {
  @ApiProperty({
    description: 'Email or phone number to search for',
    example: 'user@example.com or +56986532',
  })
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @ApiProperty({
    description:
      'Optional householdId: if provided, search will also check membership against that household (owner/member).',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  householdId?: string;
}
