'use strict';
import { CommandCore } from '@midwayjs/command-core';
import { remove, existsSync } from 'fs-extra';
import { join } from 'path';
import { BuildPlugin } from '../src';
import * as assert from 'assert';
const run = async (cwd: string, command: string, options = {}) => {
  const core = new CommandCore({
    commands: [command],
    options: {
      ...options,
    },
    log: {
      log: console.log,
    },
    cwd,
  });
  core.addPlugin(BuildPlugin);
  await core.ready();
  await core.invoke();
};
const cwd = join(__dirname, 'fixtures/base');
describe('test/build.test.ts', () => {
  it('build', async () => {
    const dist = join(cwd, 'dist');
    if (existsSync(dist)) {
      await remove(dist);
    }
    await run(cwd, 'build');
    assert(existsSync(join(dist, 'index.js')));
  });
  it('build clean', async () => {
    const dist = join(cwd, 'dist');
    if (existsSync(dist)) {
      await remove(dist);
    }
    await run(cwd, 'build', { clean: true });
    assert(existsSync(join(dist, 'index.js')));
  });
  it('copyfile', async () => {
    const dist = join(cwd, 'dist');
    if (existsSync(dist)) {
      await remove(dist);
    }
    await run(cwd, 'build', { clean: true });
    assert(existsSync(join(dist, 'index.js')));
    assert(existsSync(join(dist, 'a.json')));
    assert(existsSync(join(dist, 'b/b.txt')));
    assert(existsSync(join(dist, 'c')));
  });
});
