import { Injectable } from '@nestjs/common';
import {
  LeadStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const leadSelect = {
  id: true,
  tenantId: true,
  name: true,
  email: true,
  phone: true,
  source: true,
  status: true,
  assignedTo: true,
  lostReason: true,
  createdAt: true,
  updatedAt: true,
  assignee: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.LeadSelect;

export type LeadRecord = Prisma.LeadGetPayload<{ select: typeof leadSelect }>;
export type LeadDbClient = PrismaService | Prisma.TransactionClient;

export interface LeadListFilters {
  status?: LeadStatus;
  assignedTo?: string;
  search?: string;
  skip: number;
  take: number;
}

@Injectable()
export class LeadsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(tenantId: string, filters: LeadListFilters) {
    const search = filters.search?.trim();
    const where: Prisma.LeadWhereInput = {
      tenantId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.assignedTo ? { assignedTo: filters.assignedTo } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return Promise.all([
      this.prisma.lead.findMany({
        where,
        select: leadSelect,
        orderBy: { createdAt: 'desc' },
        skip: filters.skip,
        take: filters.take,
      }),
      this.prisma.lead.count({ where }),
    ]);
  }

  findOne(
    tenantId: string,
    id: string,
    options: { assignedTo?: string } = {},
    client: LeadDbClient = this.prisma,
  ) {
    return client.lead.findFirst({
      where: {
        id,
        tenantId,
        ...(options.assignedTo ? { assignedTo: options.assignedTo } : {}),
      },
      select: leadSelect,
    });
  }

  create(
    tenantId: string,
    data: {
      name: string;
      email: string;
      phone?: string | null;
      source?: string | null;
    },
    client: LeadDbClient = this.prisma,
  ) {
    return client.lead.create({
      data: {
        tenantId,
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        source: data.source ?? null,
        status: LeadStatus.NEW,
        assignedTo: null,
      },
      select: leadSelect,
    });
  }

  async assign(
    tenantId: string,
    id: string,
    assignedTo: string,
    currentStatus: LeadStatus,
    client: LeadDbClient = this.prisma,
  ) {
    const result = await client.lead.updateMany({
      where: { id, tenantId, status: currentStatus },
      data: { assignedTo },
    });

    return {
      count: result.count,
      lead: result.count === 1 ? await this.findOne(tenantId, id, {}, client) : null,
    };
  }

  async changeStatus(
    tenantId: string,
    id: string,
    currentStatus: LeadStatus,
    nextStatus: LeadStatus,
    actorAssignedTo: string | undefined,
    client: LeadDbClient = this.prisma,
  ) {
    const result = await client.lead.updateMany({
      where: {
        id,
        tenantId,
        status: currentStatus,
        ...(actorAssignedTo ? { assignedTo: actorAssignedTo } : {}),
      },
      data: { status: nextStatus },
    });

    return {
      count: result.count,
      lead: result.count === 1 ? await this.findOne(tenantId, id, {}, client) : null,
    };
  }

  async markLost(
    tenantId: string,
    id: string,
    currentStatus: LeadStatus,
    reason: string,
    actorAssignedTo: string | undefined,
    client: LeadDbClient = this.prisma,
  ) {
    const result = await client.lead.updateMany({
      where: {
        id,
        tenantId,
        status: currentStatus,
        ...(actorAssignedTo ? { assignedTo: actorAssignedTo } : {}),
      },
      data: { status: LeadStatus.LOST, lostReason: reason },
    });

    return {
      count: result.count,
      lead: result.count === 1 ? await this.findOne(tenantId, id, {}, client) : null,
    };
  }
}