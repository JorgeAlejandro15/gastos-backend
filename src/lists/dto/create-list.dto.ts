import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateListDto {
  @ApiProperty({
    example: 'Supermercado',
    description: 'Nombre de la lista.',
    minLength: 2,
  })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({
    example: 'shared',
    description:
      "Tipo de lista: 'shared' (compartida del hogar) o 'personal' (solo del usuario).",
    enum: ['shared', 'personal'],
    required: false,
  })
  @IsOptional()
  @IsIn(['shared', 'personal'])
  scope?: 'shared' | 'personal';
}
