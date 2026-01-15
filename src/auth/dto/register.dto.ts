import {
  ApiHideProperty,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsStrongPassword,
  Matches,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class RegisterDto {
  @ApiPropertyOptional({
    example: 'user@example.com',
    description: 'Email del usuario (único). Opcional si se envía phone.',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: '+5355512345',
    description:
      'Móvil del usuario. Acepta E.164 (+...) o dígitos locales (ej. 56989636). Opcional si se envía email.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(\+[1-9]\d{7,14}|\d{6,15})$/)
  phone?: string;

  // Force: at least one identifier must be provided.
  // Hidden from Swagger/OpenAPI.
  @ApiHideProperty()
  @ValidateIf((o: RegisterDto) => !o.email && !o.phone)
  @IsNotEmpty({ message: 'Either email or phone must be provided' })
  _identifier?: string;

  @ApiProperty({
    example: 'secret123',
    description:
      'Contraseña en texto plano. Requiere 8+ caracteres, 1 mayúscula, 1 minúscula y 1 número. Sin espacios.',
    minLength: 8,
  })
  @IsString()
  @Matches(/^\S+$/, { message: 'La contraseña no puede contener espacios.' })
  @IsStrongPassword(
    {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 0,
    },
    {
      message:
        'La contraseña debe tener al menos 8 caracteres, 1 mayúscula, 1 minúscula y 1 número.',
    },
  )
  password!: string;

  @ApiProperty({
    example: 'Juan Pérez',
    description: 'Nombre para mostrar. Mínimo 2 caracteres.',
    minLength: 2,
  })
  @IsString()
  @MinLength(2)
  displayName!: string;
}
