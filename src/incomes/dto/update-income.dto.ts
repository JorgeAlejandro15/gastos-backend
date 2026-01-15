import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import type { IncomeSource } from '../income.entity';

export class UpdateIncomeDto {
  @ApiPropertyOptional({
    example: 25000,
    description: 'Monto del ingreso (>= 0).',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({
    example: 'salary',
    description: 'Origen del ingreso.',
    enum: ['salary', 'gift', 'refund', 'other'],
  })
  @IsOptional()
  @IsIn(['salary', 'gift', 'refund', 'other'] satisfies IncomeSource[])
  source?: IncomeSource;

  @ApiPropertyOptional({
    example: 'Salario diciembre',
    description: 'Descripción del ingreso.',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  description?: string;

  @ApiPropertyOptional({
    example: 'Trabajo',
    description: 'Categoría opcional.',
    maxLength: 80,
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @ApiPropertyOptional({
    example: '2025-12-21T16:00:00.000Z',
    description: 'Fecha/hora del ingreso en ISO 8601.',
    format: 'date-time',
  })
  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}
