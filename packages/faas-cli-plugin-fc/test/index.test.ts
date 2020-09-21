import { CommandCore } from '@midwayjs/command-core';
import { loadSpec } from '@midwayjs/serverless-spec-builder';
import { PackagePlugin } from '@midwayjs/fcli-plugin-package';
import { AliyunFCPlugin } from '../src';
import { join } from 'path';
import { existsSync, remove } from 'fs-extra';
import * as assert from 'assert';

describe('/test/index.test.ts', () => {
  it('use custom artifact directory', async () => {
    const baseDir = join(__dirname, './fixtures/base-fc');
    const core = new CommandCore({
      config: {
        servicePath: baseDir,
      },
      commands: ['package'],
      service: loadSpec(baseDir),
      provider: 'aliyun',
      log: console,
    });
    core.addPlugin(PackagePlugin);
    core.addPlugin(AliyunFCPlugin);
    await core.ready();
    await core.invoke(['package']);
    const buildPath = join(baseDir, '.serverless');
    assert(existsSync(join(buildPath, 'dist/index.js')));
    assert(existsSync(join(buildPath, 'node_modules')));
    assert(existsSync(join(buildPath, 'src')));
    assert(existsSync(join(buildPath, 'index.js')));
    assert(existsSync(join(buildPath, 'package.json')));
    assert(existsSync(join(buildPath, 'tsconfig.json')));
    assert(existsSync(join(buildPath, 'template.yml')));
    assert(existsSync(join(baseDir, 'serverless.zip')));
    // clean
    await remove(join(baseDir, 'serverless.zip'));
  });

  it('build eaas function', async () => {
    const baseDir = join(__dirname, './fixtures/eaas');
    const core = new CommandCore({
      config: {
        servicePath: baseDir,
      },
      commands: ['package'],
      service: loadSpec(baseDir),
      provider: 'aliyun',
      log: console,
    });
    core.addPlugin(PackagePlugin);
    core.addPlugin(AliyunFCPlugin);
    await core.ready();
    await core.invoke(['package']);

    const buildPath = join(baseDir, '.serverless');
    assert(existsSync(join(buildPath, 'app')));
    assert(existsSync(join(buildPath, 'node_modules')));
    assert(existsSync(join(buildPath, 'config')));
    assert(existsSync(join(buildPath, 'package.json')));
    assert(existsSync(join(buildPath, 'app.js')));
    assert(existsSync(join(buildPath, 'agent.js')));
    assert(existsSync(join(buildPath, 'index.js')));
    assert(existsSync(join(buildPath, 'template.yml')));
    assert(existsSync(join(baseDir, 'serverless.zip')));

    // clean
    await remove(join(baseDir, '.serverless'));
  });
});
