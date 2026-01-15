import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { numericTransformer } from '../common/typeorm/numeric.transformer';
import { UserEntity } from '../users/user.entity';

export type IncomeSource = 'salary' | 'gift' | 'refund' | 'other';

@Entity('incomes')
export class IncomeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Personal income: only the owner can see/manage it.
  @Index()
  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  owner!: UserEntity;

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

  @Index()
  @Column({ type: 'varchar', length: 20 })
  source!: IncomeSource;

  @Index()
  @Column({ type: 'timestamptz' })
  occurredAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
