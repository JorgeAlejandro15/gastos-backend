import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'node:crypto';
import { EntityManager, Repository } from 'typeorm';
import type { AppEnv } from '../config/env';
import { UserEntity } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    private readonly config: ConfigService<AppEnv, true>,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
  ) {}

  private normalizeEmail(email: string): string {
    return String(email || '')
      .trim()
      .toLowerCase();
  }

  /**
   * Normalizes phone to either:
   * - +[1-9][0-9]{7,14} (E.164)
   * - [0-9]{6,15} (local digits-only)
   *
   * Accepts input with spaces/dashes/parentheses.
   */
  normalizePhone(phone: string): string {
    const raw = String(phone || '').trim();
    if (!raw) return '';

    // Keep leading + if present, strip other non-digits.
    const hasPlus = raw.startsWith('+');
    const digits = raw.replace(/[^0-9]/g, '');
    if (!digits) return '';

    if (hasPlus) {
      const normalized = `+${digits}`;
      // E.164: + and 8..15 digits total (first digit non-zero)
      if (!/^\+[1-9]\d{7,14}$/.test(normalized)) return '';
      return normalized;
    }

    // Local: 6..15 digits (allows values like 56989636)
    if (!/^\d{6,15}$/.test(digits)) return '';
    return digits;
  }

  private getPhoneKeyBytesOrThrow(): Buffer {
    const b64: string | undefined = this.config.get('PHONE_ENCRYPTION_KEY');
    if (!b64) {
      throw new BadRequestException(
        'La autenticación por teléfono no está disponible',
      );
    }

    const key = Buffer.from(String(b64), 'base64');
    if (key.length !== 32) {
      throw new BadRequestException(
        'La autenticación por teléfono no está disponible',
      );
    }

    return key;
  }

  private getPhoneKeyBytesOrNull(): Buffer | null {
    const b64: string | undefined = this.config.get('PHONE_ENCRYPTION_KEY');
    if (!b64) return null;

    const key = Buffer.from(String(b64), 'base64');
    if (key.length !== 32) return null;
    return key;
  }

  /**
   * Public method to compute phone lookup hash for external usage
   * (e.g., HouseholdsService for invitations)
   */
  public computePhoneLookupHash(normalizedPhone: string): string {
    return this.phoneLookupHash(normalizedPhone);
  }

  private phoneLookupHash(normalizedPhone: string): string {
    const key = this.getPhoneKeyBytesOrThrow();
    return createHmac('sha256', key).update(normalizedPhone).digest('hex');
  }

  private encryptPhone(normalizedPhone: string): string {
    const key = this.getPhoneKeyBytesOrThrow();
    const iv = randomBytes(12); // GCM recommended IV length
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(normalizedPhone, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    // v1:<iv_b64url>:<tag_b64url>:<cipher_b64url>
    return [
      'v1',
      iv.toString('base64url'),
      tag.toString('base64url'),
      ciphertext.toString('base64url'),
    ].join(':');
  }

  private decryptPhone(phoneEncrypted: string): string | null {
    const key = this.getPhoneKeyBytesOrNull();
    if (!key) return null;

    const raw = String(phoneEncrypted || '').trim();
    if (!raw) return null;

    const parts = raw.split(':');
    if (parts.length !== 4) return null;

    const [version, ivB64, tagB64, cipherB64] = parts;
    if (version !== 'v1') return null;

    try {
      const iv = Buffer.from(ivB64, 'base64url');
      const tag = Buffer.from(tagB64, 'base64url');
      const ciphertext = Buffer.from(cipherB64, 'base64url');

      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString('utf8');

      // Normalize again defensively.
      const normalized = this.normalizePhone(plaintext);
      return normalized || null;
    } catch {
      return null;
    }
  }

  async getDecryptedPhoneByUserId(userId: string): Promise<string | null> {
    const user = await this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.phoneEncrypted')
      .where('user.id = :id', { id: userId })
      .getOne();

    if (!user?.phoneEncrypted) return null;
    return this.decryptPhone(user.phoneEncrypted);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const normalized = this.normalizeEmail(email);
    if (!normalized) return null;
    return this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email: normalized })
      .getOne();
  }

  async findByPhone(phone: string): Promise<UserEntity | null> {
    const normalized = this.normalizePhone(phone);
    if (!normalized) return null;
    const hash = this.phoneLookupHash(normalized);
    return this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.phoneLookupHash = :hash', { hash })
      .getOne();
  }

  async findByIdWithPassword(id: string): Promise<UserEntity | null> {
    return this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id })
      .getOne();
  }

  async existsByEmail(
    email: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const normalized = this.normalizeEmail(email);
    if (!normalized) return false;
    const repo = manager ? manager.getRepository(UserEntity) : this.usersRepo;
    return repo.exists({ where: { email: normalized } });
  }

  async existsByPhone(
    phone: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const normalized = this.normalizePhone(phone);
    if (!normalized) return false;
    const repo = manager ? manager.getRepository(UserEntity) : this.usersRepo;
    const hash = this.phoneLookupHash(normalized);
    return repo.exists({ where: { phoneLookupHash: hash } });
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  async createUser(
    input: {
      email?: string | null;
      phone?: string | null;
      displayName: string;
      password: string;
    },
    manager?: EntityManager,
  ): Promise<UserEntity> {
    const repo = manager ? manager.getRepository(UserEntity) : this.usersRepo;

    const email = input.email ? this.normalizeEmail(input.email) : null;
    const normalizedPhone = input.phone ? this.normalizePhone(input.phone) : '';
    // If phone is provided but PHONE_ENCRYPTION_KEY is missing/invalid,
    // getPhoneKeyBytesOrThrow() will raise BadRequestException (400) instead of a 500.
    const phoneEncrypted = normalizedPhone
      ? this.encryptPhone(normalizedPhone)
      : null;
    const phoneLookupHash = normalizedPhone
      ? this.phoneLookupHash(normalizedPhone)
      : null;

    const user = repo.create({
      email,
      displayName: input.displayName,
      password: input.password,
      phoneEncrypted,
      phoneLookupHash,
    });
    return repo.save(user);
  }

  async updatePasswordHash(
    userId: string,
    passwordHash: string,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager ? manager.getRepository(UserEntity) : this.usersRepo;
    await repo.update({ id: userId }, { password: passwordHash });
  }

  async updateProfile(
    userId: string,
    input: {
      displayName?: string;
      email?: string | null;
      phone?: string | null;
    },
    manager?: EntityManager,
  ): Promise<UserEntity> {
    const repo = manager ? manager.getRepository(UserEntity) : this.usersRepo;

    const user = await repo
      .createQueryBuilder('user')
      .addSelect(['user.phoneEncrypted', 'user.phoneLookupHash'])
      .where('user.id = :id', { id: userId })
      .getOne();

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (input.displayName !== undefined) {
      const name = String(input.displayName).trim();
      if (name.length < 2) {
        throw new BadRequestException(
          'El nombre para mostrar debe tener al menos 2 caracteres',
        );
      }
      user.displayName = name;
    }

    if (input.email !== undefined) {
      if (input.email === null) {
        user.email = null;
      } else {
        const normalized = this.normalizeEmail(String(input.email));
        if (!normalized) {
          throw new BadRequestException('Correo electrónico inválido');
        }

        const existing = await repo
          .createQueryBuilder('u')
          .select('u.id', 'id')
          .where('u.email = :email', { email: normalized })
          .andWhere('u.id <> :userId', { userId })
          .getRawOne<{ id: string }>();

        if (existing?.id) {
          throw new ConflictException(
            'El correo electrónico ya está registrado',
          );
        }

        user.email = normalized;
      }
    }

    if (input.phone !== undefined) {
      if (input.phone === null) {
        user.phoneEncrypted = null;
        user.phoneLookupHash = null;
      } else {
        const normalized = this.normalizePhone(String(input.phone));
        if (!normalized) {
          throw new BadRequestException('Número de teléfono inválido');
        }

        const hash = this.phoneLookupHash(normalized);
        const existing = await repo
          .createQueryBuilder('u')
          .select('u.id', 'id')
          .where('u.phoneLookupHash = :hash', { hash })
          .andWhere('u.id <> :userId', { userId })
          .getRawOne<{ id: string }>();

        if (existing?.id) {
          throw new ConflictException(
            'El número de teléfono ya está registrado',
          );
        }

        user.phoneEncrypted = this.encryptPhone(normalized);
        user.phoneLookupHash = hash;
      }
    }

    // Must keep at least one identifier.
    if (!user.email && !user.phoneLookupHash) {
      throw new BadRequestException('El usuario debe tener email o teléfono');
    }

    return repo.save(user);
  }
}
