import { CommandCore } from '@midwayjs/command-core';
import { loadSpec } from '@midwayjs/serverless-spec-builder';
import { PackagePlugin } from '../src/index';
import { resolve, join } from 'path';
import { existsSync, remove } from 'fs-extra';
import * as assert from 'assert';
import { execSync } from 'child_process';

describe('/test/package-hooks.test.ts', () => {
  const baseDir = resolve(__dirname, './fixtures/hooks');

  afterEach(async () => {
    await remove(join(baseDir, '.serverless'));
    await remove(join(baseDir, 'node_modules'));
  });
  it('base package', async () => {
    const originNodeEnv = process.env.NODE_ENV;

    process.env.MIDWAY_TS_MODE = 'false';
    process.env.NODE_ENV = 'dev';
    execSync(`cd ${baseDir};npm install @midwayjs/hooks-core`);
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
      },
      log: console,
    });
    core.addPlugin(PackagePlugin);
    await core.ready();
    await core.invoke(['package']);
    process.env.NODE_ENV = originNodeEnv;
    const buildPath = join(baseDir, '.serverless');
    assert(existsSync(join(buildPath, 'abc/def.txt')));
    assert(
      (core as any).coreInstance.service.functions.all._handlers.length === 2
    );
  });
});
