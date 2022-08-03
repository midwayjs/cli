'use strict';
import { CommandCore } from '@midwayjs/command-core';
import { remove, existsSync } from 'fs-extra';
import { join } from 'path';
import { BuildPlugin } from '../src';
import * as assert from 'assert';
import { execSync } from 'child_process';
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
      assert(false);
    } catch (e) {
      assert(e.message.includes('1 ts error that must be fixed'));
    }
  });
  it('ignore error ts', async () => {
    const errorcwd = join(__dirname, 'fixtures/error-ts-ignore');
    const dist = join(errorcwd, 'dist');
    if (existsSync(dist)) {
      await remove(dist);
    }
    await run(errorcwd, 'build', { buildCache: false });
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
      assert(false);
    } catch (e) {
      assert(e.message.includes('Unexpected token'));
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
  it('bundle', async () => {
    const bundle = join(__dirname, 'fixtures/bundle');
    const dist = join(bundle, 'dist');
    if (existsSync(dist)) {
      await remove(dist);
    }
    execSync(`cd ${bundle};npm i`);
    await run(bundle, 'build', { bundle: true });
    assert(existsSync(join(bundle, 'dist/bundle.js')));
  });
});
