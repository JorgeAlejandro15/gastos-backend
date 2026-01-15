import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { UserEntity } from '../users/user.entity';
import { HouseholdEntity } from './household.entity';

@Entity('household_members')
@Unique('uq_household_member_household_user', ['household', 'user'])
export class HouseholdMemberEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => HouseholdEntity, { nullable: false, onDelete: 'CASCADE' })
  household!: HouseholdEntity;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  user!: UserEntity;

  @Column({ type: 'varchar', length: 20, default: 'member' })
  role!: 'owner' | 'member';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
