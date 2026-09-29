import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityType, LeadStatus, Role } from '@prisma/client';
import type { RequestContext } from '../auth/auth.types';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { FollowUpScheduler } from './lead-hooks';
import { CreateLeadDto, ListLeadsQueryDto } from './leads.dto';
import { LeadRecord, LeadsRepository } from './leads.repository';

const transitions: Record<LeadStatus, LeadStatus[]> = {
  NEW: [LeadStatus.CONTACTED],
  FOLLOW_UP_REQUIRED: [LeadStatus.CONTACTED],
  CONTACTED: [LeadStatus.QUALIFIED],
  QUALIFIED: [LeadStatus.WON],
  WON: [],
  LOST: [],
};

function toLeadResponse(lead: LeadRecord) {
  return {
    id: lead.id,
    tenant_id: lead.tenantId,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    source: lead.source,
    status: lead.status,
    assigned_to: lead.assignedTo,
    lost_reason: lead.lostReason,
    created_at: lead.createdAt,
    updated_at: lead.updatedAt,
    assignee: lead.assignee,
  };
}

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leadsRepository: LeadsRepository,
    private readonly followUpScheduler: FollowUpScheduler,
    private readonly eventsService: EventsService,
  ) {}

  async create(actor: RequestContext, dto: CreateLeadDto) {
    this.requireOwner(actor);

    const lead = await this.prisma.$transaction(async (tx) => {
      const created = await this.leadsRepository.create(actor.tenantId, dto, tx);
      await tx.leadActivity.create({
        data: {
          tenantId: actor.tenantId,
          leadId: created.id,
          actorId: actor.userId,
          type: ActivityType.LEAD_CREATED,
        },
      });
      return created;
    });

    this.followUpScheduler.schedule(lead.id, actor.tenantId);
    this.eventsService.emitLeadEvent('lead.created', lead);
    return toLeadResponse(lead);
  }

  async findMany(actor: RequestContext, query: ListLeadsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [leads, total] = await this.leadsRepository.findMany(actor.tenantId, {
      status: query.status,
      assignedTo: actor.role === Role.AGENT ? actor.userId : query.assignedTo,
      search: query.search,
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: leads.map(toLeadResponse),
      meta: { page, limit, total },
    };
  }

  async findOne(actor: RequestContext, id: string) {
    const lead = await this.leadsRepository.findOne(actor.tenantId, id, {
      assignedTo: actor.role === Role.AGENT ? actor.userId : undefined,
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return toLeadResponse(lead);
  }

  async assign(actor: RequestContext, id: string, assignedTo: string) {
    this.requireOwner(actor);
    const current = await this.getTenantLead(actor, id);
    this.requireMutableStatus(current.status);

    const target = await this.prisma.user.findFirst({
      where: { id: assignedTo, tenantId: actor.tenantId, role: Role.AGENT },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException('Agent not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await this.leadsRepository.assign(
        actor.tenantId,
        id,
        target.id,
        current.status,
        tx,
      );
      if (result.count === 0 || !result.lead) {
        throw new ConflictException('Lead was modified by someone else. Refresh and retry.');
      }

      await tx.leadActivity.create({
        data: {
          tenantId: actor.tenantId,
          leadId: id,
          actorId: actor.userId,
          type: ActivityType.LEAD_ASSIGNED,
          note: `Assigned to ${target.id}`,
        },
      });
      return result.lead;
    });

    this.eventsService.emitLeadEvent('lead.assigned', updated, current.assignedTo);
    return toLeadResponse(updated);
  }

  async changeStatus(actor: RequestContext, id: string, nextStatus: LeadStatus) {
    const current = await this.getVisibleLead(actor, id);
    const allowed = transitions[current.status];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(
        `Cannot change status from ${current.status} to ${nextStatus}. Allowed: ${allowed.join(', ') || 'none'}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await this.leadsRepository.changeStatus(
        actor.tenantId,
        id,
        current.status,
        nextStatus,
        actor.role === Role.AGENT ? actor.userId : undefined,
        tx,
      );
      if (result.count === 0 || !result.lead) {
        throw new ConflictException('Lead was modified by someone else. Refresh and retry.');
      }

      await tx.leadActivity.create({
        data: {
          tenantId: actor.tenantId,
          leadId: id,
          actorId: actor.userId,
          type: ActivityType.STATUS_CHANGED,
          fromStatus: current.status,
          toStatus: nextStatus,
        },
      });
      return result.lead;
    });

    this.followUpScheduler.cancel(id);
    this.eventsService.emitLeadEvent('lead.status_changed', updated);
    return toLeadResponse(updated);
  }

  async markLost(actor: RequestContext, id: string, reason: string) {
    const current = await this.getVisibleLead(actor, id);
    this.requireMutableStatus(current.status);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await this.leadsRepository.markLost(
        actor.tenantId,
        id,
        current.status,
        reason,
        actor.role === Role.AGENT ? actor.userId : undefined,
        tx,
      );
      if (result.count === 0 || !result.lead) {
        throw new ConflictException('Lead was modified by someone else. Refresh and retry.');
      }

      await tx.leadActivity.create({
        data: {
          tenantId: actor.tenantId,
          leadId: id,
          actorId: actor.userId,
          type: ActivityType.LEAD_LOST,
          fromStatus: current.status,
          toStatus: LeadStatus.LOST,
          note: reason,
        },
      });
      return result.lead;
    });

    this.followUpScheduler.cancel(id);
    this.eventsService.emitLeadEvent('lead.lost', updated);
    return toLeadResponse(updated);
  }

  private async getTenantLead(actor: RequestContext, id: string) {
    const lead = await this.leadsRepository.findOne(actor.tenantId, id);
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    return lead;
  }

  private async getVisibleLead(actor: RequestContext, id: string) {
    const lead = await this.leadsRepository.findOne(actor.tenantId, id, {
      assignedTo: actor.role === Role.AGENT ? actor.userId : undefined,
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    return lead;
  }

  private requireOwner(actor: RequestContext) {
    if (actor.role !== Role.OWNER) {
      throw new ForbiddenException('Owner role required');
    }
  }

  private requireMutableStatus(status: LeadStatus) {
    if (status === LeadStatus.WON || status === LeadStatus.LOST) {
      throw new ConflictException(`Cannot modify a ${status} lead`);
    }
  }
}
