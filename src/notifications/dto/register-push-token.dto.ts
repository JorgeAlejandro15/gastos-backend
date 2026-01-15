// File: src/notifications/dto/register-push-token.dto.ts

import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  token!: string;

  @IsString()
  @IsIn(['ios', 'android', 'web'])
  deviceType!: 'ios' | 'android' | 'web';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceName?: string;
}
