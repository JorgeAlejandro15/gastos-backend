import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import type { AppEnv } from '../../config/env';
import { AuthSessionEntity } from '../auth-session.entity';
import type { JwtPayload } from '../interfaces/jwt-payload';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<AppEnv, true>,
    @InjectRepository(AuthSessionEntity)
    private readonly sessionsRepo: Repository<AuthSessionEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload?.sid || payload.typ !== 'access') {
      throw new UnauthorizedException('Invalid token');
    }

    const session = await this.sessionsRepo.findOne({
      where: { id: payload.sid },
      select: ['id', 'userId', 'revokedAt', 'refreshTokenExpiresAt'],
    });

    if (!session || session.userId !== payload.sub) {
      throw new UnauthorizedException('Sesion no encontrada');
    }
    if (session.revokedAt) {
      throw new UnauthorizedException('Sesion revocada');
    }
    if (session.refreshTokenExpiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Sesion expirada');
    }

    // This object will become req.user
    return {
      userId: payload.sub,
      email: payload.email,
      sessionId: payload.sid,
    };
  }
}
