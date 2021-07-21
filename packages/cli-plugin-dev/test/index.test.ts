'use strict';
import { remove, existsSync, copy } from 'fs-extra';
const fetch = require('node-fetch');
import { join } from 'path';
import { wait, run } from './utils';
import * as assert from 'assert';

const cwd = join(__dirname, 'fixtures/base-app');
const api = join(cwd, 'src/controller/api.ts');
const api1 = join(cwd, 'src/controller/api.cache');
const api2 = join(cwd, 'src/controller/api2.cache');
describe.skip('test/index.test.ts', () => {
  it('dev', async () => {
    const dist = join(cwd, 'dist');
    if (existsSync(dist)) {
      await remove(dist);
    }
    const { close, port } = await run(cwd);
    if (existsSync(api)) {
      await remove(api);
    }
    await copy(api1, api);
    await wait();

    const response = await fetch(`http://127.0.0.1:${port}/?name=midway`);
    const body = await response.text();
    assert(body === 'hello world,midway');
    await remove(api);
    await copy(api2, api);
    await wait();
    const response2 = await fetch(`http://127.0.0.1:${port}/?name=midway`);
    const body2 = await response2.text();
    assert(body2 === 'hello world2,midway');
    await wait();
    await close();
  });
  it('dev multi', async () => {
    const dist = join(cwd, 'dist');
    if (existsSync(dist)) {
      await remove(dist);
    }
    if (existsSync(api)) {
      await remove(api);
    }
    await copy(api1, api);
    const { close, port } = await run(cwd);
    const { close: close2, port: port2 } = await run(cwd, { silent: true });
    const response = await fetch(`http://127.0.0.1:${port}/?name=midway`);
    const body = await response.text();
    assert(body === 'hello world,midway');
    const response2 = await fetch(`http://127.0.0.1:${port2}/?name=midway`);
    const body2 = await response2.text();
    assert(body2 === 'hello world,midway');
    await close();
    await close2();
  });
  it('dev error', async () => {
    const cwd = join(__dirname, 'fixtures/error-app');
    const dist = join(cwd, 'dist');
    if (existsSync(dist)) {
      await remove(dist);
    }
    const { close } = await run(cwd, { port: 12336 });
    await close();
  });
});
