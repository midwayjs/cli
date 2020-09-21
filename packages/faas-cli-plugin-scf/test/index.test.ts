import { CommandCore } from '@midwayjs/command-core';
import { loadSpec } from '@midwayjs/cli-plugin-faas';
import { PackagePlugin } from '@midwayjs/fcli-plugin-package';
import { TencentSCFPlugin } from '../src';
import { join } from 'path';
import { existsSync } from 'fs-extra';
import * as assert from 'assert';

describe('/test/index.test.ts', () => {
  it('use custom artifact directory', async () => {
    const baseDir = join(__dirname, './fixtures/base');
    const core = new CommandCore({
      config: {
        servicePath: baseDir,
      },
      commands: ['package'],
      service: loadSpec(baseDir),
      provider: 'tencent',
      log: console,
    });
    core.addPlugin(PackagePlugin);
    core.addPlugin(TencentSCFPlugin);
    await core.ready();
    await core.invoke(['package']);
    const buildPath = join(baseDir, '.serverless');
    assert(existsSync(join(buildPath, 'dist/index.js')));
    assert(existsSync(join(buildPath, 'node_modules')));
    assert(existsSync(join(buildPath, 'src')));
    assert(existsSync(join(buildPath, 'index.js')));
    assert(existsSync(join(buildPath, 'package.json')));
    assert(existsSync(join(buildPath, 'tsconfig.json')));
  });
});
