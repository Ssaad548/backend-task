import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(FollowUpProcessor.name);

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
      this.logger.log(
        `[follow-up] job finished: leadId=${leadId} tenantId=${tenantId} name=<not found> result=skipped reason=lead_not_found`,
      );
      return;
    }

    this.logger.log(
      `[follow-up] job started: leadId=${leadId} tenantId=${tenantId} name=${JSON.stringify(lead.name)}`,
    );

    const result = await this.prisma.lead.updateMany({
      where: { id: leadId, tenantId, status: LeadStatus.NEW },
      data: { status: LeadStatus.FOLLOW_UP_REQUIRED },
    });

    if (result.count !== 1) {
      this.logger.log(
        `[follow-up] job finished: leadId=${leadId} tenantId=${tenantId} name=${JSON.stringify(lead.name)} result=skipped reason=lead_not_new_or_already_processed`,
      );
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
    this.logger.log(
      `[follow-up] job finished: leadId=${leadId} tenantId=${tenantId} name=${JSON.stringify(lead.name)} result=updated`,
    );
  }
}