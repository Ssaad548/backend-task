import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

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
  let ownerB: AuthSession;
  let agentB: AuthSession;
  let tenantALeads: Lead[];

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

    ownerA = await login(app, 'owner-a@example.com');
    agentA = await login(app, 'agent-a@example.com');
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
    expect(tenantALeads).toHaveLength(6);
    expect(tenantALeads.every((lead) => lead.name.startsWith('Tenant A '))).toBe(true);
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

  it('hides other tenants and unassigned agent leads with 404', async () => {
    const tenantBLead = 'b0000000-0000-4000-9000-000000000101';
    const unassignedLead = tenantALeads.find((lead) => lead.assigned_to === null);

    await request(app.getHttpServer())
      .get(`/leads/${tenantBLead}`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/leads/${unassignedLead?.id}`)
      .set('Authorization', `Bearer ${agentA.token}`)
      .expect(404);
  });

  it('restricts creation and assignment to owners', async () => {
    const leadId = tenantALeads[0].id;

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
    const newLead = tenantALeads.find((lead) => lead.status === 'NEW' && lead.assigned_to === null);
    const lostLead = tenantALeads.find((lead) => lead.status === 'LOST');

    await request(app.getHttpServer())
      .patch(`/leads/${newLead?.id}/status`)
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
