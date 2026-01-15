import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../users/user.entity';
import { UsersModule } from '../users/users.module';
import { HouseholdInvitationEntity } from './household-invitation.entity';
import { HouseholdMemberEntity } from './household-member.entity';
import { HouseholdEntity } from './household.entity';
import { HouseholdsController } from './households.controller';
import { HouseholdsService } from './households.service';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([
      HouseholdEntity,
      HouseholdMemberEntity,
      HouseholdInvitationEntity,
      UserEntity,
    ]),
  ],
  controllers: [HouseholdsController],
  providers: [HouseholdsService],
  exports: [HouseholdsService, TypeOrmModule],
})
export class HouseholdsModule {}
