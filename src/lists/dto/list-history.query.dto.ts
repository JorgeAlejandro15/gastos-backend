import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/**
 * Query params for /lists/:listId/history
 * Filters are applied against ShoppingItemEntity.purchasedAt.
 */
export class ListHistoryQueryDto {
  @ApiPropertyOptional({
    example: '2025-12-01T00:00:00.000Z',
    description: 'Filtrar desde (ISO 8601). Se compara con purchasedAt.',
    format: 'date-time',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    example: '2025-12-31T23:59:59.999Z',
    description: 'Filtrar hasta (ISO 8601). Se compara con purchasedAt.',
    format: 'date-time',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({
    example: 30,
    description:
      'Cantidad de items a traer por página (1-50). Default: 30. Se usa para paginación tipo cursor.',
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({
    example:
      'eyJwdXJjaGFzZWRBdCI6IjIwMjYtMDEtMTBUMTI6MzQ6NTYuMDAwWiIsImlkIjoiZjA4Yy4uLiJ9',
    description:
      'Cursor opaco (base64url) devuelto por el backend. Úsalo como query param para pedir la siguiente página.',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
