import { plainToInstance, Type } from 'class-transformer';
import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3000;

  @IsString()
  DB_HOST!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT = 5432;

  @IsString()
  DB_USER!: string;

  @IsString()
  DB_PASSWORD!: string;

  @IsString()
  DB_NAME!: string;

  @IsBooleanString()
  DB_SSL: 'true' | 'false' = 'false';

  @IsBooleanString()
  TYPEORM_SYNCHRONIZE: 'true' | 'false' = 'false';

  @IsBooleanString()
  TYPEORM_LOGGING: 'true' | 'false' = 'false';

  @IsString()
  JWT_SECRET!: string;

  @IsString()
  JWT_EXPIRES_IN = '15m';

  @IsString()
  JWT_REFRESH_EXPIRES_IN = '30m';

  @Type(() => Number)
  @IsInt()
  @Min(4)
  @Max(15)
  BCRYPT_SALT_ROUNDS = 10;

  // Base64-encoded 32-byte key used for AES-256-GCM phone encryption and HMAC lookup hashing.
  @IsOptional()
  @IsString()
  PHONE_ENCRYPTION_KEY?: string;

  @IsString()
  HOUSEHOLD_NAME = 'Hogar';

  @IsString()
  HOUSEHOLD_CURRENCY = 'CUP';

  @IsOptional()
  @IsString()
  LOG_LEVEL?: string;

  /**
   * Firebase Admin (opcional): si se configura, el backend podrá enviar notificaciones
   * directamente a tokens FCM (sin pasar por el servicio de Expo).
   *
   * Recomendado: usar FIREBASE_SERVICE_ACCOUNT_BASE64 para evitar problemas de saltos de línea.
   */
  @IsOptional()
  @IsString()
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;

  @IsOptional()
  @IsString()
  FIREBASE_SERVICE_ACCOUNT_BASE64?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const message = errors
      .map(
        (e) =>
          `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
      )
      .join('; ');
    throw new Error(`Environment validation error: ${message}`);
  }

  return validated;
}

export type AppEnv = EnvironmentVariables;
