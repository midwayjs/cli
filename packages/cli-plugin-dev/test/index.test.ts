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
describe('test/index.test.ts', () => {
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
});
