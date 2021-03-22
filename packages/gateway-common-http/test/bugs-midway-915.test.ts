import { parseInvokeOptionsByOriginUrl } from '../src';
import * as assert from 'assert';
// bugs from https://github.com/midwayjs/midway/issues/915
describe('/test/bugs-midway-915.test.ts', () => {
  it('same path level', async () => {
    const { invokeOptions } = await parseInvokeOptionsByOriginUrl(
      {
        functionDir: '',
      },
      {
        path: '/json',
        method: 'get',
      },
      () => {
        return {
          functionList: {
            a: {
              handler: 'test.a',
              events: [
                {
                  http: {
                    path: '/json',
                  },
                },
              ],
            },
            b: {
              handler: 'test.b',
              events: [
                {
                  http: {
                    path: '/:user_id',
                  },
                },
              ],
            },
          },
        };
      }
    );
    assert(invokeOptions.functionName === 'a');
  });
  it('diff path level 1', async () => {
    const { invokeOptions } = await parseInvokeOptionsByOriginUrl(
      {
        functionDir: '',
      },
      {
        path: '/json/a',
        method: 'get',
      },
      () => {
        return {
          functionList: {
            a: {
              handler: 'test.a',
              events: [
                {
                  http: {
                    path: '/json/:a',
                  },
                },
              ],
            },
            b: {
              handler: 'test.b',
              events: [
                {
                  http: {
                    path: '/:user_id',
                  },
                },
              ],
            },
            c: {
              handler: 'test.c',
              events: [
                {
                  http: {
                    path: '/json/a',
                  },
                },
              ],
            },
          },
        };
      }
    );
    assert(invokeOptions.functionName === 'c');
  });
});
