import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { numericTransformer } from '../common/typeorm/numeric.transformer';
import { UserEntity } from '../users/user.entity';
import { ShoppingListEntity } from './shopping-list.entity';

@Entity('shopping_items')
export class ShoppingItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ShoppingListEntity, { nullable: false, onDelete: 'CASCADE' })
  list!: ShoppingListEntity;

  @Column({ type: 'varchar', length: 180 })
  name!: string;

  // Quantity to buy (can be decimal, e.g. kg)
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  amount!: number;

  // Unit price (money). Total expense for the item = amount * price
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
    default: 0,
  })
  price!: number;

  @Column({ type: 'varchar', length: 80, nullable: true })
  category?: string | null;

  @Index()
  @Column({ type: 'boolean', default: false })
  purchased!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  purchasedAt?: Date | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  purchasedBy?: UserEntity | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
