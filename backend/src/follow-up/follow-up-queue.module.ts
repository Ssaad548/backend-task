import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FOLLOW_UP_QUEUE } from './follow-up.constants';
import { FollowUpQueue } from './follow-up.queue';
import { FollowUpScheduler } from './follow-up.scheduler';
import { redisConnection } from './redis-connection';

@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: redisConnection(configService),
      }),
    }),
    BullModule.registerQueue({ name: FOLLOW_UP_QUEUE }),
  ],
  providers: [FollowUpQueue, FollowUpScheduler],
  exports: [FollowUpQueue, FollowUpScheduler],
})
export class FollowUpQueueModule {}
