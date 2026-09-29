import { Injectable } from '@nestjs/common';

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'won' | 'lost';

export interface Lead {
  id: string;
  name: string;
  email: string;
  company: string;
  status: LeadStatus;
  source: string;
  createdAt: string;
}

export interface CreateLeadDto {
  name: string;
  email: string;
  company: string;
  status?: LeadStatus;
  source?: string;
}

export interface UpdateLeadDto {
  name?: string;
  email?: string;
  company?: string;
  status?: LeadStatus;
  source?: string;
}

@Injectable()
export class LeadsService {
  private readonly leads: Lead[] = [
    {
      id: 'lead-1001',
      name: 'Alicia Morgan',
      email: 'alicia@northstar.io',
      company: 'Northstar Labs',
      status: 'qualified',
      source: 'Website',
      createdAt: new Date('2026-09-01T09:30:00.000Z').toISOString(),
    },
    {
      id: 'lead-1002',
      name: 'Daniel Brooks',
      email: 'daniel@atlasgrowth.co',
      company: 'Atlas Growth',
      status: 'contacted',
      source: 'Outbound',
      createdAt: new Date('2026-09-12T14:15:00.000Z').toISOString(),
    },
    {
      id: 'lead-1003',
      name: 'Priya Shah',
      email: 'priya@bluepeak.ai',
      company: 'BluePeak AI',
      status: 'new',
      source: 'Referral',
      createdAt: new Date('2026-09-18T11:45:00.000Z').toISOString(),
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
    const nextLead: Lead = {
      id: `lead-${Date.now()}`,
      name: dto.name,
      email: dto.email,
      company: dto.company,
      status: dto.status ?? 'new',
      source: dto.source ?? 'Manual',
      createdAt: new Date().toISOString(),
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
