import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from '../users/user.entity';
import { HouseholdEntity } from './household.entity';

export type HouseholdInvitationStatus =
  | 'pending'
  | 'accepted'
  | 'revoked'
  | 'expired';

@Entity('household_invitations')
@Index('IDX_household_invitations_email', ['email'])
@Index('IDX_household_invitations_phone_lookup_hash', ['phoneLookupHash'])
@Index(
  'uq_household_invitation_household_email_pending',
  ['household', 'email'],
  {
    unique: true,
    // Postgres partial unique index to avoid multiple active invites per household+email.
    where: `"status" = 'pending' AND "email" IS NOT NULL`,
  },
)
@Index(
  'uq_household_invitation_household_phone_pending',
  ['household', 'phoneLookupHash'],
  {
    unique: true,
    // Postgres partial unique index to avoid multiple active invites per household+phone.
    where: `"status" = 'pending' AND "phoneLookupHash" IS NOT NULL`,
  },
)
export class HouseholdInvitationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => HouseholdEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'householdId' })
  household!: HouseholdEntity;

  @Column({ type: 'uuid' })
  householdId!: string;

  @Column({ type: 'varchar', length: 320, nullable: true })
  email!: string | null;

  // Phone lookup hash for invitations by phone (HMAC-SHA256)
  @Column({ type: 'varchar', length: 64, nullable: true })
  phoneLookupHash!: string | null;

  // Original identifier used for invitation (email or phone)
  @Column({ type: 'varchar', length: 320, nullable: true })
  invitedIdentifier!: string | null;

  // sha256(token) hex string (64 chars)
  @Column({ type: 'varchar', length: 64 })
  tokenHash!: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: HouseholdInvitationStatus;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'invitedById' })
  invitedBy?: UserEntity | null;

  @Column({ type: 'uuid', nullable: true })
  invitedById!: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'acceptedById' })
  acceptedBy?: UserEntity | null;

  @Column({ type: 'uuid', nullable: true })
  acceptedById!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;
}
