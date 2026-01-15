import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class AcceptInvitationDto {
  @ApiProperty({
    example: 'kT3e...base64url...',
    description:
      'Token recibido por email. (En esta implementación el backend devuelve el token al invitar para que puedas enviarlo por tu proveedor de email).',
  })
  @IsString()
  @MinLength(10)
  token!: string;
}
