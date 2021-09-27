import { CommandCore } from '@midwayjs/command-core';
import { loadSpec } from '@midwayjs/serverless-spec-builder';
import { PackagePlugin } from '../src/index';
import { resolve, join } from 'path';
import { existsSync, remove } from 'fs-extra';
import * as assert from 'assert';

describe('/test/skip-build.test.ts', () => {
  const baseDir = resolve(__dirname, './fixtures/skipBuild');

  afterEach(async () => {
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
      options: {
        skipZip: true,
        skipInstallDep: true,
        skipBuild: true,
      },
      log: console,
    });
    core.addPlugin(PackagePlugin);
    await core.ready();
    await core.invoke(['package']);
    const buildPath = join(baseDir, '.serverless');
    assert(existsSync(join(buildPath, 'static/index.js')));
    assert(!existsSync(join(buildPath, 'dist')));
  });
});
