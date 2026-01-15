// File: src/notifications/notifications.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HouseholdMemberEntity } from '../households/household-member.entity';
import { HouseholdsModule } from '../households/households.module';
import { UserEntity } from '../users/user.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsListener } from './notifications.listener';
import { NotificationsService } from './notifications.service';
import { PushTokenEntity } from './push-token.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PushTokenEntity,
      UserEntity,
      HouseholdMemberEntity,
    ]),
    HouseholdsModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsListener],
  exports: [NotificationsService],
})
export class NotificationsModule {}
