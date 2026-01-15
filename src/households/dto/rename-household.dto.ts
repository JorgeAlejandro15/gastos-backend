import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RenameHouseholdDto {
  @ApiProperty({
    example: 'Mi Hogar',
    description: 'Nuevo nombre del hogar',
    minLength: 2,
    maxLength: 120,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}
