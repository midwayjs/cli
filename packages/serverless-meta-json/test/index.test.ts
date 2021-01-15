import { simpleGenerator } from '../src';
import { resolve } from 'path';
import * as assert from 'assert';

describe('/test/index.test.ts', () => {
  it('simpleGenerator', async () => {
    const meta = await simpleGenerator(resolve(__dirname, 'archives'), {
      service: {
        name: 'test',
      },
      functions: {
        a: {
          handler: 'a.handler',
          events: [{ http: { path: '/api/a', method: [] } }],
        },
        b: {
          handler: 'b.handler',
          events: [{ http: { path: '/api/b', method: ['GET'] } }],
        },
      },
      custom: {
        customDomain: {
          domainName: 'meta-test.example.com',
        },
      },
    });
    assert(meta['spec-version'] === '1.0.0');
    assert(meta.functions.length === 2);
    assert(meta.functions[0].name === 'a');
    assert(meta.functions[1].name === 'b');
    assert(
      meta.gateway.paths['/api/a'].ALL['x-gateway-intergration'].url.group ===
        'test'
    );
    assert(
      meta.gateway.paths['/api/a'].ALL['x-gateway-intergration'].url.name ===
        'a'
    );
    assert(
      meta.gateway.paths['/api/b'].GET['x-gateway-intergration'].url.name ===
        'b'
    );
    assert(meta.gateway['x-gateway-domain'] === 'meta-test.example.com');
  });

  it('gateway', async () => {
    const meta = await simpleGenerator(resolve(__dirname, 'archives-gateway'), {
      service: {
        name: 'test',
      },
      apiGateway: {
        type: 'test',
      },
    });
    assert(meta.gateway['kind'] === 'auto-test');
    assert(meta.gateway['testName'] === '123456');
  });
});
