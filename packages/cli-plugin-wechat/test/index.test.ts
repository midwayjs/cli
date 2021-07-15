import { CommandCore } from '@midwayjs/command-core';
import { loadSpec } from '@midwayjs/serverless-spec-builder';
import { PackagePlugin } from '@midwayjs/fcli-plugin-package';
import { WeChatPlugin } from '../src';
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
      provider: 'wechat',
      log: console,
    });
    core.addPlugin(PackagePlugin);
    core.addPlugin(WeChatPlugin);
    await core.ready();
    await core.invoke(['package']);
    const buildPath = join(baseDir, '.serverless');
    assert(existsSync(join(buildPath, 'config.json')));
  });
});
