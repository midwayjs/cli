'use strict';
const fetch = require('node-fetch');
import { join } from 'path';
import { run } from './utils';
import * as assert from 'assert';
import { exec } from '@midwayjs/command-core';

const cwd = join(__dirname, 'fixtures/koa-3.x');
describe('test/3.x.test.ts', () => {
  it('koa port', async () => {
    // 3.x not support nodejs 10
    if (process.version.includes('v10')) {
      return;
    }
    await exec({
      baseDir: cwd,
      cmd: 'npm install',
    });
    const { close, port } = await run(cwd, {
      ignoreMock: true,
      silent: true,
      fast: false,
    });
    console.log('port', port);
    expect(port).toEqual('12081');
    const response = await fetch(`http://127.0.0.1:${port}/`);
    const body = await response.text();
    await close();
    assert(body === 'Hello Midwayjs!');
  });
});
