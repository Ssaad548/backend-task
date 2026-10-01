import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import type { Queue } from 'bullmq';
import request from 'supertest';
import { App } from 'supertest/types';
import { io, type Socket } from 'socket.io-client';
import { EventsService } from './../src/events/events.service';
import { FollowUpProcessor } from './../src/follow-up/follow-up.processor';
import { FollowUpQueue } from './../src/follow-up/follow-up.queue';
import type { FollowUpJobData } from './../src/follow-up/follow-up.constants';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

type AuthSession = {
  token: string;
  user: { id: string; tenantId: string; role: 'OWNER' | 'AGENT' };
};

type Lead = {
  id: string;
  tenant_id: string;
  name: string;
  status: string;
  assigned_to: string | null;
};

const login = async (app: INestApplication<App>, email: string): Promise<AuthSession> => {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password: 'Password123!' })
    .expect(201);

  return {
    token: response.body.access_token as string,
    user: response.body.user as AuthSession['user'],
  };
};

describe('Lead management (e2e)', () => {
  let app: INestApplication<App>;
  let ownerA: AuthSession;
  let agentA: AuthSession;
  let agentA2: AuthSession;
  let ownerB: AuthSession;
  let agentB: AuthSession;
  let tenantALeads: Lead[];
  let followUpProcessor: FollowUpProcessor;
  let followUpQueue: FollowUpQueue;
  let socketUrl: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    await app.listen(0);
    socketUrl = await app.getUrl();

    followUpProcessor = new FollowUpProcessor(
      app.get(PrismaService),
      app.get(EventsService),
    );
    followUpQueue = app.get(FollowUpQueue);

    ownerA = await login(app, 'owner-a@example.com');
    agentA = await login(app, 'agent-a@example.com');

    const prisma = app.get(PrismaService);
    await prisma.user.upsert({
      where: { email: 'agent-a-2@example.com' },
      update: {},
      create: {
        tenantId: ownerA.user.tenantId,
        name: 'Agent A 2',
        email: 'agent-a-2@example.com',
        passwordHash: await bcrypt.hash('Password123!', 10),
        role: 'AGENT',
      },
    });
    agentA2 = await login(app, 'agent-a-2@example.com');
    ownerB = await login(app, 'owner-b@example.com');
    agentB = await login(app, 'agent-b@example.com');

    const response = await request(app.getHttpServer())
      .get('/leads')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(200);
    tenantALeads = response.body.data as Lead[];
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns tenant-scoped leads with pagination metadata', () => {
    expect(tenantALeads.length).toBeGreaterThan(0);
    expect(tenantALeads.every((lead) => lead.tenant_id === ownerA.user.tenantId)).toBe(true);
    expect(tenantALeads).toEqual(expect.arrayContaining([expect.objectContaining({ tenant_id: ownerA.user.tenantId })]));
  });

  it('returns only assigned leads to an agent', async () => {
    const response = await request(app.getHttpServer())
      .get('/leads')
      .set('Authorization', `Bearer ${agentA.token}`)
      .expect(200);

    expect(response.body.data).toHaveLength(4);
    expect(response.body.data.every((lead: Lead) => lead.assigned_to === agentA.user.id)).toBe(true);
  });

  it('prevents an agent from viewing or updating another agent\'s lead', async () => {
    const response = await request(app.getHttpServer())
      .post('/leads')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ name: 'Agent isolation lead', email: 'agent-isolation@example.com' })
      .expect(201);
    const leadId = response.body.id as string;

    await request(app.getHttpServer())
      .patch(`/leads/${leadId}/assign`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ assignedTo: agentA2.user.id })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/leads/${leadId}`)
      .set('Authorization', `Bearer ${agentA.token}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/leads/${leadId}/status`)
      .set('Authorization', `Bearer ${agentA.token}`)
      .send({ status: 'CONTACTED' })
      .expect(404);
  });

  it('does not overwrite CONTACTED, LOST, or WON leads', async () => {
    const createLead = async (name: string) => {
      const response = await request(app.getHttpServer())
        .post('/leads')
        .set('Authorization', `Bearer ${ownerA.token}`)
        .send({ name, email: `${name.toLowerCase().replaceAll(' ', '-')}@example.com` })
        .expect(201);
      return response.body.id as string;
    };

    const contactedId = await createLead('Follow-up contacted');
    await request(app.getHttpServer())
      .patch(`/leads/${contactedId}/status`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ status: 'CONTACTED' })
      .expect(200);

    const lostId = await createLead('Follow-up lost');
    await request(app.getHttpServer())
      .patch(`/leads/${lostId}/lost`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ reason: 'No longer needed' })
      .expect(200);

    const wonId = await createLead('Follow-up won');
    for (const status of ['CONTACTED', 'QUALIFIED', 'WON']) {
      await request(app.getHttpServer())
        .patch(`/leads/${wonId}/status`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .send({ status })
        .expect(200);
    }

    for (const [leadId, status] of [
      [contactedId, 'CONTACTED'],
      [lostId, 'LOST'],
      [wonId, 'WON'],
    ] as const) {
      await followUpProcessor.process({
        data: { leadId, tenantId: ownerA.user.tenantId },
      } as never);

      await request(app.getHttpServer())
        .get(`/leads/${leadId}`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.status).toBe(status);
        });
    }
  });

  it('does not create duplicate follow-up jobs for a lead', async () => {
    const response = await request(app.getHttpServer())
      .post('/leads')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ name: 'Duplicate follow-up', email: 'duplicate-follow-up@example.com' })
      .expect(201);
    const leadId = response.body.id as string;
    const queue = (followUpQueue as unknown as { queue: Queue<FollowUpJobData> }).queue;

    await followUpQueue.schedule(leadId, ownerA.user.tenantId);
    await followUpQueue.schedule(leadId, ownerA.user.tenantId);

    const jobs = await queue.getJobs(
      ['delayed', 'waiting', 'active', 'paused', 'prioritized'],
      0,
      -1,
      true,
    );
    const matchingJobs = jobs.filter((job) => job.id === `follow-up-${leadId}`);

    expect(matchingJobs).toHaveLength(1);
    await followUpQueue.cancel(leadId);
  });

  it('isolates lead events across tenant owner and agent sockets', async () => {
    const sessions = [ownerA, agentA, ownerB, agentB];
    const sockets = await Promise.all(
      sessions.map(
        (session) =>
          new Promise<Socket>((resolve, reject) => {
            const socket = io(socketUrl, {
              auth: { token: session.token },
              transports: ['websocket'],
            });
            socket.once('connect', () => resolve(socket));
            socket.once('connect_error', reject);
          }),
      ),
    );
    const received = [0, 0, 0, 0];
    const eventReceived = new Promise<void>((resolve) => {
      sockets.forEach((socket, index) => {
        socket.on('lead.created', () => {
          received[index] += 1;
          if (index === 0) {
            resolve();
          }
        });
      });
    });

    try {
      await request(app.getHttpServer())
        .post('/leads')
        .set('Authorization', `Bearer ${ownerA.token}`)
        .send({ name: 'Socket isolation lead', email: 'socket-isolation@example.com' })
        .expect(201);

      await eventReceived;
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(received).toEqual([1, 0, 0, 0]);
    } finally {
      sockets.forEach((socket) => socket.disconnect());
    }
  });

  it('hides other tenants and unassigned agent leads with 404', async () => {
    const tenantBResponse = await request(app.getHttpServer())
      .get('/leads')
      .set('Authorization', `Bearer ${ownerB.token}`)
      .expect(200);
    const tenantBLead = (tenantBResponse.body.data as Lead[])[0];
    const unassignedLead = tenantALeads.find((lead) => lead.assigned_to === null);

    expect(tenantBLead).toBeDefined();
    expect(tenantALeads).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: tenantBLead.id })]),
    );

    await request(app.getHttpServer())
      .get(`/leads/${tenantBLead.id}`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/leads/${unassignedLead?.id}`)
      .set('Authorization', `Bearer ${agentA.token}`)
      .expect(404);
  });

  it('restricts creation and assignment to owners', async () => {
    const mutableLead = tenantALeads.find(
      (lead) => lead.status !== 'LOST' && lead.status !== 'WON',
    );
    expect(mutableLead).toBeDefined();
    const leadId = mutableLead!.id;

    await request(app.getHttpServer())
      .post('/leads')
      .set('Authorization', `Bearer ${agentA.token}`)
      .send({ name: 'Agent Lead', email: 'agent-lead@example.com' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/leads/${leadId}/assign`)
      .set('Authorization', `Bearer ${agentA.token}`)
      .send({ assignedTo: agentA.user.id })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/leads/${leadId}/assign`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ assignedTo: agentB.user.id })
      .expect(404)
      .expect(({ body }) => {
        expect(body.message).toBe('Agent not found');
      });
  });

  it('rejects client tenant and status fields on create', async () => {
    await request(app.getHttpServer())
      .post('/leads')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({
        name: 'Invalid Lead',
        email: 'invalid@example.com',
        tenantId: ownerB.user.tenantId,
        status: 'WON',
      })
      .expect(400);
  });

  it('enforces status transitions and terminal states', async () => {
    const newLeadResponse = await request(app.getHttpServer())
      .post('/leads')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ name: 'Invalid transition lead', email: 'invalid-transition@example.com' })
      .expect(201);
    const newLeadId = newLeadResponse.body.id as string;
    const lostLead = tenantALeads.find((lead) => lead.status === 'LOST');

    await request(app.getHttpServer())
      .patch(`/leads/${newLeadId}/status`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ status: 'QUALIFIED' })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toContain('Cannot change status from NEW to QUALIFIED');
      });

    await request(app.getHttpServer())
      .patch(`/leads/${lostLead?.id}/assign`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ assignedTo: agentA.user.id })
      .expect(409);
  });

  it('creates leads, records transitions, and trims lost reasons', async () => {
    const createdResponse = await request(app.getHttpServer())
      .post('/leads')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ name: 'Phase Four Lead', email: 'phase-four@example.com' })
      .expect(201);
    const leadId = createdResponse.body.id as string;

    expect(createdResponse.body).toMatchObject({
      tenant_id: ownerA.user.tenantId,
      status: 'NEW',
      assigned_to: null,
    });

    await request(app.getHttpServer())
      .patch(`/leads/${leadId}/status`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ status: 'CONTACTED' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/leads/${leadId}/status`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ status: 'QUALIFIED' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/leads/${leadId}/lost`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ reason: '  Budget changed  ' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('LOST');
        expect(body.lost_reason).toBe('Budget changed');
      });
  });

  it('creates tenant activity for owners and rejects agents', async () => {
    const response = await request(app.getHttpServer())
      .get('/activity')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(200);

    expect(response.body.data.every((activity: { tenant_id: string }) => activity.tenant_id === ownerA.user.tenantId)).toBe(true);
    expect(response.body.data.map((activity: { type: string }) => activity.type)).toEqual(
      expect.arrayContaining(['LEAD_CREATED', 'STATUS_CHANGED', 'LEAD_LOST']),
    );

    await request(app.getHttpServer())
      .get('/activity')
      .set('Authorization', `Bearer ${agentA.token}`)
      .expect(403);
  });
});
