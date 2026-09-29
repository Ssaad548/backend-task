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

  afterEach(async () => {
    await app.close();
  });
});
