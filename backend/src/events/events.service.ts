import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';
import type { LeadRecord } from '../leads/leads.repository';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private server?: Server;

  setServer(server: Server): void {
    this.server = server;
  }

  emitLeadEvent(
    event: string,
    lead: LeadRecord,
    previousAssigneeId?: string | null,
  ): void {
    if (!this.server) {
      this.logger.warn(`Dropped ${event}: Socket.IO server is not initialized`);
      return;
    }

    const rooms = new Set<string>([
      this.ownerRoom(lead.tenantId),
      ...(lead.assignedTo ? [this.userRoom(lead.tenantId, lead.assignedTo)] : []),
      ...(previousAssigneeId
        ? [this.userRoom(lead.tenantId, previousAssigneeId)]
        : []),
    ]);

    for (const room of rooms) {
      this.server.to(room).emit(event, lead);
    }
  }

  ownerRoom(tenantId: string): string {
    return `tenant:${tenantId}:owners`;
  }

  userRoom(tenantId: string, userId: string): string {
    return `tenant:${tenantId}:user:${userId}`;
  }
}
