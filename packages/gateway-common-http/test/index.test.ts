import { join } from 'path';
import { isMatch } from 'micromatch';
import * as minimatch from 'minimatch';
import * as picomatch from 'picomatch';
import { match } from 'path-to-regexp';
import * as assert from 'assert';
import {
  createExpressSuit,
  createKoaSuit,
} from '@midwayjs/gateway-common-core';

const getInvokeFun = () => {
  const funcList = [
    {
      method: 'post',
      path: '/server/user/info',
      headers: { 'x-schema': 'bbb' },
      body: 'zhangting,hello http world,doTest',
    },
    {
      method: 'post',
      path: '/server/user/info2',
      headers: { 'x-schema': 'bbb' },
      body: 'zhangting,hello http world,doTest',
    },
    { method: 'post', path: '/api/abc', body: 'test3' },
    { method: 'post', path: '/api/a/b/c/d', body: 'test3' },
    { method: 'post', path: '/api/a/b/c', body: 'test4' },
    { method: 'post', path: '/api/', body: 'test6' },
    { method: 'post', path: '/bbbbbb/ccccc', body: 'test2' },
    {
      method: 'post',
      path: '/json/test.json',
      body: 'zhangting,hello http world,doTest',
      headers: { 'x-schema': 'bbb' },
    },
    {
      method: 'get',
      path: '/param/xijian/info',
      body: 'xijian,hello http world',
    },
  ];
  const functionList = {};
  let i = 0;
  for (const func of funcList) {
    functionList['fun' + i++] = {
      events: [
        {
          http: {
            method: func.method,
            path: func.path,
          },
        },
      ],
    };
  }
  return async () => {
    return {
      functionList,
      invoke: async ctx => {
        const result = funcList.find(func => {
          return (
            func.method === ctx.data[0].method.toLowerCase() &&
            func.path === ctx.data[0].path
          );
        });
        return Object.assign(
          {
            statusCode: 200,
            body: '',
          },
          result || {},
          {
            headers: Object.assign(
              {
                'Content-type': 'text/html; charset=utf-8',
              },
              result.headers
            ),
          }
        );
      },
    };
  };
};

describe('/test/index.test.ts', () => {
  describe('test url match', () => {
    it('test micromatch', () => {
      assert.equal(isMatch('/server/user/info', '/server/user/info'), true);
      assert.equal(isMatch('/server/user/info', '/server/user/info/1'), false);
      assert.equal(isMatch('/server/user/info', '/server/user/info/**'), true);
      assert.equal(isMatch('/server/user/info', '/server/user/**'), true);
      assert.equal(isMatch('/bbbbbb/ccccc', '/**'), true);
      assert.equal(isMatch('/api/abc', '/api/**'), true);
      assert.equal(isMatch('/api/a/b/c/d', '/api/a/b/c'), false);
    });

    it('test path-to-regexp', () => {
      assert.equal(!!match('/server/user/info')('/server/user/info'), true);
      assert.equal(!!match('/server/user/info/1')('/server/user/info'), false);
      assert.equal(
        !!match('/server/user/info/(.*)?')('/server/user/info'),
        true
      );
      assert.equal(!!match('/server/user/(.*)?')('/server/user/info'), true);
      assert.equal(!!match('/(.*)?')('/bbbbbb/ccccc'), true);
      assert.equal(!!match('/api/(.*)?')('/api/abc'), true);
      assert.equal(!!match('/api/a/b/c')('/api/a/b/c/d'), false);
    });

    it('test minimatch', () => {
      assert.equal(minimatch('/server/user/info', '/server/user/info'), true);
      assert.equal(
        minimatch('/server/user/info', '/server/user/info/1'),
        false
      );
      // assert.equal(minimatch('/server/user/info', '/server/user/info/**'), true);
      assert.equal(minimatch('/server/user/info', '/server/user/**'), true);
      assert.equal(minimatch('/bbbbbb/ccccc', '/**'), true);
      assert.equal(minimatch('/api/abc', '/api/**'), true);
      assert.equal(minimatch('/api/a/b/c/d', '/api/a/b/c'), false);
    });

    it('test picomatch', () => {
      assert.equal(
        picomatch.isMatch('/server/user/info', '/server/user/info'),
        true
      );
      assert.equal(
        picomatch.isMatch('/server/user/info', '/server/user/info/1'),
        false
      );
      assert.equal(
        picomatch.isMatch('/server/user/info', '/server/user/info/**'),
        true
      );
      assert.equal(
        picomatch.isMatch('/server/user/info', '/server/user/**'),
        true
      );
      assert.equal(picomatch.isMatch('/bbbbbb/ccccc', '/**'), true);
      assert.equal(picomatch.isMatch('/api/abc', '/api/**'), true);
      assert.equal(picomatch.isMatch('/api/a/b/c/d', '/api/a/b/c'), false);
    });
  });

  describe('test express', () => {
    it('test /server/user/info', done => {
      const cwd = join(__dirname, './fixtures/ice-demo-repo');
      createExpressSuit({
        functionDir: cwd,
        sourceDir: 'src/apis',
        invokeCallback: getInvokeFun(),
      })
        .post('/server/user/info')
        .query({
          action: 'doTest',
        })
        .send({ name: 'zhangting' })
        .expect('Content-type', 'text/html; charset=utf-8')
        .expect(/zhangting,hello http world,doTest/)
        .expect('x-schema', 'bbb')
        .expect(200, done);
    });

    it('test second url /server/user/info2', done => {
      createExpressSuit({
        functionDir: join(__dirname, './fixtures/ice-demo-repo'),
        sourceDir: 'src/apis',
        invokeCallback: getInvokeFun(),
      })
        .post('/server/user/info2')
        .query({
          action: 'doTest',
        })
        .send({ name: 'zhangting' })
        .expect('Content-type', 'text/html; charset=utf-8')
        .expect(/zhangting,hello http world,doTest/)
        .expect('x-schema', 'bbb')
        .expect(200, done);
    });

    it('test /* router', done => {
      createExpressSuit({
        functionDir: join(__dirname, './fixtures/ice-demo-repo'),
        sourceDir: 'src/apis',
        invokeCallback: getInvokeFun(),
      })
        .post('/bbbbbb/ccccc')
        .query({
          action: 'doTest',
        })
        .expect(/test2/)
        .expect(200, done);
    });

    it('test /api/* router', done => {
      createExpressSuit({
        functionDir: join(__dirname, './fixtures/ice-demo-repo'),
        sourceDir: 'src/apis',
        invokeCallback: getInvokeFun(),
      })
        .post('/api/abc')
        .query({
          action: 'doTest',
        })
        .expect(/test3/)
        .expect(200, done);
    });

    it('test /api/a/b/c router', done => {
      createExpressSuit({
        functionDir: join(__dirname, './fixtures/ice-demo-repo'),
        sourceDir: 'src/apis',
        invokeCallback: getInvokeFun(),
      })
        .post('/api/a/b/c')
        .query({
          action: 'doTest',
        })
        .expect(/test4/)
        .expect(200, done);
    });

    it('test /api/a/b/c/d router must match /api/* not /api/a/b/c', done => {
      createExpressSuit({
        functionDir: join(__dirname, './fixtures/ice-demo-repo'),
        sourceDir: 'src/apis',
        invokeCallback: getInvokeFun(),
      })
        .post('/api/a/b/c/d')
        .expect(/test3/)
        .expect(200, done);
    });

    it('test /api/ router', done => {
      createExpressSuit({
        functionDir: join(__dirname, './fixtures/ice-demo-repo'),
        sourceDir: 'src/apis',
        invokeCallback: getInvokeFun(),
      })
        .post('/api/')
        .query({
          action: 'doTest',
        })
        .expect(/test6/)
        .expect(200, done);
    });
  });

  it('should invoke by http api and koa', done => {
    createKoaSuit({
      functionDir: join(__dirname, './fixtures/ice-demo-repo'),
      sourceDir: 'src/apis',
      invokeCallback: getInvokeFun(),
    })
      .post('/server/user/info')
      .query({
        action: 'doTest',
      })
      .send({ name: 'zhangting' })
      .expect('Content-type', 'text/html; charset=utf-8')
      .expect(/zhangting,hello http world,doTest/)
      .expect('x-schema', 'bbb')
      .expect(200, done);
  });

  it('should invoke second url by http api and koa', done => {
    createKoaSuit({
      functionDir: join(__dirname, './fixtures/ice-demo-repo'),
      sourceDir: 'src/apis',
      invokeCallback: getInvokeFun(),
    })
      .post('/server/user/info2')
      .query({
        action: 'doTest',
      })
      .send({ name: 'zhangting' })
      .expect('Content-type', 'text/html; charset=utf-8')
      .expect(/zhangting,hello http world,doTest/)
      .expect('x-schema', 'bbb')
      .expect(200, done);
  });

  it('should invoke *.json', done => {
    createKoaSuit({
      functionDir: join(__dirname, './fixtures/ice-demo-repo'),
      sourceDir: 'src/apis',
      invokeCallback: getInvokeFun(),
    })
      .post('/json/test.json')
      .query({
        action: 'doTest',
      })
      .send({ name: 'zhangting' })
      .expect('Content-type', 'text/html; charset=utf-8')
      .expect(/zhangting,hello http world,doTest/)
      .expect('x-schema', 'bbb')
      .expect(200, done);
  });

  it('should get param from path', done => {
    createKoaSuit({
      functionDir: join(__dirname, './fixtures/ice-demo-repo'),
      sourceDir: 'src/apis',
      invokeCallback: getInvokeFun(),
    })
      .get('/param/xijian/info')
      .expect(/xijian,hello http world/)
      .expect(200, done);
  });

  describe('test koa ignore pattern', () => {
    it('should test ignore pattern', done => {
      createKoaSuit({
        functionDir: join(__dirname, './fixtures/ice-demo-repo'),
        sourceDir: 'src/apis',
        ignorePattern: ['.do'],
        invokeCallback: getInvokeFun(),
      })
        .post('/ignore.do')
        .send({ name: 'zhangting' })
        .expect(404, done);
    });

    it('should test ignore pattern by function', done => {
      createKoaSuit({
        functionDir: join(__dirname, './fixtures/ice-demo-repo'),
        sourceDir: 'src/apis',
        ignorePattern: req => {
          return /\.do/.test(req.url);
        },
        invokeCallback: getInvokeFun(),
      })
        .post('/ignore.do')
        .send({ name: 'zhangting' })
        .expect(404, done);
    });

    it('should support ignore wildcard function', done => {
      createKoaSuit({
        functionDir: join(__dirname, './fixtures/ice-demo-repo'),
        sourceDir: 'src/apis',
        ignoreWildcardFunctions: ['test2'],
        invokeCallback: getInvokeFun(),
      })
        .post('/p')
        .send({ name: 'zhangting' })
        .expect(404, done);
    });
  });

  describe('test express ignore pattern', () => {
    it('should test ignore pattern', done => {
      createExpressSuit({
        functionDir: join(__dirname, './fixtures/ice-demo-repo'),
        sourceDir: 'src/apis',
        ignorePattern: ['.do'],
      })
        .post('/ignore.do')
        .send({ name: 'zhangting' })
        .expect(404, done);
    });

    it('should test ignore pattern by function', done => {
      createExpressSuit({
        functionDir: join(__dirname, './fixtures/ice-demo-repo'),
        sourceDir: 'src/apis',
        ignorePattern: req => {
          return /\.do/.test(req.url);
        },
      })
        .post('/ignore.do')
        .send({ name: 'zhangting' })
        .expect(404, done);
    });

    it('should support ignore wildcard function', done => {
      createExpressSuit({
        functionDir: join(__dirname, './fixtures/ice-demo-repo'),
        sourceDir: 'src/apis',
        ignoreWildcardFunctions: ['test2'],
        invokeCallback: getInvokeFun(),
      })
        .post('/p')
        .send({ name: 'zhangting' })
        .expect(404, done);
    });
  });
});
