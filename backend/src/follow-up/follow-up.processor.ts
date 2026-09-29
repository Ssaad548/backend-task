import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ActivityType, LeadStatus } from '@prisma/client';
import type { Job } from 'bullmq';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { leadSelect } from '../leads/leads.repository';
import {
  FOLLOW_UP_QUEUE,
  type FollowUpJobData,
} from './follow-up.constants';

@Injectable()
@Processor(FOLLOW_UP_QUEUE)
export class FollowUpProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {
    super();
  }

  async process(job: Job<FollowUpJobData>): Promise<void> {
    const { leadId, tenantId } = job.data;
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, tenantId },
      select: leadSelect,
    });

    if (!lead) {
      return;
    }

    const result = await this.prisma.lead.updateMany({
      where: { id: leadId, tenantId, status: LeadStatus.NEW },
      data: { status: LeadStatus.FOLLOW_UP_REQUIRED },
    });

    if (result.count !== 1) {
      return;
    }

    const updatedLead = await this.prisma.lead.findFirstOrThrow({
      where: { id: leadId, tenantId },
      select: leadSelect,
    });

    await this.prisma.leadActivity.create({
      data: {
        tenantId,
        leadId,
        actorId: null,
        type: ActivityType.FOLLOW_UP_REQUIRED,
        fromStatus: LeadStatus.NEW,
        toStatus: LeadStatus.FOLLOW_UP_REQUIRED,
      },
    });

    this.eventsService.emitLeadEvent('lead.follow_up_required', updatedLead);
  }
}