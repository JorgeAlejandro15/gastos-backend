import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Matches,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class RegisterHouseholdMemberDto {
  @ApiPropertyOptional({
    example: 'new.user@example.com',
    description: 'Email del nuevo usuario. (Opcional si se envía phone).',
  })
  @ValidateIf((o: RegisterHouseholdMemberDto) => !o.phone)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: '56989636',
    description:
      'Móvil del nuevo usuario. Acepta E.164 (+...) o dígitos locales. (Opcional si se envía email).',
  })
  @ValidateIf((o: RegisterHouseholdMemberDto) => !o.email)
  @IsString()
  @Matches(/^(\+[1-9]\d{7,14}|\d{6,15})$/)
  phone?: string;

  @ApiProperty({
    example: 'secret123',
    description: 'Contraseña inicial del usuario. Mínimo 6 caracteres.',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({
    example: 'Nuevo Usuario',
    description: 'Nombre para mostrar. Mínimo 2 caracteres.',
    minLength: 2,
  })
  @IsString()
  @MinLength(2)
  displayName!: string;
}
