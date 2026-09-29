import { PrismaClient, Role, LeadStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Every seeded user gets this password (dev/demo only)
const PASSWORD = 'Password123!';

// Fixed UUIDs make the seed idempotent (safe to run repeatedly)
const uuid = (prefix: string, n: number) =>
  `${prefix}0000000-0000-4000-9000-${String(n).padStart(12, '0')}`;

type LeadSeed = {
  n: number;
  status: LeadStatus;
  assigned: boolean;
  source: string;
  lostReason?: string;
};

// Mix of statuses and assignments so isolation and role rules are easy to verify
const leadSeeds: LeadSeed[] = [
  { n: 1, status: LeadStatus.NEW, assigned: false, source: 'Website' },
  { n: 2, status: LeadStatus.NEW, assigned: true, source: 'Referral' },
  { n: 3, status: LeadStatus.CONTACTED, assigned: true, source: 'Website' },
  { n: 4, status: LeadStatus.QUALIFIED, assigned: true, source: 'Event' },
  {
    n: 5,
    status: LeadStatus.LOST,
    assigned: true,
    source: 'Cold call',
    lostReason: 'Budget unavailable',
  },
  { n: 6, status: LeadStatus.NEW, assigned: false, source: 'Social media' },
];

const tenants = [
  { key: 'a', prefix: 'a', label: 'A', name: 'Acme Realty' },
  { key: 'b', prefix: 'b', label: 'B', name: 'Bright Solar' },
];

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  for (const t of tenants) {
    const tenantId = uuid(t.prefix, 1);

    await prisma.tenant.upsert({
      where: { id: tenantId },
      update: { name: t.name },
      create: { id: tenantId, name: t.name },
    });

    const owner = await prisma.user.upsert({
      where: { email: `owner-${t.key}@example.com` },
      update: { name: `Owner ${t.label}`, passwordHash },
      create: {
        tenantId,
        name: `Owner ${t.label}`,
        email: `owner-${t.key}@example.com`,
        passwordHash,
        role: Role.OWNER,
      },
    });

    const agent = await prisma.user.upsert({
      where: { email: `agent-${t.key}@example.com` },
      update: { name: `Agent ${t.label}`, passwordHash },
      create: {
        tenantId,
        name: `Agent ${t.label}`,
        email: `agent-${t.key}@example.com`,
        passwordHash,
        role: Role.AGENT,
      },
    });

    for (const l of leadSeeds) {
      const id = uuid(t.prefix, 100 + l.n);
      const data = {
        tenantId,
        // Distinctive names make any cross-tenant leak obvious
        name: `Tenant ${t.label} Lead ${l.n}`,
        email: `lead${l.n}@tenant-${t.key}.test`,
        phone: `+88017000${t.key === 'a' ? '1' : '2'}${String(l.n).padStart(3, '0')}`,
        source: l.source,
        status: l.status,
        assignedTo: l.assigned ? agent.id : null,
        lostReason: l.lostReason ?? null,
      };

      await prisma.lead.upsert({
        where: { id },
        update: data,
        create: { id, ...data },
      });
    }

    console.log(`Seeded tenant ${t.label}: owner=${owner.email} agent=${agent.email}`);
  }

  console.log(`\nAll seeded users share the password: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
