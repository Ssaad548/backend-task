import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { LeadsService } from './leads.service';
import type {
  CreateLeadDto,
  LeadStatus,
  UpdateLeadDto,
} from './leads.service';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  getLeads(@Query('status') status?: LeadStatus) {
    return this.leadsService.findAll(status);
  }

  @Post()
  createLead(@Body() body: CreateLeadDto) {
    return this.leadsService.createLead(body);
  }

  @Patch(':id')
  updateLead(@Param('id') id: string, @Body() body: UpdateLeadDto) {
    const updatedLead = this.leadsService.updateLead(id, body);
    if (!updatedLead) {
      return { message: 'Lead not found' };
    }

    return updatedLead;
  }

  @Delete(':id')
  deleteLead(@Param('id') id: string) {
    return {
      deleted: this.leadsService.deleteLead(id),
    };
  }
}
