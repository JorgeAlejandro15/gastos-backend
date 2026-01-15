import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { HouseholdEntity } from '../households/household.entity';
import { UserEntity } from '../users/user.entity';
import { ShoppingItemEntity } from './shopping-item.entity';

@Entity('shopping_lists')
export class ShoppingListEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => HouseholdEntity, { nullable: false, onDelete: 'CASCADE' })
  household!: HouseholdEntity;

  @Column({ type: 'varchar', length: 140 })
  name!: string;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'RESTRICT' })
  createdBy!: UserEntity;

  // If set => personal list (only visible to owner). If null => shared list for the household.
  @Index()
  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'CASCADE' })
  owner?: UserEntity | null;

  @OneToMany(() => ShoppingItemEntity, (i: ShoppingItemEntity) => i.list)
  items!: ShoppingItemEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
