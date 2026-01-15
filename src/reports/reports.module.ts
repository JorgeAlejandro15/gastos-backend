import { Module } from '@nestjs/common';
import { ExpensesModule } from '../expenses/expenses.module';
import { HouseholdsModule } from '../households/households.module';
import { IncomesModule } from '../incomes/incomes.module';
import { ReportsController } from './reports.controller';

@Module({
  imports: [ExpensesModule, IncomesModule, HouseholdsModule],
  controllers: [ReportsController],
})
export class ReportsModule {}
