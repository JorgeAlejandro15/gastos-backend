import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateManualExpenseDto {
  @ApiPropertyOptional({
    example: 'b8b5e6a1-7c30-4b61-a83b-0e87f3a6d7a1',
    description: 'ID del pagador (si se omite, usa el usuario autenticado).',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  payerId?: string;

  @ApiProperty({
    example: 120.5,
    description: 'Monto del gasto (>= 0).',
    minimum: 0,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiProperty({
    example: 'Compra de pan',
    description: 'Descripción del gasto.',
    maxLength: 120,
  })
  @IsString()
  @MaxLength(120)
  description!: string;

  @ApiPropertyOptional({
    example: 'Comida',
    description: 'Categoría opcional.',
    maxLength: 80,
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @ApiPropertyOptional({
    example: '2025-12-21T16:00:00.000Z',
    description: 'Fecha/hora del gasto en ISO 8601 (si se omite, usa ahora).',
    format: 'date-time',
  })
  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}
