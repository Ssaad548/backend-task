import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { RequestContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ListActivityQueryDto } from './activity.dto';

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(actor: RequestContext, query: ListActivityQueryDto) {
    if (actor.role !== Role.OWNER) {
      throw new ForbiddenException('Owner role required');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = {
      tenantId: actor.tenantId,
      ...(query.leadId ? { leadId: query.leadId } : {}),
    };
    const [activities, total] = await Promise.all([
      this.prisma.leadActivity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          tenantId: true,
          leadId: true,
          actorId: true,
          type: true,
          fromStatus: true,
          toStatus: true,
          note: true,
          createdAt: true,
          actor: { select: { name: true } },
          lead: { select: { name: true } },
        },
      }),
      this.prisma.leadActivity.count({ where }),
    ]);

    return {
      data: activities.map((activity) => ({
        id: activity.id,
        tenant_id: activity.tenantId,
        lead_id: activity.leadId,
        actor_id: activity.actorId,
        actor_name: activity.actor?.name ?? 'System',
        lead_name: activity.lead.name,
        type: activity.type,
        from_status: activity.fromStatus,
        to_status: activity.toStatus,
        note: activity.note,
        created_at: activity.createdAt,
      })),
      meta: { page, limit, total },
    };
  }
}
