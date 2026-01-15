import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { numericTransformer } from '../common/typeorm/numeric.transformer';
import { HouseholdEntity } from '../households/household.entity';
import { UserEntity } from '../users/user.entity';

export type ExpenseSourceType = 'shopping_item' | 'manual';

@Entity('expenses')
@Unique('uq_expenses_source', ['sourceType', 'sourceId'])
export class ExpenseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => HouseholdEntity, { nullable: false, onDelete: 'CASCADE' })
  household!: HouseholdEntity;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'RESTRICT' })
  payer!: UserEntity;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  amount!: number;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({ type: 'varchar', length: 120 })
  description!: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  category?: string | null;

  @Column({ type: 'timestamptz' })
  occurredAt!: Date;

  @Index()
  @Column({ type: 'varchar', length: 30 })
  sourceType!: ExpenseSourceType;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  sourceId?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
