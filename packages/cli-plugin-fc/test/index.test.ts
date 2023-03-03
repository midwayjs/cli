import { CommandCore } from '@midwayjs/command-core';
import { loadSpec } from '@midwayjs/serverless-spec-builder';
import { PackagePlugin } from '@midwayjs/fcli-plugin-package';
import { DeployPlugin } from '../../cli-plugin-deploy';
import { AliyunFCPlugin } from '../src';
import { join } from 'path';
import { homedir } from 'os';
import {
  existsSync,
  remove,
  readFile,
  readFileSync,
  ensureFileSync,
  writeFileSync,
} from 'fs-extra';
import * as assert from 'assert';
import * as JSZip from 'jszip';

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
    assert(existsSync(join(baseDir, 'serverless.zip')));

    const zip = new JSZip();
    const zipData = await readFile(join(baseDir, 'serverless.zip'));
    const zipObj = await zip.loadAsync(zipData);
    assert(zipObj.file('f.yml'));
    assert(zipObj.file('dist/index.js'));
    assert(zipObj.file('node_modules/@midwayjs/core/package.json'));
    // clean
    await remove(join(baseDir, 'serverless.zip'));
  });

  it('use custom artifact directory', async () => {
    if (process.version.includes('v10')) {
      return;
    }
    const baseDir = join(__dirname, './fixtures/base-fc');
    process.env.SERVERLESS_DEPLOY_ID = 'test';
    process.env.SERVERLESS_DEPLOY_AK = 'test';
    process.env.SERVERLESS_DEPLOY_SECRET = 'test';
    const logs: any = [];
    const core = new CommandCore({
      config: {
        servicePath: baseDir,
      },
      options: {
        skipDeploy: true,
        skipInstallDep: true,
      },
      commands: ['deploy'],
      service: loadSpec(baseDir),
      provider: 'aliyun',
      log: {
        log: (...args) => {
          logs.push(...args);
        },
      },
    });
    core.addPlugin(DeployPlugin);
    core.addPlugin(PackagePlugin);
    core.addPlugin(AliyunFCPlugin);
    await core.ready();
    await core.invoke(['deploy']);
    const logStr = logs.join('\n');
    assert(logStr.includes('success'));
    // clean
    await remove(join(baseDir, '.serverless'));
  });

  it('only build index2', async () => {
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
    await core.invoke(['package'], false, { function: 'index2' });
    const buildPath = join(baseDir, '.serverless');
    assert(existsSync(join(buildPath, 'dist/index.js')));
    assert(existsSync(join(buildPath, 'node_modules')));
    assert(existsSync(join(buildPath, 'src')));
    assert(existsSync(join(buildPath, 'index.js')));
    assert(existsSync(join(buildPath, 'package.json')));
    assert(existsSync(join(buildPath, 'tsconfig.json')));
    assert(existsSync(join(baseDir, 'serverless.zip')));

    const entryData = readFileSync(join(buildPath, 'index.js')).toString();
    assert(!entryData.includes('exports.handler '));
    assert(entryData.includes('exports.handler2 '));

    const zip = new JSZip();
    const zipData = await readFile(join(baseDir, 'serverless.zip'));
    const zipObj = await zip.loadAsync(zipData);
    assert(zipObj.file('f.yml'));
    assert(zipObj.file('dist/index.js'));
    assert(zipObj.file('node_modules/@midwayjs/core/package.json'));
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
    assert(existsSync(join(baseDir, 'serverless.zip')));

    // clean
    await remove(join(baseDir, '.serverless'));
  });
  it('build by serverless-dev', async () => {
    if (process.version.includes('v10')) {
      return;
    }
    const accessYaml = join(homedir(), '.s/access.yaml');
    const exists = existsSync(accessYaml);
    if (!exists) {
      ensureFileSync(accessYaml);
      writeFileSync(accessYaml, '');
    }

    const baseDir = join(__dirname, './fixtures/serverless-devs');
    const logs: any = [];
    const debug: any = [];
    const core = new CommandCore({
      config: {
        servicePath: baseDir,
      },
      commands: ['deploy'],
      service: loadSpec(baseDir),
      provider: 'aliyun',
      log: {
        ...console,
        log: (...logInfo) => {
          logs.push(...logInfo);
        },
        debug: (...logInfo) => {
          debug.push(...logInfo);
        },
      },
      options: {
        verbose: true,
        skipDeploy: true,
        skipInstallDep: true,
      },
    });
    core.addPlugin(PackagePlugin);
    core.addPlugin(DeployPlugin);
    core.addPlugin(AliyunFCPlugin);
    await core.ready();
    await core.invoke(['deploy']);
    // clean
    await remove(join(baseDir, '.serverless'));
    const logsStr = logs.join(';');
    const debugLogsStr = debug.join(';');
    const ossJson = /helloService-oss;(.*?"--use-local"\})/.exec(debugLogsStr);
    assert(logsStr.includes('@serverless-devs'));
    assert(logsStr.includes('deploy success'));
    assert(ossJson && ossJson[1]);
    const ossInfo = JSON.parse(ossJson[1]);

    assert(ossInfo.props.triggers.length === 1);
    const trigger = ossInfo.props.triggers[0];
    assert(
      trigger.type === 'oss' &&
        trigger.config.bucketName === 'testBuck' &&
        trigger.config.filter.key.Prefix === 'pre' &&
        trigger.config.filter.key.Suffix === 'suf'
    );
    const layers = ossInfo.props.function.layers;
    assert(layers.length === 1 && typeof layers[0] === 'string');
    if (!exists) {
      await remove(accessYaml);
    }
  });
});
