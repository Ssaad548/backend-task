import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventsGateway } from './events.gateway';
import { EventsCoreModule } from './events-core.module';

@Module({
  imports: [AuthModule, EventsCoreModule],
  providers: [EventsGateway],
  exports: [EventsCoreModule],
})
export class EventsModule {}
