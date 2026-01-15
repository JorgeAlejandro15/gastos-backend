import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';
import type { IncomeSource } from '../income.entity';

export class IncomesSummaryQueryDto {
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
}
