import { CommandCore } from '@midwayjs/command-core';
import { loadSpec } from '@midwayjs/serverless-spec-builder';
import { join } from 'path';
import { remove, existsSync, readFileSync } from 'fs-extra';
import { TestCreatePlugin } from './helper';
import * as assert from 'assert';

describe('/test/create.test.ts', () => {
  const baseDir = join(__dirname, './tmp');
  beforeEach(async () => {
    if (existsSync(baseDir)) {
      await remove(baseDir);
    }
  });
  it('base create faas boilerplate', async () => {
    const core = new CommandCore({
      config: {
        servicePath: baseDir,
      },
      commands: ['create'],
      service: loadSpec(baseDir),
      provider: 'aliyun',
      options: {
        template: 'faas-standard',
        path: 'my_serverless',
      },
      log: console,
    });
    core.addPlugin(TestCreatePlugin);
    await core.ready();
    await core.invoke(['create']);
    assert(existsSync(join(baseDir, 'my_serverless/f.yml')));
    assert(existsSync(join(baseDir, 'my_serverless/src')));
    assert(existsSync(join(baseDir, 'my_serverless/test')));
    assert(existsSync(join(baseDir, 'my_serverless/tsconfig.json')));
    assert(existsSync(join(baseDir, 'my_serverless/package.json')));
    const contents = readFileSync(
      join(baseDir, 'my_serverless/f.yml'),
      'utf-8'
    );
    assert(/serverless-hello-world/.test(contents));
    await remove(baseDir);
  });

  it('base create from remote npm name', async () => {
    const core = new CommandCore({
      config: {
        servicePath: baseDir,
      },
      commands: ['create'],
      service: loadSpec(baseDir),
      provider: 'aliyun',
      options: {
        'template-package': '@midwayjs/faas-boilerplate-standard',
        path: 'my_serverless',
      },
      log: console,
    });
    core.addPlugin(TestCreatePlugin);
    await core.ready();
    await core.invoke(['create']);
    assert(existsSync(join(baseDir, 'my_serverless/f.yml')));
    assert(existsSync(join(baseDir, 'my_serverless/src')));
    assert(existsSync(join(baseDir, 'my_serverless/test')));
    assert(existsSync(join(baseDir, 'my_serverless/tsconfig.json')));
    assert(existsSync(join(baseDir, 'my_serverless/package.json')));
    const contents = readFileSync(
      join(baseDir, 'my_serverless/f.yml'),
      'utf-8'
    );
    assert(/serverless-hello-world/.test(contents));
    await remove(baseDir);
  });
  it('base create no options', async () => {
    if (existsSync(baseDir)) {
      await remove(baseDir);
    }
    class TestPlugin extends TestCreatePlugin {
      set prompt(value) {
        value.run = () => {
          return 'faas-standard';
        };
        super.prompt = value;
      }

      get prompt() {
        return super.prompt;
      }
    }
    const core = new CommandCore({
      config: {
        servicePath: baseDir,
      },
      commands: ['create'],
      service: loadSpec(baseDir),
      provider: 'aliyun',
      options: {
        path: 'my_serverless',
      },
      log: console,
    });
    core.addPlugin(TestPlugin);
    await core.ready();
    await core.invoke(['create']);
    assert(existsSync(join(baseDir, 'my_serverless/f.yml')));
    assert(existsSync(join(baseDir, 'my_serverless/src')));
    assert(existsSync(join(baseDir, 'my_serverless/test')));
    assert(existsSync(join(baseDir, 'my_serverless/tsconfig.json')));
    assert(existsSync(join(baseDir, 'my_serverless/package.json')));
    const contents = readFileSync(
      join(baseDir, 'my_serverless/f.yml'),
      'utf-8'
    );
    assert(/serverless-hello-world/.test(contents));
    await remove(baseDir);
  });
  it('base create error tmp', async () => {
    if (existsSync(baseDir)) {
      await remove(baseDir);
    }
    const tmpPath = 'my_serverless' + Date.now();
    const core = new CommandCore({
      config: {
        servicePath: baseDir,
      },
      commands: ['create'],
      service: loadSpec(baseDir),
      provider: 'aliyun',
      options: {
        path: 'my_serverless',
        'template-path': tmpPath,
      },
      log: console,
    });
    core.addPlugin(TestCreatePlugin);
    await core.ready();
    try {
      await core.invoke(['create']);
      assert(false);
    } catch (e) {
      assert(e.message.indexOf(tmpPath) !== -1);
      assert(e.message.indexOf('no such file or directory') !== -1);
    }
    await remove(baseDir);
  });
});
