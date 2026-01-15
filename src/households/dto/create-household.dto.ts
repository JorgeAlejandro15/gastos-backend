import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateHouseholdDto {
  @ApiPropertyOptional({
    example: 'Mi Hogar',
    description:
      'Nombre del hogar. Si no se envía, se usa HOUSEHOLD_NAME del entorno.',
  })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @ApiPropertyOptional({
    example: 'CUP',
    description:
      'Moneda ISO-4217 (3 letras). Si no se envía, se usa HOUSEHOLD_CURRENCY del entorno.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;
}
