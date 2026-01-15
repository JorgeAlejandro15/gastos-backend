import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateItemDto {
  @ApiPropertyOptional({
    example: 'Arroz (integral)',
    description: 'Nuevo nombre del item.',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 3,
    description: 'Nueva cantidad del producto (>= 0).',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({
    example: 25.5,
    description: 'Nuevo precio unitario (>= 0).',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({
    example: 'Comida',
    description: 'Nueva categoría.',
  })
  @IsOptional()
  @IsString()
  category?: string;
}
