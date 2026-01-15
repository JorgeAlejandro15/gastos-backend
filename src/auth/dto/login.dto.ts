import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Matches,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class LoginDto {
  @ApiPropertyOptional({
    example: 'user@example.com',
    description: 'Email del usuario. (Opcional si se envía phone).',
  })
  @ValidateIf((o: LoginDto) => !o.phone)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: '+5355512345',
    description:
      'Móvil del usuario. Acepta E.164 (+...) o dígitos locales (ej. 56989636). (Opcional si se envía email).',
  })
  @ValidateIf((o: LoginDto) => !o.email)
  @IsString()
  @Matches(/^(\+[1-9]\d{7,14}|\d{6,15})$/)
  phone?: string;

  @ApiProperty({
    example: 'secret123',
    description: 'Contraseña. Mínimo 6 caracteres.',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password!: string;
}
