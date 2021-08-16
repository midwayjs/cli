import { CommandCore } from '@midwayjs/command-core';
import { loadSpec } from '@midwayjs/serverless-spec-builder';
import { PackagePlugin } from '../src/index';
import { AliyunFCPlugin } from '../../cli-plugin-fc/src/index';
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
    const specFunctions = (core as any).coreInstance.service.functions;
    assert(specFunctions['cover-config'].test === 123456);
    assert(specFunctions['helloService-httpTrigger'].events[0].http);
    assert(specFunctions['helloService-httpTrigger'].events[1].http);
    assert(specFunctions['helloService-httpTrigger'].events.length === 2);
    assert(
      specFunctions['helloService-ossTrigger'].events[0].os.bucket === 'test'
    );
    assert(specFunctions['helloService-ossTrigger'].concurrency === 2);
    assert(specFunctions['helloService-ossTrigger'].timeout === 30);
    assert(specFunctions['helloService-ossTrigger'].initTimeout === 50);

    assert(
      specFunctions[
        'helloService-httpAllTrigger'
      ].events[0].http.method.includes('get')
    );
    assert(specFunctions['helloService-hsfTrigger'].events[0].hsf === true);
    assert(existsSync(resolve(buildDir, 'api.js')));
    assert(existsSync(resolve(buildDir, 'normal.js')));
    assert(existsSync(resolve(buildDir, 'renderNot2.js')));
  });
});
