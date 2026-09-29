import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  AssignLeadDto,
  ChangeLeadStatusDto,
  CreateLeadDto,
  ListLeadsQueryDto,
  MarkLeadLostDto,
} from './leads.dto';
import { LeadsService } from './leads.service';

@ApiTags('leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  getLeads(@CurrentUser() actor: RequestContext, @Query() query: ListLeadsQueryDto) {
    return this.leadsService.findMany(actor, query);
  }

  @Get(':id')
  getLead(@CurrentUser() actor: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.leadsService.findOne(actor, id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER)
  createLead(@CurrentUser() actor: RequestContext, @Body() body: CreateLeadDto) {
    return this.leadsService.create(actor, body);
  }

  @Patch(':id/assign')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER)
  assignLead(
    @CurrentUser() actor: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssignLeadDto,
  ) {
    return this.leadsService.assign(actor, id, body.assignedTo);
  }

  @Patch(':id/status')
  changeStatus(
    @CurrentUser() actor: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ChangeLeadStatusDto,
  ) {
    return this.leadsService.changeStatus(actor, id, body.status);
  }

  @Patch(':id/lost')
  markLost(
    @CurrentUser() actor: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MarkLeadLostDto,
  ) {
    return this.leadsService.markLost(actor, id, body.reason);
  }
}
