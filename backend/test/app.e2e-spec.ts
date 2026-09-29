import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect({
        name: 'Leadflow API',
        status: 'ok',
        version: '1.0.0',
      });
  });

  it('/leads (GET)', () => {
    return request(app.getHttpServer())
      .get('/leads')
      .expect(200)
      .then((response) => {
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);

        const firstLead = response.body[0];
        expect(firstLead).toMatchObject({
          id: expect.any(String),
          tenant_id: expect.any(String),
          name: expect.any(String),
          email: expect.any(String),
          phone: expect.any(String),
          source: expect.any(String),
          status: expect.stringMatching(
            /^(NEW|CONTACTED|QUALIFIED|WON|LOST|FOLLOW_UP_REQUIRED)$/,
          ),
          assigned_to: expect.any(String),
          created_at: expect.any(String),
          updated_at: expect.any(String),
        });
        expect(firstLead.lost_reason).toBeNull();
      });
  });

  it('/auth/login and /auth/me', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'owner-a@example.com',
        password: 'Password123!',
      })
      .expect(201);

    expect(loginResponse.body.access_token).toEqual(expect.any(String));
    expect(loginResponse.body.user).toMatchObject({
      email: 'owner-a@example.com',
      role: 'OWNER',
    });

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${loginResponse.body.access_token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          email: 'owner-a@example.com',
          role: 'OWNER',
        });
        expect(body.passwordHash).toBeUndefined();
      });
  });

  it('/auth/me rejects missing credentials', () => {
    return request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  afterEach(async () => {
    await app.close();
  });
});
