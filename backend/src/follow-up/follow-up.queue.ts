import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  FOLLOW_UP_JOB,
  FOLLOW_UP_QUEUE,
  type FollowUpJobData,
} from './follow-up.constants';

@Injectable()
export class FollowUpQueue {
  constructor(@InjectQueue(FOLLOW_UP_QUEUE) private readonly queue: Queue) {}

  async schedule(leadId: string, tenantId: string): Promise<void> {
    await this.queue.add(
      FOLLOW_UP_JOB,
      { leadId, tenantId } satisfies FollowUpJobData,
      {
        // BullMQ 5 reserves ':' in custom IDs; this is the equivalent deterministic key.
        jobId: `follow-up-${leadId}`,
        delay: 120000,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );
  }

  async cancel(leadId: string): Promise<void> {
    const job = await this.queue.getJob(`follow-up-${leadId}`);
    if (job) {
      await job.remove();
    }
  }
}
