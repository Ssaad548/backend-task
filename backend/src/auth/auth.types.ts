import type { Role } from '@prisma/client';

export interface RequestContext {
  userId: string;
  tenantId: string;
  role: Role;
}