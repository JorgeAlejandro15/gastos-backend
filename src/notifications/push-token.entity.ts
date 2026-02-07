// File: src/notifications/push-token.entity.ts

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from '../users/user.entity';

@Entity('push_tokens')
export class PushTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  user!: UserEntity;

  @Index('uq_push_tokens_token', { unique: true })
  @Column({ type: 'varchar', length: 255 })
  token!: string;

  /**
   * Identifica el proveedor del token.
   * - expo: ExpoPushToken (se envía con expo-server-sdk)
   * - fcm: token nativo de FCM (se envía con firebase-admin)
   */
  @Column({ type: 'varchar', length: 10, default: 'expo' })
  tokenType!: 'expo' | 'fcm';

  @Column({ type: 'varchar', length: 20 })
  deviceType!: 'ios' | 'android' | 'web';

  @Column({ type: 'varchar', length: 255, nullable: true })
  deviceName!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
