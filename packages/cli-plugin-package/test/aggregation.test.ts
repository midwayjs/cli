import { CommandCore, exec } from '@midwayjs/command-core';
import { loadSpec } from '@midwayjs/serverless-spec-builder';
import { PackagePlugin } from '../src/index';
import { AliyunFCPlugin } from '../../cli-plugin-fc/src/index';
import { FpPackagePlugin } from './fixtures/cli-plugins/fp';
import { resolve } from 'path';
import { existsSync, remove, readFileSync } from 'fs-extra';
import * as assert from 'assert';

describe('/test/aggregation.test.ts', () => {
  describe('integration project build', () => {
    it('aggregation package', async () => {
      const baseDir = resolve(__dirname, './fixtures/aggregation');
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
    it('aggregation fp package', async () => {
      const baseDir = resolve(__dirname, './fixtures/aggregation-fp');
      const buildDir = resolve(baseDir, './.serverless');
      await remove(buildDir);
      await exec({
        baseDir: baseDir,
        cmd: 'npm install',
      });
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
      core.addPlugin(FpPackagePlugin);
      await core.ready();
      await core.invoke(['package']);
      assert(resolve(buildDir, 'all.js'));
      const allCode = readFileSync(resolve(buildDir, 'all.js')).toString();
      assert(/"router": "\/multiply\/1"/.test(allCode));
      assert(/"router": "\/multiply\/2"/.test(allCode));
    });
  });

  it('aggregation event trigger', async () => {
    const baseDir = resolve(__dirname, './fixtures/aggregation-event');
    const buildDir = resolve(baseDir, './.serverless');
    await remove(buildDir);
    await exec({
      baseDir: baseDir,
      cmd: 'npm install',
    });
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
    const functions = (core as any).coreInstance.service.functions;
    assert(functions.allEvent._handlers.length === 3);
    assert(functions.allHttp._handlers.length === 3);
  });
  it.skip('aggregation deployType', async () => {
    const baseDir = resolve(__dirname, './fixtures/aggregation-deployType');
    const buildDir = resolve(baseDir, './.serverless');
    await remove(buildDir);
    await exec({
      baseDir: baseDir,
      cmd: 'npm install',
    });
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
    const functions = (core as any).coreInstance.service.functions;
    console.log('functions', JSON.stringify(functions, null, 2));
    assert(functions['app_index'].handler === 'index.handler');
    assert(Object.keys(functions).length === 1);
  });
});
