import { writeWrapper } from '../src/wrapper';
import { join, resolve } from 'path';
import * as assert from 'assert';
import { copy, existsSync } from 'fs-extra';
import { execSync } from 'child_process';
// import { existsSync, readFileSync, remove, mkdirpSync } from 'fs-extra';

describe('/test/faasv2.test.ts', () => {
  it('writeWrapper', async () => {
    const baseDir = resolve(__dirname, './fixtures/faas-v2');
    const dist = join(baseDir, 'dist');
    if (!existsSync(dist)) {
      await copy(join(baseDir, 'dist-back'), dist);
    }
    writeWrapper({
      service: {
        service: {
          name: 'midway-aggr',
        },
        provider: {
          name: 'aliyun',
        },
        aggregation: {
          all: {
            functionsPattern: '*',
            handler: 'all.handler',
            _isAggregation: true,
            events: [
              {
                http: {
                  method: 'any',
                  path: '/*',
                },
              },
            ],
            _handlers: [
              {
                handler: 'homeService.post',
                events: [
                  {
                    http: {
                      path: '/post',
                      method: ['post'],
                    },
                  },
                ],
                functionName: 'homeService-post',
                eventType: 'http',
                path: '/post',
                method: ['post'],
              },
              {
                handler: 'homeService.get',
                events: [
                  {
                    http: {
                      path: '/get',
                      method: ['get'],
                    },
                  },
                ],
                functionName: 'homeService-get',
                eventType: 'http',
                path: '/get',
                method: ['get'],
              },
              {
                handler: 'homeService.hello',
                events: [
                  {
                    http: {
                      path: '/',
                      method: ['get'],
                    },
                  },
                ],
                functionName: 'homeService-hello',
                eventType: 'http',
                path: '/',
                method: ['get'],
              },
            ],
            _allAggred: [
              {
                path: '/post',
                method: ['post'],
              },
              {
                path: '/get',
                method: ['get'],
              },
              {
                path: '/',
                method: ['get'],
              },
            ],
          },
        },
        custom: {
          customDomain: {
            domainName: 'auto',
          },
        },
        functions: {
          all: {
            functionsPattern: '*',
            handler: 'all.handler',
            _isAggregation: true,
            events: [
              {
                http: {
                  method: 'any',
                  path: '/*',
                },
              },
            ],
            _handlers: [
              {
                handler: 'homeService.post',
                events: [
                  {
                    http: {
                      path: '/post',
                      method: ['post'],
                    },
                  },
                ],
                functionName: 'homeService-post',
                eventType: 'http',
                path: '/post',
                method: ['post'],
              },
              {
                handler: 'homeService.get',
                events: [
                  {
                    http: {
                      path: '/get',
                      method: ['get'],
                    },
                  },
                ],
                functionName: 'homeService-get',
                eventType: 'http',
                path: '/get',
                method: ['get'],
              },
              {
                handler: 'homeService.hello',
                events: [
                  {
                    http: {
                      path: '/',
                      method: ['get'],
                    },
                  },
                ],
                functionName: 'homeService-hello',
                eventType: 'http',
                path: '/',
                method: ['get'],
              },
            ],
            _allAggred: [
              {
                path: '/post',
                method: ['post'],
              },
              {
                path: '/get',
                method: ['get'],
              },
              {
                path: '/',
                method: ['get'],
              },
            ],
          },
        },
      },
      baseDir: baseDir,
      distDir: baseDir,
      starter: '@midwayjs/serverless-fc-starter',
    });
    const out: any = execSync(`cd ${baseDir};node ./trigger.js`).toString();
    if (!existsSync(join(baseDir, 'node_modules'))) {
      execSync(`cd ${baseDir};npm i`);
    }
    assert(out.includes('initializer') && !out.includes('rror'));
  });
});
