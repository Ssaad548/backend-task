import { LeadStatus } from '@prisma/client';
import { FollowUpProcessor } from './follow-up.processor';

describe('FollowUpProcessor', () => {
  const lead = {
    id: 'lead-1',
    tenantId: 'tenant-a',
    name: 'Ava Rahman',
    email: 'ava@example.com',
    phone: null,
    source: 'Website',
    status: LeadStatus.NEW,
    assignedTo: null,
    lostReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    assignee: null,
  };

  it('updates only NEW leads, records activity, and emits after success', async () => {
    const prisma = {
      lead: {
        findFirst: jest.fn().mockResolvedValueOnce(lead).mockResolvedValueOnce({
          ...lead,
          status: LeadStatus.FOLLOW_UP_REQUIRED,
        }),
        findFirstOrThrow: jest.fn().mockResolvedValue({
          ...lead,
          status: LeadStatus.FOLLOW_UP_REQUIRED,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      leadActivity: { create: jest.fn().mockResolvedValue(undefined) },
    };
    const eventsService = { emitLeadEvent: jest.fn() };
    const processor = new FollowUpProcessor(prisma as never, eventsService as never);

    await processor.process({ data: { leadId: 'lead-1', tenantId: 'tenant-a' } } as never);

    expect(prisma.lead.updateMany).toHaveBeenCalledWith({
      where: { id: 'lead-1', tenantId: 'tenant-a', status: LeadStatus.NEW },
      data: { status: LeadStatus.FOLLOW_UP_REQUIRED },
    });
    expect(prisma.leadActivity.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-a',
        leadId: 'lead-1',
        actorId: null,
        type: 'FOLLOW_UP_REQUIRED',
        fromStatus: 'NEW',
        toStatus: 'FOLLOW_UP_REQUIRED',
      },
    });
    expect(eventsService.emitLeadEvent).toHaveBeenCalledWith(
      'lead.follow_up_required',
      expect.objectContaining({ status: LeadStatus.FOLLOW_UP_REQUIRED }),
    );
  });

  it('does nothing for a stale job when the conditional update affects no rows', async () => {
    const prisma = {
      lead: {
        findFirst: jest.fn().mockResolvedValue(lead),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      leadActivity: { create: jest.fn() },
    };
    const eventsService = { emitLeadEvent: jest.fn() };
    const processor = new FollowUpProcessor(prisma as never, eventsService as never);

    await processor.process({ data: { leadId: 'lead-1', tenantId: 'tenant-a' } } as never);

    expect(prisma.leadActivity.create).not.toHaveBeenCalled();
    expect(eventsService.emitLeadEvent).not.toHaveBeenCalled();
  });
});
