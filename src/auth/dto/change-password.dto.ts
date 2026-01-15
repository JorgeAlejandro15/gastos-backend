import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsStrongPassword,
  Matches,
  MinLength,
} from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'oldSecret123',
    description: 'Contraseña actual. Mínimo 6 caracteres.',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  currentPassword!: string;

  @ApiProperty({
    example: 'newSecret123',
    description:
      'Nueva contraseña. Requiere 8+ caracteres, 1 mayúscula, 1 minúscula y 1 número. Sin espacios.',
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
  newPassword!: string;
}
