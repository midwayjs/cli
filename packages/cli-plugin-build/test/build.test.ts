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
      buildCache: true,
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
    assert(existsSync(join(dist, 'app/public/public.js')));
    assert(!existsSync(join(dist, 'a.js')));
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
    await run(cwd, 'build', { clean: true, include: 'a.js' });
    assert(existsSync(join(dist, 'a.js')));
    assert(existsSync(join(dist, 'index.js')));
    assert(existsSync(join(dist, 'a.json')));
    assert(existsSync(join(dist, 'b/b.txt')));
    assert(existsSync(join(dist, 'c')));
  });

  it('error ts', async () => {
    const errorcwd = join(__dirname, 'fixtures/error-ts');
    const dist = join(errorcwd, 'dist');
    if (existsSync(dist)) {
      await remove(dist);
    }
    try {
      await run(errorcwd, 'build');
    } catch (e) {
      assert(/stringx/.test(e.message));
    }
  });
  it('error no ts config', async () => {
    const errorcwd = join(__dirname, 'fixtures/error-no-tsconfig');
    const dist = join(errorcwd, 'dist');
    if (existsSync(dist)) {
      await remove(dist);
    }
    try {
      await run(errorcwd, 'build');
    } catch (e) {
      assert(/tsconfig\.json not found/.test(e.message));
    }
  });
  it('error ts config options', async () => {
    const errorcwd = join(__dirname, 'fixtures/error-no-tsconfig');
    const dist = join(errorcwd, 'dist');
    if (existsSync(dist)) {
      await remove(dist);
    }
    try {
      await run(errorcwd, 'build', {
        tsConfig: 'xxx',
      });
    } catch (e) {
      assert(/Unexpected token x/.test(e.message));
    }
  });
  it('ts config options', async () => {
    const errorcwd = join(__dirname, 'fixtures/error-no-tsconfig');
    const dist = join(errorcwd, 'dist');
    if (existsSync(dist)) {
      await remove(dist);
    }
    await run(errorcwd, 'build', {
      tsConfig: JSON.stringify({
        compileOnSave: true,
        compilerOptions: {
          rootDir: 'src',
          outDir: 'dist',
        },
        include: ['./src/**/*.ts'],
      }),
    });
    assert(existsSync(join(dist, 'index.js')));
  });
  it('error ts config file', async () => {
    const errorcwd = join(__dirname, 'fixtures/error-tsconfig');
    const dist = join(errorcwd, 'dist');
    if (existsSync(dist)) {
      await remove(dist);
    }
    try {
      await run(errorcwd, 'build');
    } catch (e) {
      assert(/Unexpected token \//.test(e.message));
    }
  });
});
