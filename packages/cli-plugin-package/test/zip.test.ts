import { CommandCore } from '@midwayjs/command-core';
import { loadSpec } from '@midwayjs/serverless-spec-builder';
import { PackagePlugin } from '../src/index';
import { resolve, join } from 'path';
import { readFile, remove } from 'fs-extra';
import * as assert from 'assert';
import * as JSZip from 'jszip';

describe('/test/zip.test.ts', () => {
  const baseDir = resolve(__dirname, './fixtures/zip');

  afterEach(async () => {
    await remove(join(baseDir, '.serverless'));
    await remove(join(baseDir, 'serverless.zip'));
  });
  it('base package', async () => {
    const core = new CommandCore({
      config: {
        servicePath: baseDir,
      },
      commands: ['package'],
      service: loadSpec(baseDir),
      provider: 'aliyun',
      options: {
        skipInstallDep: true,
        skipBuild: true,
      },
      log: console,
    });
    core.addPlugin(PackagePlugin);
    await core.ready();
    await core.invoke(['package']);

    const zip = new JSZip();
    const zipData = await readFile(join(baseDir, 'serverless.zip'));
    const zipObj = await zip.loadAsync(zipData);

    // default include root/*.{yml,js,json}
    assert(zipObj.file('a.yml'));
    assert(zipObj.file('b.js'));
    assert(zipObj.file('c.json'));
    // default include app/*、config/*
    assert(zipObj.file('app/app.txt'));
    assert(zipObj.file('config/a.config'));
    // default ignore start with . and other ext file
    assert(!zipObj.file('.env.ignore'));
    assert(!zipObj.file('config/.abc'));
    assert(!zipObj.file('other/other.js'));
    // user config include
    assert(zipObj.file('.env'));
    assert(zipObj.file('.env.prod'));
    assert(zipObj.file('test/.env.test'));
    assert(zipObj.file('app/.name'));
    // user config exclude
    assert(!zipObj.file('test/.env.exclude'));
  });
});
