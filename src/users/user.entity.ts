import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { HouseholdEntity } from '../households/household.entity';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 320, nullable: true })
  email!: string | null;

  // Encrypted phone number (AES-256-GCM). Not selected by default.
  @Column({ type: 'varchar', length: 512, nullable: true, select: false })
  phoneEncrypted!: string | null;

  // Deterministic lookup hash to enforce uniqueness + allow login by phone.
  // Uses HMAC-SHA256(secret, normalizedPhone) stored as hex.
  @Index('uq_users_phone_lookup_hash', {
    unique: true,
    where: '"phoneLookupHash" IS NOT NULL',
  })
  @Column({ type: 'varchar', length: 64, nullable: true, select: false })
  phoneLookupHash!: string | null;

  @Column({ type: 'varchar', length: 120 })
  displayName!: string;

  @Column({ type: 'varchar', length: 255, select: false })
  password!: string;

  // Optional "active" household.
  // - When a user registers via an invitation, we set this to the invited household.
  // - Users can belong to multiple households via memberships, but this determines defaults.
  @Index('IDX_users_primary_household_id')
  @Column({ type: 'uuid', nullable: true })
  primaryHouseholdId!: string | null;

  @ManyToOne(() => HouseholdEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'primaryHouseholdId' })
  primaryHousehold?: HouseholdEntity | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
