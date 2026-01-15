import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HouseholdsModule } from '../households/households.module';
import { IncomeEntity } from './income.entity';
import { IncomesController } from './incomes.controller';
import { IncomesService } from './incomes.service';

@Module({
  imports: [TypeOrmModule.forFeature([IncomeEntity]), HouseholdsModule],
  controllers: [IncomesController],
  providers: [IncomesService],
  exports: [IncomesService, TypeOrmModule],
})
export class IncomesModule {}
