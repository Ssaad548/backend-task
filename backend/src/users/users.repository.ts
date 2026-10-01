import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const agentSelect = {
  id: true,
  name: true,
  email: true,
} satisfies Prisma.UserSelect;

export type AgentRecord = Prisma.UserGetPayload<{ select: typeof agentSelect }>;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAgents(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId, role: Role.AGENT },
      select: agentSelect,
      orderBy: { name: 'asc' },
    });
  }
}
