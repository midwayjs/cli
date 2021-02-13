'use strict';
import { join } from 'path';
import * as assert from 'assert';
import { createApp, close } from '@midwayjs/mock';
const request = require('supertest');
const cwd = join(__dirname, 'fixtures/faas');
describe('test/index.test.ts', () => {
  let app;
  beforeAll(async () => {
    app = await createApp(cwd, {}, join(__dirname, '../src'));
  });
  afterAll(async () => {
    await close(app);
  })
  it('http get', async (done) => {
    request(app)
      .get('/hello?name=test&age=123')
      .expect(200)
      .then(response => {
        assert(response.body.path === '/hello')
        assert(response.body.method === 'GET')
        assert(response.body.headers)
        assert(response.body.query.name === 'test')
        assert(response.body.query.age === '123')
        done();
      })
      .catch(err => done(err));
  });
  it('http post', async (done) => {
    await request(app)
      .post('/hello')
      .type('form')
      .send({id: '1'})
      .expect(200)
      .then(response => {
        assert(response.body.path === '/hello')
        assert(response.body.method === 'POST')
        assert(/x-www-form-urlencoded/.test(response.body.headers['content-type']))
        assert(response.body.body.id === '1')
        done();
      })
      .catch(err => done(err));
  });
  it.only('http post upload', async (done) => {
    const imagePath = join(
      __dirname,
      'fixtures/faas',
      '1.jpg'
    );
    await request(app)
      .post('/upload')
      .field('name', 'form')
      .attach('file', imagePath)
      .expect(200)
      .then(async response => {
        console.log('response', response.body);
        await new Promise(resolve => {
          setTimeout(resolve, 5000);
        })
        done();
      })
      .catch(err => done(err));
  });
});
