import * as assert from 'assert';
import { existsSync, remove } from 'fs-extra';
import { CommandCore } from '@midwayjs/command-core';
import { loadSpec } from '@midwayjs/serverless-spec-builder';
import { PackagePlugin } from '../src/index';
import { resolve, join } from 'path';

describe('/test/fast-install-nm.test.ts', () => {
  const baseDir = resolve(__dirname, './fixtures/fast-install-nm');

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
    await core.invoke(['package']);
    const buildPath = join(baseDir, '.serverless');
    assert(existsSync(join(buildPath, 'dist/index.js')));
    assert(existsSync(join(buildPath, 'dist/a.html')));
    assert(existsSync(join(buildPath, 'dist/view/b.json')));
    assert(existsSync(join(buildPath, 'node_modules')));
    assert(existsSync(join(buildPath, 'src')));
    assert(existsSync(join(buildPath, 'package.json')));
    assert(existsSync(join(buildPath, 'copy.js')));
    assert(existsSync(join(buildPath, 'tsconfig.json')));
    assert(existsSync(resolve(baseDir, 'serverless.zip')));
    assert(existsSync(join(buildPath, 'f.origin.yml')));
  });
});
