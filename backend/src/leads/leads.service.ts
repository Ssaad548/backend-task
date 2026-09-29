import { Injectable } from '@nestjs/common';

export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'WON'
  | 'LOST'
  | 'FOLLOW_UP_REQUIRED';

export interface Lead {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  phone: string | null;
  source: string | null;
  status: LeadStatus;
  assigned_to: string | null;
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateLeadDto {
  name: string;
  email: string;
  phone?: string | null;
  source?: string | null;
}

export interface UpdateLeadDto {
  name?: string;
  email?: string;
  phone?: string | null;
  source?: string | null;
  status?: LeadStatus;
  assigned_to?: string | null;
  lost_reason?: string | null;
}

@Injectable()
export class LeadsService {
  private readonly leads: Lead[] = [
    {
      id: 'lead-1001',
      tenant_id: 'tenant-a',
      name: 'Alicia Morgan',
      email: 'alicia@northstar.io',
      phone: '+8801700001001',
      source: 'Website',
      status: 'QUALIFIED',
      assigned_to: 'agent-a',
      lost_reason: null,
      created_at: new Date('2026-09-01T09:30:00.000Z').toISOString(),
      updated_at: new Date('2026-09-01T09:30:00.000Z').toISOString(),
    },
    {
      id: 'lead-1002',
      tenant_id: 'tenant-a',
      name: 'Daniel Brooks',
      email: 'daniel@atlasgrowth.co',
      phone: '+8801700001002',
      source: 'Outbound',
      status: 'CONTACTED',
      assigned_to: 'agent-a',
      lost_reason: null,
      created_at: new Date('2026-09-12T14:15:00.000Z').toISOString(),
      updated_at: new Date('2026-09-12T14:15:00.000Z').toISOString(),
    },
    {
      id: 'lead-1003',
      tenant_id: 'tenant-b',
      name: 'Priya Shah',
      email: 'priya@bluepeak.ai',
      phone: '+8801700001003',
      source: 'Referral',
      status: 'NEW',
      assigned_to: null,
      lost_reason: null,
      created_at: new Date('2026-09-18T11:45:00.000Z').toISOString(),
      updated_at: new Date('2026-09-18T11:45:00.000Z').toISOString(),
    },
  ];

  findAll(status?: LeadStatus): Lead[] {
    if (!status) {
      return [...this.leads];
    }

    return this.leads.filter((lead) => lead.status === status);
  }

  findOne(id: string): Lead | undefined {
    return this.leads.find((lead) => lead.id === id);
  }

  createLead(dto: CreateLeadDto): Lead {
    const now = new Date().toISOString();
    const nextLead: Lead = {
      id: `lead-${Date.now()}`,
      tenant_id: 'tenant-a',
      name: dto.name,
      email: dto.email,
      phone: dto.phone ?? null,
      source: dto.source ?? 'Website',
      status: 'NEW',
      assigned_to: null,
      lost_reason: null,
      created_at: now,
      updated_at: now,
    };

    this.leads.unshift(nextLead);
    return nextLead;
  }

  updateLead(id: string, dto: UpdateLeadDto): Lead | undefined {
    const existingLead = this.findOne(id);
    if (!existingLead) {
      return undefined;
    }

    Object.assign(existingLead, dto);
    existingLead.updated_at = new Date().toISOString();
    return existingLead;
  }

  deleteLead(id: string): boolean {
    const index = this.leads.findIndex((lead) => lead.id === id);
    if (index === -1) {
      return false;
    }

    this.leads.splice(index, 1);
    return true;
  }
}
