import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import type { IncomeSource } from '../income.entity';

export class ListIncomesQueryDto {
  @ApiPropertyOptional({
    example: '2025-12-01T00:00:00.000Z',
    description: 'Filtrar desde (ISO 8601).',
    format: 'date-time',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    example: '2025-12-31T23:59:59.999Z',
    description: 'Filtrar hasta (ISO 8601).',
    format: 'date-time',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({
    example: 'salary',
    description: 'Filtrar por source.',
    enum: ['salary', 'gift', 'refund', 'other'],
  })
  @IsOptional()
  @IsIn(['salary', 'gift', 'refund', 'other'] satisfies IncomeSource[])
  source?: IncomeSource;

  @ApiPropertyOptional({
    example: 'Trabajo',
    description: 'Filtrar por categoría.',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    example: 0,
    description: 'Offset (paginación).',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({
    example: 50,
    description: 'Límite (paginación).',
    minimum: 1,
    maximum: 200,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({
    example: 'DESC',
    description: 'Orden por fecha.',
    enum: ['ASC', 'DESC'],
  })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC';
}
