import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsPhoneNumber } from 'class-validator';

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
  @IsPhoneNumber()
  phone?: string;
}
