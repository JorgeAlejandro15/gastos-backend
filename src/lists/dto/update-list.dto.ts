import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateListDto {
  @ApiPropertyOptional({
    example: 'Supermercado (semana)',
    description: 'Nuevo nombre de la lista.',
    minLength: 2,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;
}
