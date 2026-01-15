import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import type { AppEnv } from '../config/env';
import { HouseholdEntity } from '../households/household.entity';
import { HouseholdsService } from '../households/households.service';
import { UsersService } from '../users/users.service';
import { AuthSessionEntity } from './auth-session.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService<AppEnv, true>,
    private readonly jwt: JwtService,
    private readonly dataSource: DataSource,
    @InjectRepository(AuthSessionEntity)
    private readonly sessionsRepo: Repository<AuthSessionEntity>,
    private readonly users: UsersService,
    private readonly households: HouseholdsService,
  ) {}

  private getRefreshTtlMs(): number {
    // Defaults per your decision: 30 minutes
    const raw: string = this.config.getOrThrow('JWT_REFRESH_EXPIRES_IN');
    const str = raw.trim();

    const match = /^([0-9]+)\s*(ms|s|m|h|d)$/i.exec(str);
    if (!match) {
      // Fallback: 30 minutes
      return 30 * 60 * 1000;
    }
    const value = Number(match[1]);
    const unit = match[2].toLowerCase();
    const mult =
      unit === 'ms'
        ? 1
        : unit === 's'
          ? 1000
          : unit === 'm'
            ? 60 * 1000
            : unit === 'h'
              ? 60 * 60 * 1000
              : 24 * 60 * 60 * 1000;
    return value * mult;
  }

  private generateRefreshToken(): string {
    // 32 bytes => 256-bit token, base64url
    return randomBytes(32).toString('base64url');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async hashPassword(password: string): Promise<string> {
    const rounds: number = this.config.getOrThrow('BCRYPT_SALT_ROUNDS');
    return bcrypt.hash(password, rounds);
  }

  private async comparePassword(
    password: string,
    hash: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  private signAccessToken(input: {
    userId: string;
    email: string;
    sessionId: string;
  }) {
    const payload = {
      sub: input.userId,
      email: input.email,
      sid: input.sessionId,
      typ: 'access' as const,
    };
    const accessToken = this.jwt.sign(payload);
    return { accessToken };
  }

  private async createSession(
    input: { userId: string },
    manager?: EntityManager,
  ) {
    const refreshToken = this.generateRefreshToken();
    const refreshTokenHash = this.hashToken(refreshToken);
    const refreshTokenExpiresAt = new Date(Date.now() + this.getRefreshTtlMs());

    const repo: Repository<AuthSessionEntity> = manager
      ? manager.getRepository(AuthSessionEntity)
      : this.sessionsRepo;

    const session = repo.create({
      userId: input.userId,
      refreshToken: refreshTokenHash,
      previousRefreshToken: null,
      refreshTokenExpiresAt,
      rotatedAt: null,
      revokedAt: null,
    });
    const saved = await repo.save(session);

    return { sessionId: saved.id, refreshToken, refreshTokenExpiresAt };
  }

  async register(input: {
    email?: string;
    phone?: string;
    password: string;
    displayName: string;
  }) {
    const email = input.email ? String(input.email).trim() : '';
    const phone = input.phone ? String(input.phone).trim() : '';

    if (!email && !phone) {
      // Defensive: DTO validation should catch this.
      throw new BadRequestException('El correo o el teléfono son obligatorios');
    }

    if (email) {
      const exists = await this.users.existsByEmail(email);
      if (exists) {
        throw new ConflictException('Este correo ya está registrado');
      }
    }

    if (phone) {
      const exists = await this.users.existsByPhone(phone);
      if (exists) {
        throw new ConflictException('Este teléfono ya está registrado');
      }
    }

    const password = await this.hashPassword(input.password);

    const result = await this.dataSource.transaction(async (manager) => {
      const user = await this.users.createUser(
        {
          email: email || null,
          phone: phone || null,
          displayName: input.displayName,
          password,
        },
        manager,
      );

      // IMPORTANT (per product decision): do NOT auto-create a household on register.
      // If there's exactly one pending invitation for this email/phone, auto-accept it and set it as primary.
      let household: HouseholdEntity | null = null;

      if (email) {
        household = await this.households.acceptInvitationForUserByEmail(
          email,
          user.id,
          manager,
        );
      }

      // If no household from email invitation, try phone invitation
      if (!household && phone) {
        household = await this.households.acceptInvitationForUserByPhone(
          phone,
          user.id,
          manager,
        );
      }

      const session = await this.createSession({ userId: user.id }, manager);

      return { user, household, session };
    });

    return {
      ...this.signAccessToken({
        userId: result.user.id,
        email: result.user.email ?? '',
        sessionId: result.session.sessionId,
      }),
      refreshToken: result.session.refreshToken,
      user: {
        id: result.user.id,
        email: result.user.email ?? '',
        displayName: result.user.displayName,
      },
      household: result.household
        ? {
            id: result.household.id,
            name: result.household.name,
            currency: result.household.currency,
          }
        : null,
    };
  }

  async login(input: { email?: string; phone?: string; password: string }) {
    const user = input.email
      ? await this.users.findByEmail(input.email)
      : input.phone
        ? await this.users.findByPhone(input.phone)
        : null;
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const ok = await this.comparePassword(input.password, user.password);
    if (!ok) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const session = await this.createSession({ userId: user.id });

    return {
      ...this.signAccessToken({
        userId: user.id,
        email: user.email ?? '',
        sessionId: session.sessionId,
      }),
      refreshToken: session.refreshToken,
      user: {
        id: user.id,
        email: user.email ?? '',
        displayName: user.displayName,
      },
    };
  }

  async refresh(refreshToken: string) {
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new UnauthorizedException('Missing refresh token');
    }

    const hash = this.hashToken(refreshToken);

    // Find by current or previous hash (previous => reuse detection)
    const session = await this.sessionsRepo
      .createQueryBuilder('s')
      .where('s.refreshToken = :hash', { hash })
      .orWhere('s.previousRefreshToken = :hash', { hash })
      .getOne();

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Token reuse (old token after rotation) => revoke session immediately
    if (session.previousRefreshToken === hash) {
      if (!session.revokedAt) {
        session.revokedAt = new Date();
        await this.sessionsRepo.save(session);
      }
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (session.revokedAt) {
      throw new UnauthorizedException('La sesión ha sido cerrada');
    }
    if (session.refreshTokenExpiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.users.findById(session.userId);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    // Rotate refresh token (invalidate previous)
    const newRefreshToken = this.generateRefreshToken();
    const newHash = this.hashToken(newRefreshToken);

    session.previousRefreshToken = session.refreshToken;
    session.refreshToken = newHash;
    session.rotatedAt = new Date();
    // Sliding expiration
    session.refreshTokenExpiresAt = new Date(
      Date.now() + this.getRefreshTtlMs(),
    );
    await this.sessionsRepo.save(session);

    return {
      ...this.signAccessToken({
        userId: user.id,
        email: user.email ?? '',
        sessionId: session.id,
      }),
      refreshToken: newRefreshToken,
    };
  }

  async me(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const phone = await this.users.getDecryptedPhoneByUserId(userId);

    const household = await this.households.getHouseholdForUser(userId);

    return {
      user: {
        id: user.id,
        email: user.email ?? '',
        displayName: user.displayName,
        phone,
      },
      household: household
        ? {
            id: household.id,
            name: household.name,
            currency: household.currency,
          }
        : null,
    };
  }

  async updateMe(
    userId: string,
    input: {
      displayName?: string;
      email?: string | null;
      phone?: string | null;
    },
  ) {
    const user = await this.users.updateProfile(userId, input);
    const household = await this.households.getHouseholdForUser(userId);

    const phone = await this.users.getDecryptedPhoneByUserId(userId);

    return {
      user: {
        id: user.id,
        email: user.email ?? '',
        displayName: user.displayName,
        phone,
      },
      household: household
        ? {
            id: household.id,
            name: household.name,
            currency: household.currency,
          }
        : null,
    };
  }

  async logout(userId: string, sessionId: string) {
    if (!sessionId) {
      return { ok: true };
    }
    const session = await this.sessionsRepo.findOne({
      where: { id: sessionId, userId },
    });
    if (!session) {
      return { ok: true };
    }
    if (!session.revokedAt) {
      session.revokedAt = new Date();
      await this.sessionsRepo.save(session);
    }
    return { ok: true };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.users.findByIdWithPassword(userId);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const ok = await this.comparePassword(currentPassword, user.password);
    if (!ok) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    user.password = await this.hashPassword(newPassword);
    await this.users.updatePasswordHash(userId, user.password);

    return { ok: true };
  }
}
