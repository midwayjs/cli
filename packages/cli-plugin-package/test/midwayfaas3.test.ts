import { CommandCore } from '@midwayjs/command-core';
import { loadSpec } from '@midwayjs/serverless-spec-builder';
import { PackagePlugin } from '../src/index';
import { AliyunFCPlugin } from '../../cli-plugin-fc/src/index';
import { resolve } from 'path';
import { remove } from 'fs-extra';
import * as assert from 'assert';

describe('/test/midwayfaas3.test.ts', () => {
  it('package', async () => {
    const baseDir = resolve(__dirname, './fixtures/midwayfaas3');
    const buildDir = resolve(baseDir, './.serverless');
    await remove(buildDir);
    const core = new CommandCore({
      config: {
        servicePath: baseDir,
      },
      commands: ['package'],
      service: loadSpec(baseDir),
      provider: 'aliyun',
      options: {
        bundle: true,
      },
      log: console,
    });
    core.addPlugin(PackagePlugin);
    core.addPlugin(AliyunFCPlugin);
    await core.ready();
    await core.invoke(['package']);
    const specFunctions = (core as any).coreInstance.service.functions;
    assert(specFunctions['helloService-httpAllTrigger']);
    assert(specFunctions['helloService-httpTrigger']);
    assert(specFunctions['helloService-ossTrigger']);
    assert(specFunctions['helloService-coverConfig']);
    assert(specFunctions['helloService-hsfTrigger']);
  });
});
