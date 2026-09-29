import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { LeadsController } from './leads.controller';
import { FollowUpScheduler } from './lead-hooks';
import { LeadsRepository } from './leads.repository';
import { LeadsService } from './leads.service';

@Module({
  imports: [AuthModule, EventsModule],
  controllers: [LeadsController],
  providers: [LeadsService, LeadsRepository, FollowUpScheduler],
  exports: [LeadsService],
})
export class LeadsModule {}
