'use strict';
import { CommandCore } from '@midwayjs/command-core';
import { remove, existsSync, copy } from 'fs-extra';
const fetch = require('node-fetch');
import { join } from 'path';
import { DevPlugin } from '../src';
import * as assert from 'assert';
const wait = () => {
  return new Promise(resolve => {
    setTimeout(resolve, 10000);
  });
};
const run = async (cwd: string, options = {}) => {
  const core = new CommandCore({
    commands: ['dev'],
    options: {},
    log: {
      log: console.log,
    },
    cwd,
  });
  core.addPlugin(DevPlugin);
  await core.ready();
  core.invoke(['dev'], false, {
    ts: true,
    ...options,
  });
  await wait();
  return core.store.get('global:dev:closeApp');
};
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
    const close = await run(cwd);
    if (existsSync(api)) {
      await remove(api);
    }
    await copy(api1, api);
    await wait();

    const response = await fetch('http://127.0.0.1:7001/?name=midway');
    const body = await response.text();
    assert(body === 'hello world,midway');
    await remove(api);
    await copy(api2, api);
    await wait();
    const response2 = await fetch('http://127.0.0.1:7001/?name=midway');
    const body2 = await response2.text();
    assert(body2 === 'hello world2,midway');
    await close();
  });
});
