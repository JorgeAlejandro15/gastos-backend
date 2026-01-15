import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    example: 'Juan Pérez',
    description: 'Nombre para mostrar. Mínimo 2 caracteres.',
    minLength: 2,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  displayName?: string;

  @ApiPropertyOptional({
    example: 'user@example.com',
    description:
      'Email del usuario (único). Puede ser null para eliminarlo si el usuario tiene phone.',
    nullable: true,
  })
  @ValidateIf(
    (o: UpdateProfileDto) => o.email !== undefined && o.email !== null,
  )
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional({
    example: '+5355512345',
    description:
      'Móvil del usuario. Acepta E.164 (+...) o dígitos locales (ej. 56989636). Puede ser null para eliminarlo si el usuario tiene email.',
    nullable: true,
  })
  @ValidateIf(
    (o: UpdateProfileDto) => o.phone !== undefined && o.phone !== null,
  )
  @IsString()
  @Matches(/^(\+[1-9]\d{7,14}|\d{6,15})$/)
  phone?: string | null;
}
