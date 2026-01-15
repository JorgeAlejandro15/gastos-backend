import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpenseEntity } from '../expenses/expense.entity';
import { ExpensesModule } from '../expenses/expenses.module';
import { HouseholdsModule } from '../households/households.module';
import { UserEntity } from '../users/user.entity';
import { UsersModule } from '../users/users.module';
import { ListsController } from './lists.controller';
import { ListsService } from './lists.service';
import { ShoppingItemEntity } from './shopping-item.entity';
import { ShoppingListEntity } from './shopping-list.entity';

@Module({
  imports: [
    HouseholdsModule,
    UsersModule,
    ExpensesModule,
    TypeOrmModule.forFeature([
      ShoppingListEntity,
      ShoppingItemEntity,
      UserEntity,
      ExpenseEntity,
    ]),
  ],
  controllers: [ListsController],
  providers: [ListsService],
})
export class ListsModule {}
