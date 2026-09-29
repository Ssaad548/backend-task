import { FollowUpScheduler } from './follow-up.scheduler';
import { FollowUpQueue } from './follow-up.queue';

describe('FollowUpQueue', () => {
  it('schedules deterministic delayed jobs with retry backoff', async () => {
    const queue = {
      add: jest.fn().mockResolvedValue(undefined),
      getJob: jest.fn(),
    };
    const followUpQueue = new FollowUpQueue(queue as never);
    const scheduler = new FollowUpScheduler(followUpQueue);

    await scheduler.schedule('lead-1', 'tenant-a');

    expect(queue.add).toHaveBeenCalledWith(
      'follow-up-lead',
      { leadId: 'lead-1', tenantId: 'tenant-a' },
      {
          jobId: 'follow-up-lead-1',
        delay: 120000,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );
  });

  it('removes a pending job when cancelled', async () => {
    const remove = jest.fn().mockResolvedValue(undefined);
    const queue = {
      add: jest.fn(),
      getJob: jest.fn().mockResolvedValue({ remove }),
    };
    const followUpQueue = new FollowUpQueue(queue as never);

    await followUpQueue.cancel('lead-1');

      expect(queue.getJob).toHaveBeenCalledWith('follow-up-lead-1');
    expect(remove).toHaveBeenCalled();
  });
});
