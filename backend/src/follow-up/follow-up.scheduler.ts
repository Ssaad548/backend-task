import { Injectable } from '@nestjs/common';
import { FollowUpQueue } from './follow-up.queue';

@Injectable()
export class FollowUpScheduler {
  constructor(private readonly followUpQueue: FollowUpQueue) {}

  schedule(leadId: string, tenantId: string): Promise<void> {
    return this.followUpQueue.schedule(leadId, tenantId);
  }

  cancel(leadId: string): Promise<void> {
    return this.followUpQueue.cancel(leadId);
  }
}
