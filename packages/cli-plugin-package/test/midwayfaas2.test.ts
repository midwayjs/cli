import { CommandCore } from '@midwayjs/command-core';
import { loadSpec } from '@midwayjs/serverless-spec-builder';
import { PackagePlugin } from '../src/index';
import { AliyunFCPlugin } from '../../faas-cli-plugin-fc/src/index';
import { resolve } from 'path';
import { existsSync, remove } from 'fs-extra';
import * as assert from 'assert';

describe('/test/midwayfaas2.test.ts', () => {
  it('package', async () => {
    const baseDir = resolve(__dirname, './fixtures/midwayfaas2');
    const buildDir = resolve(baseDir, './.serverless');
    await remove(buildDir);
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
    core.addPlugin(AliyunFCPlugin);
    await core.ready();
    await core.invoke(['package']);
    assert(existsSync(resolve(buildDir, 'api.js')));
    assert(existsSync(resolve(buildDir, 'normal.js')));
    assert(existsSync(resolve(buildDir, 'renderNot2.js')));
  });
});
