import { CommandCore } from '@midwayjs/command-core';
import { loadSpec } from '@midwayjs/serverless-spec-builder';
import { PackagePlugin } from '../src/index';
import { AliyunFCPlugin } from '../../cli-plugin-fc/src/index';
import { FaaSTmpOutPlugin } from './fixtures/plugins/faas_tmp_out';
import { resolve } from 'path';
import { remove, existsSync } from 'fs-extra';
import * as assert from 'assert';

describe('/test/noyaml.test.ts', () => {
  describe('integration project build', () => {
    it('aggregation package', async () => {
      const baseDir = resolve(__dirname, 'fixtures/noYaml');
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
          V: true,
        },
        log: console,
      });
      core.addPlugin(PackagePlugin);
      core.addPlugin(AliyunFCPlugin);
      core.addPlugin(FaaSTmpOutPlugin);
      await core.ready();
      await core.invoke(['package']);
      assert(!existsSync(resolve(buildDir, 'faas_tmp_out')));
      assert(existsSync(resolve(buildDir, 'service.js')));
    });
  });
});
