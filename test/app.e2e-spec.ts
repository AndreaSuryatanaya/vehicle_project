import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    await app.listen(0, '127.0.0.1');
  });

  it('GET / returns the standard success envelope', async () => {
    await request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect({
        message: 'Success',
        statusCode: 200,
        isSuccess: true,
        data: 'Hello World!',
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
