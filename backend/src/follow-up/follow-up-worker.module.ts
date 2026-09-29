import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventsCoreModule } from '../events/events-core.module';
import { PrismaModule } from '../prisma/prisma.module';
import { FOLLOW_UP_QUEUE } from './follow-up.constants';
import { FollowUpEventsEmitter } from './follow-up.events-emitter';
import { FollowUpProcessor } from './follow-up.processor';
import { FollowUpQueueModule } from './follow-up-queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
      validate: (config: Record<string, unknown>) => {
        const required = ['DATABASE_URL', 'JWT_SECRET', 'REDIS_URL'];
        const missing = required.filter((key) => !config[key]);
        if (missing.length > 0) {
          throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
        }
        return config;
      },
    }),
    PrismaModule,
    EventsCoreModule,
    FollowUpQueueModule,
    BullModule.registerQueue({ name: FOLLOW_UP_QUEUE }),
  ],
  providers: [FollowUpEventsEmitter, FollowUpProcessor],
})
export class FollowUpWorkerModule {}