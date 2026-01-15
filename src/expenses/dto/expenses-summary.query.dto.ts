import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';
import type { ExpenseSourceType } from '../expense.entity';

export class ExpensesSummaryQueryDto {
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
    example: 'b8b5e6a1-7c30-4b61-a83b-0e87f3a6d7a1',
    description: 'Filtrar por pagador.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  payerId?: string;

  @ApiPropertyOptional({
    example: 'Comida',
    description: 'Filtrar por categoría.',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    example: 'shopping_item',
    description: 'Filtrar por tipo de origen.',
    enum: ['shopping_item', 'manual'],
  })
  @IsOptional()
  @IsIn(['shopping_item', 'manual'] satisfies ExpenseSourceType[])
  sourceType?: ExpenseSourceType;
}
