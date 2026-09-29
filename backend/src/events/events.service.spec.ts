import type { LeadStatus } from '@prisma/client';
import { EventsService } from './events.service';
import type { LeadRecord } from '../leads/leads.repository';

describe('EventsService', () => {
  it('emits only to the tenant owner and agent rooms', () => {
    const service = new EventsService();
    const emitted: Array<{ room: string; event: string; lead: LeadRecord }> = [];
    const server = {
      to: (room: string) => ({
        emit: (event: string, lead: LeadRecord) => emitted.push({ room, event, lead }),
      }),
      emit: jest.fn(),
    };
    const lead = {
      id: 'lead-id',
      tenantId: 'tenant-a',
      name: 'Ava Rahman',
      email: 'ava@example.com',
      phone: null,
      source: 'Website',
      status: 'NEW' as LeadStatus,
      assignedTo: 'agent-current',
      lostReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      assignee: { id: 'agent-current', name: 'Current Agent' },
    } as LeadRecord;

    service.setServer(server as never);
    service.emitLeadEvent('lead.assigned', lead, 'agent-previous');

    expect(emitted.map(({ room }) => room)).toEqual([
      'tenant:tenant-a:owners',
      'tenant:tenant-a:user:agent-current',
      'tenant:tenant-a:user:agent-previous',
    ]);
    expect(emitted.every(({ event, lead: emittedLead }) => event === 'lead.assigned' && emittedLead === lead)).toBe(true);
    expect(server.emit).not.toHaveBeenCalled();
  });
});
