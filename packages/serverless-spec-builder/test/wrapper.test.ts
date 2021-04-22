import { writeWrapper, formetAggregationHandlers } from '../src/wrapper';
import { resolve } from 'path';
import * as assert from 'assert';
import { existsSync, readFileSync, remove, mkdirpSync } from 'fs-extra';

describe('/test/wrapper.test.ts', () => {
  const wrapperPath = resolve(__dirname, './fixtures/wrapper');

  afterEach(async () => {
    await remove(wrapperPath);
  });

  describe('test all format', () => {
    beforeEach(async () => {
      await remove(wrapperPath);
      mkdirpSync(wrapperPath);
    });
    it('writeWrapper functionMap', async () => {
      const wrapperPath = resolve(__dirname, './fixtures/wrapper');
      writeWrapper({
        initializeName: 'initializeUserDefine',
        middleware: ['test1', 'test2'],
        cover: true,
        service: {
          functions: {
            aggregation: {
              handler: 'aggre.handler',
              _isAggregation: true,
              functions: ['index'],
              _handlers: [
                { path: '/api/test', handler: 'index.handler' },
                { path: '/*', handler: 'render.handler' },
              ],
            },
            index: {
              handler: 'index.handler',
              isFunctional: true,
              exportFunction: 'aggregation',
              sourceFilePath: 'fun-index.js',
            },
            render: {
              handler: 'render.handler',
            },
          },
        },
        baseDir: wrapperPath,
        distDir: wrapperPath,
        starter: 'testStarter',
        moreArgs: true,
      });
      const aggrePath = resolve(wrapperPath, 'aggre.js');
      const indexPath = resolve(wrapperPath, 'index.js');
      const renderPath = resolve(wrapperPath, 'render.js');

      assert(existsSync(aggrePath));
      assert(existsSync(indexPath));
      assert(existsSync(renderPath));
      const aggreContent = readFileSync(aggrePath).toString();
      assert(/exports\.initializeUserDefine\s*=/.test(aggreContent));
      assert(
        aggreContent.indexOf('handler.method.indexOf(currentMethod)') !== -1
      );
      assert(
        aggreContent.indexOf(
          'starter.handleInvokeWrapper(handler.handler)(ctx, ...args)'
        ) !== -1
      );
      assert(aggreContent.indexOf('async (ctx, ...args)') !== -1);
      assert(
        /exports\.initializeUserDefine\s*=/.test(
          readFileSync(indexPath).toString()
        )
      );
      assert(
        /exports\.initializeUserDefine\s*=/.test(
          readFileSync(renderPath).toString()
        )
      );
    });

    it('writeWrapper aggregation', async () => {
      const wrapperPath = resolve(__dirname, './fixtures/wrapper');
      const registerFunction = resolve(wrapperPath, 'registerFunction.js');
      if (existsSync(registerFunction)) {
        await remove(registerFunction);
      }
      writeWrapper({
        initializeName: 'initializeUserDefine',
        middleware: ['test1', 'test2'],
        cover: true,
        service: {
          functions: {
            aggregation: {
              handler: 'aggre.handler',
              _isAggregation: true,
              functions: ['index'],
              _handlers: [
                {
                  path: '/api/test',
                  handler: 'index.handler',
                  argsPath: 'ctx.request.data.args',
                  isFunctional: true,
                  exportFunction: 'test',
                  sourceFilePath: 'fun-index.js',
                },
                { path: '/*', handler: 'render.handler' },
              ],
            },
          },
          layers: {
            testNpm: {
              path: 'npm:test',
            },
            'remote-debug': {
              path: 'oss:remote-debug',
            },
            testOss: {
              path: 'oss:test',
            },
          },
        },
        baseDir: wrapperPath,
        distDir: wrapperPath,
        starter: 'testStarter',
      });
      const aggrePath = resolve(wrapperPath, 'aggre.js');
      assert(
        /const layer_npm_testNpm = require\('test'\);/.test(
          readFileSync(aggrePath).toString()
        )
      );
      assert(/layer_oss_remote_debug/.test(readFileSync(aggrePath).toString()));
    });
    it('writeWrapper', async () => {
      const wrapperPath = resolve(__dirname, './fixtures/wrapper');
      const registerFunction = resolve(wrapperPath, 'registerFunction.js');
      if (existsSync(registerFunction)) {
        await remove(registerFunction);
      }
      writeWrapper({
        initializeName: 'initializeUserDefine',
        middleware: ['test1', 'test2'],
        cover: true,
        service: {
          functions: {
            aggregation: {
              handler: 'aggre.handler',
              _isAggregation: true,
              functions: ['index'],
              _handlers: [
                { path: '/api/test', handler: 'index.handler', method: 'get' },
                {
                  path: '/*',
                  handler: 'render.handler',
                  method: ['post', 'Get'],
                },
              ],
            },
            index: {
              handler: 'index.handler',
            },
            render: {
              handler: 'render.handler',
            },
          },
        },
        baseDir: wrapperPath,
        distDir: wrapperPath,
        starter: 'testStarter',
      });
      const aggrePath = resolve(wrapperPath, 'aggre.js');
      const indexPath = resolve(wrapperPath, 'index.js');
      const renderPath = resolve(wrapperPath, 'render.js');
      assert(existsSync(aggrePath));
      assert(existsSync(indexPath));
      assert(existsSync(renderPath));
      assert(!existsSync(registerFunction));
      assert(
        !/registerFunctionToIocByConfig/.test(
          readFileSync(aggrePath).toString()
        )
      );
      assert(
        readFileSync(aggrePath)
          .toString()
          .indexOf('handler.method.indexOf(currentMethod)') !== -1
      );
      assert(
        !/require\('registerFunction\.js'\)/.test(
          readFileSync(aggrePath).toString()
        )
      );
      assert(
        /exports\.initializeUserDefine\s*=/.test(
          readFileSync(aggrePath).toString()
        )
      );
      assert(
        /exports\.initializeUserDefine\s*=/.test(
          readFileSync(indexPath).toString()
        )
      );
      assert(
        /exports\.initializeUserDefine\s*=/.test(
          readFileSync(renderPath).toString()
        )
      );
    });
  });
  it('formetAggregationHandlers', async () => {
    const formatResult = formetAggregationHandlers([
      { path: '/api/1' },
      { path: '/api/' },
      { path: '/' },
      { path: '/api/*' },
      { path: '/api2' },
      { path: '/api/2' },
      { path: '/api' },
      { path: '/*' },
    ]);
    assert(formatResult[2].router === '/api/');
    assert(formatResult[3].router === '/api/**');
    assert(formatResult[4].router === '/api2');
    assert(formatResult[5].router === '/api');
    assert(formatResult[6].router === '/');
    assert(formatResult[7].router === '/**');
  });
});
