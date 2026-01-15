import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class DateRangeQueryDto {
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
}
