import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateItemDto {
  @ApiProperty({
    example: 'Arroz',
    description: 'Nombre del item a comprar.',
  })
  @IsString()
  name!: string;

  @ApiProperty({
    example: 2,
    description: 'Cantidad del producto a comprar (>= 0).',
    minimum: 0,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiProperty({
    example: 25.5,
    description: 'Precio unitario del producto (>= 0).',
    minimum: 0,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({
    example: 'Comida',
    description: 'Categoría opcional.',
  })
  @IsOptional()
  @IsString()
  category?: string;
}
