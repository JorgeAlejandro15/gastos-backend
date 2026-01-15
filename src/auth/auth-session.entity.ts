import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('auth_sessions')
export class AuthSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  // sha256 hex string length = 64
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  refreshToken!: string;

  // Stored to detect refresh token reuse after rotation.
  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  previousRefreshToken!: string | null;

  @Column({ type: 'timestamptz' })
  refreshTokenExpiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  rotatedAt!: Date | null;

  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
