import { CommandCore } from '@midwayjs/command-core';
import { loadSpec } from '@midwayjs/serverless-spec-builder';
import { PackagePlugin } from '../src/index';
import { resolve, join } from 'path';
import { existsSync, remove } from 'fs-extra';
import * as assert from 'assert';

describe('/test/remove-useless-files.test.ts', () => {
  const baseDir = resolve(__dirname, './fixtures/base-app');
  afterEach(async () => {
    await remove(join(baseDir, 'serverless.zip'));
    // await remove(join(baseDir, 'package-lock.json'));
    // await remove(join(baseDir, '.serverless'));
    // await remove(join(baseDir, 'node_modules'));
  });
  it('base package', async () => {
    const service = loadSpec(baseDir);
    service.experimentalFeatures = {
      removeUselessFiles: true,
    };
    const core = new CommandCore({
      config: {
        servicePath: baseDir,
      },
      commands: ['package'],
      service,
      provider: 'aliyun',
      options: {
        skipZip: true,
      },
      log: console,
    });
    core.addPlugin(PackagePlugin);
    await core.ready();
    await core.invoke(['package']);
    const buildPath = join(baseDir, '.serverless');
    assert(existsSync(join(buildPath, 'dist/index.js')));
    assert(!existsSync(join(buildPath, 'node_modules/@midwayjs/core/LICENSE')));
  });
});
