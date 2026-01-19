import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { EntityManager, Repository } from 'typeorm';
import type { AppEnv } from '../config/env';
import { UserEntity } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { HouseholdInvitationEntity } from './household-invitation.entity';
import { HouseholdMemberEntity } from './household-member.entity';
import { HouseholdEntity } from './household.entity';

@Injectable()
export class HouseholdsService {
  constructor(
    private readonly config: ConfigService<AppEnv, true>,
    private readonly users: UsersService,
    @InjectRepository(HouseholdEntity)
    private readonly householdsRepo: Repository<HouseholdEntity>,
    @InjectRepository(HouseholdMemberEntity)
    private readonly membersRepo: Repository<HouseholdMemberEntity>,
    @InjectRepository(HouseholdInvitationEntity)
    private readonly invitationsRepo: Repository<HouseholdInvitationEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
  ) {}

  private normalizeEmail(email: string): string {
    return String(email || '')
      .trim()
      .toLowerCase();
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async hashPassword(password: string): Promise<string> {
    const rounds: number = this.config.getOrThrow('BCRYPT_SALT_ROUNDS');
    return bcrypt.hash(password, rounds);
  }

  private async assertOwnerOfHousehold(
    householdId: string,
    userId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const membersRepo = manager
      ? manager.getRepository(HouseholdMemberEntity)
      : this.membersRepo;

    // Legacy/bootstrapping: if a household has no owners yet, promote the earliest member.
    const owners = await membersRepo
      .createQueryBuilder('m')
      .where('m.householdId = :householdId', { householdId })
      .andWhere("m.role = 'owner'")
      .getCount();

    if (owners === 0) {
      const first = await membersRepo
        .createQueryBuilder('m')
        .where('m.householdId = :householdId', { householdId })
        .orderBy('m.createdAt', 'ASC')
        .select(['m.id as id', 'm.userId as "userId"'])
        .getRawOne<{ id: string; userId: string }>();

      if (first?.id && first.userId === userId) {
        await membersRepo.update({ id: first.id }, { role: 'owner' });
      }
    }

    const membership = await membersRepo
      .createQueryBuilder('m')
      .where('m.householdId = :householdId', { householdId })
      .andWhere('m.userId = :userId', { userId })
      .getOne();

    if (!membership) {
      throw new ForbiddenException('No eres miembro de este hogar');
    }
    if (membership.role !== 'owner') {
      throw new ForbiddenException(
        'Solo el dueño del hogar puede realizar esta acción',
      );
    }
  }

  /**
   * Creates a new household for a user using env defaults.
   * NOTE: We no longer auto-create on register; this is used only when explicitly requested.
   */
  async createDefaultHouseholdForUser(
    user: UserEntity,
    manager?: EntityManager,
  ): Promise<HouseholdEntity> {
    const householdRepo = manager
      ? manager.getRepository(HouseholdEntity)
      : this.householdsRepo;

    const name: string = this.config.getOrThrow('HOUSEHOLD_NAME');
    const currency: string = this.config.getOrThrow('HOUSEHOLD_CURRENCY');

    const created = await householdRepo.save(
      householdRepo.create({
        name,
        currency,
      }),
    );

    await this.addMember(created, user, manager, { role: 'owner' });

    // If the user has no primary household yet, make this the primary.
    await this.setPrimaryHouseholdForUser(user.id, created.id, manager);

    return created;
  }

  async createHouseholdForUserOnRequest(
    userId: string,
    input?: { name?: string; currency?: string },
    manager?: EntityManager,
  ): Promise<HouseholdEntity> {
    const householdRepo = manager
      ? manager.getRepository(HouseholdEntity)
      : this.householdsRepo;

    const userRepo = manager
      ? manager.getRepository(UserEntity)
      : this.usersRepo;
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const providedName = input?.name?.trim();
    const name: string = providedName
      ? providedName
      : this.config.getOrThrow('HOUSEHOLD_NAME');

    const providedCurrency = input?.currency?.trim();
    const currency: string = providedCurrency
      ? providedCurrency.toUpperCase()
      : this.config.getOrThrow('HOUSEHOLD_CURRENCY');

    const created = await householdRepo.save(
      householdRepo.create({
        name,
        currency,
      }),
    );

    await this.addMember(created, user, manager, { role: 'owner' });

    // Safe default: only set primary if none exists yet.
    await this.setPrimaryHouseholdForUser(user.id, created.id, manager, {
      onlyIfEmpty: true,
    });

    return created;
  }

  async addMember(
    household: HouseholdEntity,
    user: UserEntity,
    manager?: EntityManager,
    opts?: { role?: 'owner' | 'member' },
  ): Promise<HouseholdMemberEntity> {
    const memberRepo = manager
      ? manager.getRepository(HouseholdMemberEntity)
      : this.membersRepo;

    const member = memberRepo.create({
      household,
      user,
      role: opts?.role ?? 'member',
    });
    return memberRepo.save(member);
  }

  /**
   * Owner creates a user (email or phone) and adds them to the owner's current household.
   * Behavior rules (per product decision):
   * - If email exists => 409
   * - If phone exists => 409
   */
  async registerMemberFromMyHousehold(
    ownerUserId: string,
    input: {
      email?: string;
      phone?: string;
      password: string;
      displayName: string;
    },
  ) {
    const household = await this.getHouseholdForUser(ownerUserId);
    if (!household) {
      throw new NotFoundException('Hogar no encontrado');
    }

    await this.assertOwnerOfHousehold(household.id, ownerUserId);

    const email = input.email ? String(input.email).trim().toLowerCase() : '';
    const phone = input.phone ? String(input.phone).trim() : '';
    if (!email && !phone) {
      throw new ConflictException(
        'El correo electrónico o el teléfono son obligatorios',
      );
    }

    const passwordHash = await this.hashPassword(input.password);

    const result = await this.householdsRepo.manager.transaction(
      async (manager) => {
        if (email) {
          const exists = await this.users.existsByEmail(email, manager);
          if (exists) {
            throw new ConflictException(
              'El correo electrónico ya está registrado',
            );
          }
        }
        if (phone) {
          const exists = await this.users.existsByPhone(phone, manager);
          if (exists) {
            throw new ConflictException('El teléfono ya está registrado');
          }
        }

        const user = await this.users.createUser(
          {
            email: email || null,
            phone: phone || null,
            displayName: input.displayName,
            password: passwordHash,
          },
          manager,
        );

        await this.addMember(household, user, manager, { role: 'member' });

        // Ensure the new user sees this household by default.
        await this.setPrimaryHouseholdForUser(user.id, household.id, manager);

        return {
          userId: user.id,
          email: user.email,
        };
      },
    );

    return {
      ok: true,
      household: { id: household.id, name: household.name },
      user: {
        id: result.userId,
        email: email || null,
        phone: phone || null,
        displayName: input.displayName,
      },
    };
  }

  async setPrimaryHouseholdForUser(
    userId: string,
    householdId: string,
    manager?: EntityManager,
    opts?: { onlyIfEmpty?: boolean },
  ): Promise<void> {
    const repo = manager ? manager.getRepository(UserEntity) : this.usersRepo;

    const user = await repo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    if (opts?.onlyIfEmpty && user.primaryHouseholdId) {
      return;
    }
    user.primaryHouseholdId = householdId;
    await repo.save(user);
  }

  async getHouseholdForUser(userId: string): Promise<HouseholdEntity | null> {
    // Primary household first.
    const user = await this.usersRepo.findOneBy({ id: userId });
    const primaryHouseholdId = user?.primaryHouseholdId ?? null;
    const primaryId =
      typeof primaryHouseholdId === 'string' ? primaryHouseholdId : null;
    if (primaryId) {
      const primaryMember = await this.membersRepo
        .createQueryBuilder('m')
        .innerJoinAndSelect('m.household', 'h')
        .where('m.userId = :userId', { userId })
        .andWhere('m.householdId = :householdId', {
          householdId: primaryId,
        })
        .getOne();
      if (primaryMember?.household) {
        return primaryMember.household;
      }
    }

    // Fallback: pick the earliest membership (legacy data / no primary set).
    const member = await this.membersRepo
      .createQueryBuilder('m')
      .innerJoinAndSelect('m.household', 'h')
      .where('m.userId = :userId', { userId })
      .orderBy('m.createdAt', 'ASC')
      .getOne();

    return member?.household ?? null;
  }

  async renameMyHousehold(userId: string, name: string) {
    const household = await this.getHouseholdForUser(userId);
    if (!household) {
      throw new NotFoundException('Hogar no encontrado');
    }

    household.name = name;
    await this.householdsRepo.save(household);

    return { ok: true, household: { id: household.id, name: household.name } };
  }

  /**
   * Search for a user by email or phone to check if they can be invited.
   * Returns information about whether the user exists and if they're already a member.
   */
  async searchUserForInvite(
    ownerUserId: string,
    identifier: string,
    opts?: { householdId?: string },
  ): Promise<{
    exists: boolean;
    isAlreadyMember: boolean;
    canInvite: boolean;
    displayName?: string;
    method: 'email' | 'phone';
  }> {
    let household: HouseholdEntity | null = null;

    if (opts?.householdId) {
      household = await this.householdsRepo.findOne({
        where: { id: opts.householdId },
      });
      if (!household) {
        throw new NotFoundException('Hogar no encontrado');
      }

      // Must be at least a member to check membership; if you want stricter rules,
      // change this to assertOwnerOfHousehold.
      const isMember = await this.isUserInHousehold(household.id, ownerUserId);
      if (!isMember) {
        throw new ForbiddenException('No eres miembro de este hogar');
      }
    } else {
      household = await this.getHouseholdForUser(ownerUserId);
      if (!household) {
        throw new NotFoundException('Hogar no encontrado');
      }
    }

    // Detect if identifier is email or phone
    const isEmail = identifier.includes('@');

    if (isEmail) {
      const normalizedEmail = this.normalizeEmail(identifier);
      if (!normalizedEmail) {
        return {
          exists: false,
          isAlreadyMember: false,
          canInvite: true,
          method: 'email',
        };
      }

      const user = await this.users.findByEmail(normalizedEmail);
      if (!user) {
        return {
          exists: false,
          isAlreadyMember: false,
          canInvite: true,
          method: 'email',
        };
      }

      const isAlreadyMember = await this.isUserInHousehold(
        household.id,
        user.id,
      );

      return {
        exists: true,
        isAlreadyMember,
        canInvite: !isAlreadyMember,
        displayName: user.displayName,
        method: 'email',
      };
    } else {
      const normalizedPhone = this.users.normalizePhone(identifier);
      if (!normalizedPhone) {
        return {
          exists: false,
          isAlreadyMember: false,
          canInvite: true,
          method: 'phone',
        };
      }

      const user = await this.users.findByPhone(normalizedPhone);
      if (!user) {
        return {
          exists: false,
          isAlreadyMember: false,
          canInvite: true,
          method: 'phone',
        };
      }

      const isAlreadyMember = await this.isUserInHousehold(
        household.id,
        user.id,
      );

      return {
        exists: true,
        isAlreadyMember,
        canInvite: !isAlreadyMember,
        displayName: user.displayName,
        method: 'phone',
      };
    }
  }

  /**
   * Creates an invitation for the current user's (primary) household.
   * This does NOT require the invited user to exist yet.
   * Supports both email and phone invitations.
   */
  async invite(
    inviterUserId: string,
    input: { email?: string; phone?: string },
    manager?: EntityManager,
  ): Promise<{
    ok: true;
    invitationId: string;
    token: string;
    email: string | null;
    phone: string | null;
    method: 'email' | 'phone';
  }> {
    const email = input.email ? this.normalizeEmail(input.email) : null;
    const phone = input.phone ? this.users.normalizePhone(input.phone) : null;

    if (!email && !phone) {
      throw new ConflictException(
        'El correo electrónico o el teléfono son obligatorios',
      );
    }

    const household = await this.getHouseholdForUser(inviterUserId);
    if (!household) {
      throw new NotFoundException('Hogar no encontrado');
    }

    const invitationRepo = manager
      ? manager.getRepository(HouseholdInvitationEntity)
      : this.invitationsRepo;

    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);

    const phoneLookupHash = phone
      ? this.users.computePhoneLookupHash(phone)
      : null;

    try {
      const created = await invitationRepo.save(
        invitationRepo.create({
          householdId: household.id,
          email: email,
          phoneLookupHash: phoneLookupHash,
          invitedIdentifier: email || phone,
          tokenHash,
          status: 'pending',
          invitedById: inviterUserId,
          expiresAt: null,
          acceptedAt: null,
          acceptedById: null,
        }),
      );

      return {
        ok: true,
        invitationId: created.id,
        token,
        email: email,
        phone: phone,
        method: email ? 'email' : 'phone',
      };
    } catch {
      // Likely partial unique index hit: already has a pending invite.
      throw new ConflictException('Ya existe una invitación pendiente');
    }
  }

  /**
   * Phase 2: invite to a specific household (owner-only).
   */
  async inviteToHouseholdForOwner(
    ownerUserId: string,
    householdId: string,
    input: { email?: string; phone?: string },
    manager?: EntityManager,
  ): Promise<{
    ok: true;
    invitationId: string;
    token: string;
    email: string | null;
    phone: string | null;
    method: 'email' | 'phone';
  }> {
    const email = input.email ? this.normalizeEmail(input.email) : null;
    const phone = input.phone ? this.users.normalizePhone(input.phone) : null;

    if (!email && !phone) {
      throw new ConflictException(
        'El correo electrónico o el teléfono son obligatorios',
      );
    }

    const householdRepo = manager
      ? manager.getRepository(HouseholdEntity)
      : this.householdsRepo;
    const invitationRepo = manager
      ? manager.getRepository(HouseholdInvitationEntity)
      : this.invitationsRepo;

    const household = await householdRepo.findOne({
      where: { id: householdId },
    });
    if (!household) {
      throw new NotFoundException('Hogar no encontrado');
    }

    await this.assertOwnerOfHousehold(householdId, ownerUserId, manager);

    // Optional safety: don't invite someone who is already a member.
    if (email) {
      const user = await this.users.findByEmail(email);
      if (user) {
        const already = await this.isUserInHousehold(householdId, user.id);
        if (already) {
          throw new ConflictException('El usuario ya es miembro de este hogar');
        }
      }
    }
    if (phone) {
      const user = await this.users.findByPhone(phone);
      if (user) {
        const already = await this.isUserInHousehold(householdId, user.id);
        if (already) {
          throw new ConflictException('El usuario ya es miembro de este hogar');
        }
      }
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);

    const phoneLookupHash = phone
      ? this.users.computePhoneLookupHash(phone)
      : null;

    try {
      const created = await invitationRepo.save(
        invitationRepo.create({
          householdId: household.id,
          email: email,
          phoneLookupHash: phoneLookupHash,
          invitedIdentifier: email || phone,
          tokenHash,
          status: 'pending',
          invitedById: ownerUserId,
          expiresAt: null,
          acceptedAt: null,
          acceptedById: null,
        }),
      );

      return {
        ok: true,
        invitationId: created.id,
        token,
        email,
        phone,
        method: email ? 'email' : 'phone',
      };
    } catch {
      throw new ConflictException('Ya existe una invitación pendiente');
    }
  }

  async listInvitationsForOwner(
    ownerUserId: string,
    householdId: string,
  ): Promise<
    Array<{
      id: string;
      householdId: string;
      status: 'pending' | 'accepted' | 'revoked' | 'expired';
      invitedIdentifier: string | null;
      email: string | null;
      createdAt: Date;
      expiresAt: Date | null;
      acceptedAt: Date | null;
      invitedById: string | null;
      acceptedById: string | null;
    }>
  > {
    const household = await this.householdsRepo.findOne({
      where: { id: householdId },
    });
    if (!household) {
      throw new NotFoundException('Hogar no encontrado');
    }

    await this.assertOwnerOfHousehold(householdId, ownerUserId);

    // Mark expired invitations (best-effort).
    await this.invitationsRepo
      .createQueryBuilder()
      .update(HouseholdInvitationEntity)
      .set({ status: 'expired' })
      .where('householdId = :householdId', { householdId })
      .andWhere("status = 'pending'")
      .andWhere('expiresAt IS NOT NULL')
      .andWhere('expiresAt <= now()')
      .execute();

    const rows = await this.invitationsRepo
      .createQueryBuilder('i')
      .where('i.householdId = :householdId', { householdId })
      .select([
        'i.id as id',
        'i.householdId as "householdId"',
        'i.status as status',
        'i.invitedIdentifier as "invitedIdentifier"',
        'i.email as email',
        'i.createdAt as "createdAt"',
        'i.expiresAt as "expiresAt"',
        'i.acceptedAt as "acceptedAt"',
        'i.invitedById as "invitedById"',
        'i.acceptedById as "acceptedById"',
      ])
      .orderBy('i.createdAt', 'DESC')
      .getRawMany<{
        id: string;
        householdId: string;
        status: 'pending' | 'accepted' | 'revoked' | 'expired';
        invitedIdentifier: string | null;
        email: string | null;
        createdAt: Date;
        expiresAt: Date | null;
        acceptedAt: Date | null;
        invitedById: string | null;
        acceptedById: string | null;
      }>();

    return rows;
  }

  async revokeInvitationForOwner(
    ownerUserId: string,
    householdId: string,
    invitationId: string,
  ): Promise<{ ok: true; invitationId: string; status: 'revoked' }> {
    const invitation = await this.invitationsRepo.findOne({
      where: { id: invitationId, householdId },
    });
    if (!invitation) {
      throw new NotFoundException('Invitación no encontrada');
    }

    await this.assertOwnerOfHousehold(householdId, ownerUserId);

    if (invitation.status !== 'pending') {
      throw new ConflictException(
        'Solo se pueden revocar invitaciones pendientes',
      );
    }

    // If an invitation already expired, treat it as non-revocable.
    if (invitation.expiresAt && invitation.expiresAt.getTime() <= Date.now()) {
      invitation.status = 'expired';
      await this.invitationsRepo.save(invitation);
      throw new ConflictException('La invitación ya expiró');
    }

    invitation.status = 'revoked';
    await this.invitationsRepo.save(invitation);

    return { ok: true, invitationId: invitation.id, status: 'revoked' };
  }

  async setMemberRoleForOwner(
    ownerUserId: string,
    householdId: string,
    memberUserId: string,
    role: 'owner' | 'member',
  ): Promise<{ ok: true; userId: string; role: 'owner' | 'member' }> {
    return this.membersRepo.manager.transaction(async (manager) => {
      const householdRepo = manager.getRepository(HouseholdEntity);
      const memberRepo = manager.getRepository(HouseholdMemberEntity);

      const household = await householdRepo.findOne({
        where: { id: householdId },
      });
      if (!household) {
        throw new NotFoundException('Hogar no encontrado');
      }

      await this.assertOwnerOfHousehold(householdId, ownerUserId, manager);

      const member = await memberRepo
        .createQueryBuilder('m')
        .where('m.householdId = :householdId', { householdId })
        .andWhere('m.userId = :userId', { userId: memberUserId })
        .getOne();
      if (!member) {
        throw new NotFoundException('Miembro no encontrado');
      }

      if (member.role === role) {
        return { ok: true, userId: memberUserId, role };
      }

      if (member.role === 'owner' && role === 'member') {
        const owners = await memberRepo
          .createQueryBuilder('m')
          .where('m.householdId = :householdId', { householdId })
          .andWhere("m.role = 'owner'")
          .getCount();

        if (owners <= 1) {
          throw new ForbiddenException('El hogar debe tener al menos un owner');
        }
      }

      member.role = role;
      await memberRepo.save(member);
      return { ok: true, userId: memberUserId, role };
    });
  }

  async removeMemberForOwner(
    ownerUserId: string,
    householdId: string,
    memberUserId: string,
  ): Promise<{ ok: true; removedUserId: string }> {
    if (memberUserId === ownerUserId) {
      throw new ConflictException('No puedes expulsarte a ti mismo');
    }

    return this.membersRepo.manager.transaction(async (manager) => {
      const householdRepo = manager.getRepository(HouseholdEntity);
      const memberRepo = manager.getRepository(HouseholdMemberEntity);
      const userRepo = manager.getRepository(UserEntity);

      const household = await householdRepo.findOne({
        where: { id: householdId },
      });
      if (!household) {
        throw new NotFoundException('Hogar no encontrado');
      }

      await this.assertOwnerOfHousehold(householdId, ownerUserId, manager);

      const member = await memberRepo
        .createQueryBuilder('m')
        .where('m.householdId = :householdId', { householdId })
        .andWhere('m.userId = :userId', { userId: memberUserId })
        .getOne();
      if (!member) {
        throw new NotFoundException('Miembro no encontrado');
      }

      if (member.role === 'owner') {
        const owners = await memberRepo
          .createQueryBuilder('m')
          .where('m.householdId = :householdId', { householdId })
          .andWhere("m.role = 'owner'")
          .getCount();
        if (owners <= 1) {
          throw new ForbiddenException('No puedes expulsar al último owner');
        }
      }

      await memberRepo.delete({ id: member.id });

      // If the removed user had this household as primary, assign a fallback.
      const removedUser = await userRepo.findOne({
        where: { id: memberUserId },
      });
      if (removedUser?.primaryHouseholdId === householdId) {
        const fallback = await memberRepo
          .createQueryBuilder('m')
          .where('m.userId = :userId', { userId: memberUserId })
          .orderBy('m.createdAt', 'ASC')
          .select(['m.householdId as "householdId"'])
          .getRawOne<{ householdId: string }>();

        removedUser.primaryHouseholdId = fallback?.householdId ?? null;
        await userRepo.save(removedUser);
      }

      return { ok: true, removedUserId: memberUserId };
    });
  }

  /**
   * Legacy method - redirects to unified invite()
   * @deprecated Use invite() instead
   */
  async inviteByEmail(
    inviterUserId: string,
    email: string,
    manager?: EntityManager,
  ): Promise<{ ok: true; invitationId: string; token: string; email: string }> {
    const result = await this.invite(inviterUserId, { email }, manager);
    return {
      ok: true,
      invitationId: result.invitationId,
      token: result.token,
      email: result.email ?? email,
    };
  }

  /**
   * Auto-accept invitation by email.
   * Safety rule:
   * - if exactly 1 pending invitation exists for the email => accept it.
   * - if 0 => return null
   * - if >1 => return null (requires token-based accept to disambiguate)
   */
  async acceptInvitationForUserByEmail(
    email: string,
    userId: string,
    manager?: EntityManager,
  ): Promise<HouseholdEntity | null> {
    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail) {
      return null;
    }

    const invitationRepo = manager
      ? manager.getRepository(HouseholdInvitationEntity)
      : this.invitationsRepo;
    const memberRepo = manager
      ? manager.getRepository(HouseholdMemberEntity)
      : this.membersRepo;
    const userRepo = manager
      ? manager.getRepository(UserEntity)
      : this.usersRepo;

    const pending = await invitationRepo
      .createQueryBuilder('i')
      .where('i.email = :email', { email: normalizedEmail })
      .andWhere('i.status = :status', { status: 'pending' })
      .andWhere('(i.expiresAt IS NULL OR i.expiresAt > now())')
      .orderBy('i.createdAt', 'DESC')
      .getMany();

    if (pending.length !== 1) {
      return null;
    }

    const invitation = pending[0];
    const householdId = invitation.householdId;

    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Ensure membership exists.
    const exists = await memberRepo.exists({
      where: { household: { id: householdId }, user: { id: userId } },
    });
    if (!exists) {
      await memberRepo.save(
        memberRepo.create({
          household: { id: householdId } as HouseholdEntity,
          user: { id: userId } as UserEntity,
          role: 'member',
        }),
      );
    }

    // Make invited household the primary.
    user.primaryHouseholdId = householdId;
    await userRepo.save(user);

    invitation.status = 'accepted';
    invitation.acceptedAt = new Date();
    invitation.acceptedById = userId;
    await invitationRepo.save(invitation);

    const householdRepo = manager
      ? manager.getRepository(HouseholdEntity)
      : this.householdsRepo;
    return householdRepo.findOne({ where: { id: householdId } });
  }

  /**
   * Auto-accept invitation by phone.
   * Safety rule:
   * - if exactly 1 pending invitation exists for the phone => accept it.
   * - if 0 => return null
   * - if >1 => return null (requires token-based accept to disambiguate)
   */
  async acceptInvitationForUserByPhone(
    phone: string,
    userId: string,
    manager?: EntityManager,
  ): Promise<HouseholdEntity | null> {
    const normalizedPhone = this.users.normalizePhone(phone);
    if (!normalizedPhone) {
      return null;
    }

    const phoneLookupHash = this.users.computePhoneLookupHash(normalizedPhone);

    const invitationRepo = manager
      ? manager.getRepository(HouseholdInvitationEntity)
      : this.invitationsRepo;
    const memberRepo = manager
      ? manager.getRepository(HouseholdMemberEntity)
      : this.membersRepo;
    const userRepo = manager
      ? manager.getRepository(UserEntity)
      : this.usersRepo;

    const pending = await invitationRepo
      .createQueryBuilder('i')
      .where('i.phoneLookupHash = :phoneLookupHash', { phoneLookupHash })
      .andWhere('i.status = :status', { status: 'pending' })
      .andWhere('(i.expiresAt IS NULL OR i.expiresAt > now())')
      .orderBy('i.createdAt', 'DESC')
      .getMany();

    if (pending.length !== 1) {
      return null;
    }

    const invitation = pending[0];
    const householdId = invitation.householdId;

    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Ensure membership exists.
    const exists = await memberRepo.exists({
      where: { household: { id: householdId }, user: { id: userId } },
    });
    if (!exists) {
      await memberRepo.save(
        memberRepo.create({
          household: { id: householdId } as HouseholdEntity,
          user: { id: userId } as UserEntity,
          role: 'member',
        }),
      );
    }

    // Make invited household the primary.
    user.primaryHouseholdId = householdId;
    await userRepo.save(user);

    invitation.status = 'accepted';
    invitation.acceptedAt = new Date();
    invitation.acceptedById = userId;
    await invitationRepo.save(invitation);

    const householdRepo = manager
      ? manager.getRepository(HouseholdEntity)
      : this.householdsRepo;
    return householdRepo.findOne({ where: { id: householdId } });
  }

  async acceptInvitationForUserByToken(
    token: string,
    userId: string,
    manager?: EntityManager,
  ): Promise<HouseholdEntity> {
    const tokenHash = this.hashToken(token);

    const invitationRepo = manager
      ? manager.getRepository(HouseholdInvitationEntity)
      : this.invitationsRepo;
    const memberRepo = manager
      ? manager.getRepository(HouseholdMemberEntity)
      : this.membersRepo;
    const userRepo = manager
      ? manager.getRepository(UserEntity)
      : this.usersRepo;
    const householdRepo = manager
      ? manager.getRepository(HouseholdEntity)
      : this.householdsRepo;

    const invitation = await invitationRepo
      .createQueryBuilder('i')
      .where('i.tokenHash = :tokenHash', { tokenHash })
      .andWhere('(i.expiresAt IS NULL OR i.expiresAt > now())')
      .getOne();

    if (!invitation) {
      throw new NotFoundException('Invitación no encontrada');
    }

    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const householdId = invitation.householdId;

    // If the invitation is already accepted/revoked/etc, treat token as non-reusable.
    // BUT: make this endpoint idempotent for the same user (or if the user is already a member)
    // so the UX "pegar código" doesn't fail after auto-accept-by-email on register.
    if (invitation.status !== 'pending') {
      const alreadyMember = await memberRepo.exists({
        where: { household: { id: householdId }, user: { id: userId } },
      });

      if (alreadyMember) {
        user.primaryHouseholdId = householdId;
        await userRepo.save(user);

        const household = await householdRepo.findOne({
          where: { id: householdId },
        });
        if (!household) {
          throw new NotFoundException('Hogar no encontrado');
        }
        return household;
      }

      // Someone else used the token (or it was revoked/expired).
      throw new ConflictException('Invitación ya utilizada');
    }

    const exists = await memberRepo.exists({
      where: { household: { id: householdId }, user: { id: userId } },
    });
    if (!exists) {
      await memberRepo.save(
        memberRepo.create({
          household: { id: householdId } as HouseholdEntity,
          user: { id: userId } as UserEntity,
          role: 'member',
        }),
      );
    }

    user.primaryHouseholdId = householdId;
    await userRepo.save(user);

    invitation.status = 'accepted';
    invitation.acceptedAt = new Date();
    invitation.acceptedById = userId;
    await invitationRepo.save(invitation);

    const household = await householdRepo.findOne({
      where: { id: householdId },
    });
    if (!household) {
      throw new NotFoundException('Hogar no encontrado');
    }
    return household;
  }

  async isUserInHousehold(
    householdId: string,
    userId: string,
  ): Promise<boolean> {
    return this.membersRepo.exists({
      where: { household: { id: householdId }, user: { id: userId } },
    });
  }

  async listMembers(householdId: string): Promise<
    Array<{
      userId: string;
      email: string;
      displayName: string;
      role: 'owner' | 'member';
    }>
  > {
    const rows = await this.membersRepo
      .createQueryBuilder('m')
      .innerJoin('m.user', 'u')
      .where('m.householdId = :householdId', { householdId })
      .select([
        'u.id as "userId"',
        'u.email as "email"',
        'u.displayName as "displayName"',
        'm.role as "role"',
      ])
      .orderBy('u.displayName', 'ASC')
      .getRawMany<{
        userId: string;
        email: string;
        displayName: string;
        role: 'owner' | 'member';
      }>();

    return rows;
  }

  async listMembersForUser(
    householdId: string,
    userId: string,
  ): Promise<
    Array<{
      userId: string;
      email: string;
      displayName: string;
      role: 'owner' | 'member';
    }>
  > {
    const household = await this.householdsRepo.findOne({
      where: { id: householdId },
    });
    if (!household) {
      throw new NotFoundException('Hogar no encontrado');
    }

    const isMember = await this.isUserInHousehold(householdId, userId);
    if (!isMember) {
      throw new ForbiddenException('No eres miembro de este hogar');
    }

    return this.listMembers(householdId);
  }

  async updateHouseholdForOwner(
    ownerUserId: string,
    householdId: string,
    input: { name?: string; currency?: string },
  ): Promise<{ ok: true; household: HouseholdEntity }> {
    const household = await this.householdsRepo.findOne({
      where: { id: householdId },
    });
    if (!household) {
      throw new NotFoundException('Hogar no encontrado');
    }

    await this.assertOwnerOfHousehold(householdId, ownerUserId);

    if (typeof input.name === 'string') {
      household.name = input.name.trim();
    }
    if (typeof input.currency === 'string') {
      household.currency = input.currency.trim().toUpperCase();
    }

    const saved = await this.householdsRepo.save(household);
    return { ok: true, household: saved };
  }

  async listMyMembers(
    userId: string,
  ): Promise<Array<{ userId: string; email: string; displayName: string }>> {
    const household = await this.getHouseholdForUser(userId);
    if (!household) {
      throw new NotFoundException('Hogar no encontrado');
    }

    return this.listMembers(household.id);
  }

  async listMyHouseholds(userId: string): Promise<
    Array<{
      id: string;
      name: string;
      currency: string;
      isPrimary: boolean;
      role: 'owner' | 'member';
    }>
  > {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const memberships = await this.membersRepo
      .createQueryBuilder('m')
      .innerJoinAndSelect('m.household', 'h')
      .where('m.userId = :userId', { userId })
      .orderBy('m.createdAt', 'ASC')
      .getMany();

    return memberships.map((m) => ({
      id: m.household.id,
      name: m.household.name,
      currency: m.household.currency,
      isPrimary: m.household.id === user.primaryHouseholdId,
      role: m.role,
    }));
  }

  async switchPrimaryHousehold(
    userId: string,
    householdId: string,
  ): Promise<{ ok: true; household: HouseholdEntity }> {
    const isMember = await this.isUserInHousehold(householdId, userId);
    if (!isMember) {
      throw new ForbiddenException('No es miembro de este hogar');
    }

    await this.setPrimaryHouseholdForUser(userId, householdId);

    const household = await this.householdsRepo.findOne({
      where: { id: householdId },
    });
    if (!household) {
      throw new NotFoundException('Hogar no encontrado');
    }

    return { ok: true, household };
  }

  /**
   * Deletes a household.
   * Rules:
   * - Only an owner of the household can delete it.
   * - Deletion is destructive and cascades to household-scoped data (memberships, invitations, lists, expenses, etc).
   * - For any user whose primaryHouseholdId becomes null, we try to assign a fallback household
   *   (their earliest remaining membership).
   */
  async deleteHouseholdForOwner(
    ownerUserId: string,
    householdId: string,
  ): Promise<{ ok: true; deletedHouseholdId: string }> {
    return this.householdsRepo.manager.transaction(async (manager) => {
      const householdRepo = manager.getRepository(HouseholdEntity);
      const memberRepo = manager.getRepository(HouseholdMemberEntity);
      const userRepo = manager.getRepository(UserEntity);

      const household = await householdRepo.findOne({
        where: { id: householdId },
      });
      if (!household) {
        throw new NotFoundException('Hogar no encontrado');
      }

      await this.assertOwnerOfHousehold(householdId, ownerUserId, manager);

      // Snapshot affected users before deletion (memberships will be cascade-deleted).
      const affectedUsers = await memberRepo
        .createQueryBuilder('m')
        .where('m.householdId = :householdId', { householdId })
        .select(['DISTINCT m.userId as "userId"'])
        .getRawMany<{ userId: string }>();

      await householdRepo.delete({ id: householdId });

      // Re-assign primary household when it becomes null due to the delete.
      for (const row of affectedUsers) {
        const user = await userRepo.findOne({ where: { id: row.userId } });
        if (!user) continue;

        if (user.primaryHouseholdId) {
          // Still points to an existing household; keep it.
          continue;
        }

        const fallback = await memberRepo
          .createQueryBuilder('m')
          .where('m.userId = :userId', { userId: row.userId })
          .orderBy('m.createdAt', 'ASC')
          .select(['m.householdId as "householdId"'])
          .getRawOne<{ householdId: string }>();

        user.primaryHouseholdId = fallback?.householdId ?? null;
        await userRepo.save(user);
      }

      return { ok: true, deletedHouseholdId: householdId };
    });
  }
}
