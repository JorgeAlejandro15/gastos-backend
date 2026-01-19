import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';

export class InviteHouseholdDto {
  @ApiProperty({
    example: 'friend@example.com',
    description: 'Email del usuario a invitar (puede no estar registrado aún)',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    example: '+56987845',
    description:
      'Teléfono del usuario a invitar (puede no estar registrado aún)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^(\+[1-9]\d{7,14}|\d{6,15})$/, {
    message: 'El teléfono debe ser un número válido.',
  })
  phone?: string;
}
