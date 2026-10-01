import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { RequestContext } from '../auth/auth.types';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async listAgents(actor: RequestContext) {
    if (actor.role !== Role.OWNER) {
      throw new ForbiddenException('Owner role required');
    }

    return this.usersRepository.findAgents(actor.tenantId);
  }
}
