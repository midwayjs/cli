import * as koa from 'koa';
import * as express from 'express';
import { getKoaDevPack, getExpressDevPack } from '../src';
import { join } from 'path';
import * as request from 'supertest';
import { remove, pathExists } from 'fs-extra';
import { execSync } from 'child_process';

describe('/test/index.test.ts', () => {
  beforeEach(async () => {
    const dirs = [join(__dirname, './fixtures/ice-demo-repo')];
    for (const dir of dirs) {
      if (await pathExists(join(dir, '.faas_debug_tmp'))) {
        await remove(join(dir, '.faas_debug_tmp'));
      }
    }
  });

  describe('test buffer return', () => {
    it('test buffer result koa in http trigger', async done => {
      const app = new koa();
      const cwd = join(__dirname, './fixtures/base-fn-http');
      execSync(`cd ${cwd};npm install @midwayjs/mock@2`);
      const devPack = getKoaDevPack(cwd, {
        notWatch: true,
        notAwait: true,
      });
      app.use(
        devPack({
          functionDir: cwd,
        })
      );
      request(app.callback())
        .get('/api')
        .expect('Content-type', 'text/plain; charset=utf-8')
        .expect(/hello world/)
        .expect(200, () => {
          devPack.close();
          done();
        });
    });

    it('test buffer result koa in apigw trigger', done => {
      const app = new koa();
      const cwd = join(__dirname, './fixtures/base-fn-apigw');
      execSync(`cd ${cwd};npm install @midwayjs/mock@2`);
      const devPack = getKoaDevPack(cwd, {
        notWatch: true,
        notAwait: true,
      });
      app.use(
        devPack({
          functionDir: cwd,
        })
      );
      request(app.callback())
        .get('/api')
        .expect('Content-type', 'text/plain; charset=utf-8')
        .expect(/hello world/)
        .expect(200, () => {
          devPack.close();
          done();
        });
    });

    it('test buffer result express in http trigger', done => {
      const app = express();
      const cwd = join(__dirname, './fixtures/base-fn-http');
      execSync(`cd ${cwd};npm install @midwayjs/mock@2`);
      const devPack = getExpressDevPack(cwd, {
        notWatch: true,
        notAwait: true,
      });
      app.use(
        devPack({
          functionDir: cwd,
        })
      );
      request(app)
        .get('/api')
        .expect('Content-type', 'text/plain; charset=utf-8')
        .expect(/hello world/)
        .expect(200, () => {
          devPack.close();
          done();
        });
    });

    it('test buffer result express in apigw trigger', done => {
      const app = express();
      const cwd = join(__dirname, './fixtures/base-fn-apigw');
      execSync(`cd ${cwd};npm install @midwayjs/mock@2`);
      const devPack = getExpressDevPack(cwd, {
        notWatch: true,
        notAwait: true,
      });
      app.use(
        devPack({
          functionDir: cwd,
        })
      );
      request(app)
        .get('/api')
        .expect('Content-type', 'text/plain; charset=utf-8')
        .expect(/hello world/)
        .expect(200, () => {
          devPack.close();
          done();
        });
    });
  });
});
