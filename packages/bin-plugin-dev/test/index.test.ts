'use strict';
import { CommandCore } from '@midwayjs/command-core';
import { remove, existsSync } from 'fs-extra';
const fetch = require('node-fetch');
import { join } from 'path';
import { DevPlugin } from '../src';
import * as assert from 'assert';
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
  await core.invoke(['dev'], false, {
    ts: true,
    silent: true,
    notWatch: true,
    ...options,
  });
  return core.store.get('global:dev:closeApp');
};
const cwd = join(__dirname, 'fixtures/base-app');
describe('test/index.test.ts', () => {
  it('dev', async () => {
    const dist = join(cwd, 'dist');
    if (existsSync(dist)) {
      await remove(dist);
    }
    const close = await run(cwd);
    const response = await fetch('http://127.0.0.1:7001/?name=midway');
    const body = await response.text();
    assert(body === 'hello world,midway');
    await close();
  });
});
