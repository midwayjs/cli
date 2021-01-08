import { CommandCore } from '@midwayjs/command-core';
import { loadSpec } from '@midwayjs/serverless-spec-builder';
import { PackagePlugin } from '../src/index';
import { resolve, join } from 'path';
import { remove } from 'fs-extra';
import * as assert from 'assert';

describe.skip('/test/ts-error.test.ts', () => {
  const baseDir = resolve(__dirname, './fixtures/ts-error');

  afterEach(async () => {
    await remove(join(baseDir, 'serverless.zip'));
    await remove(join(baseDir, 'package-lock.json'));
    await remove(join(baseDir, '.serverless'));
    await remove(join(baseDir, 'node_modules'));
  });
  it('base package', async () => {
    const core = new CommandCore({
      config: {
        servicePath: baseDir,
      },
      commands: ['package'],
      service: loadSpec(baseDir),
      provider: 'aliyun',
      options: {},
      log: console,
    });
    core.addPlugin(PackagePlugin);
    await core.ready();
    try {
      await core.invoke(['package']);
      assert(false);
    } catch (e) {
      assert(e.message === 'Error: 4 ts error that must be fixed!');
    }
  });
});
